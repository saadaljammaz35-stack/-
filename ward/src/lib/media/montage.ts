import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';
import { json, num, withOrg, type OrgContext, type Queryable } from '@/lib/db';
import { badRequest, conflict, notFound } from '@/lib/http';
import { notify } from '@/lib/notifications';
import { getSettings } from '@/lib/settings';
import { enqueue } from '@/lib/queue';
import { pollRunner, runnerMode, startRunner, stopRunner, type AnalyzeResult, type RenderResult, type RunnerHandle, type RunnerResult } from '@/lib/media/exec';
import {
  AgentPlanSchema, agentTask, applyAgentPlan, composePlan, deadAirCuts, editPlan, planKeeps, planUnits, speechCuts,
  type EditPlan, type PlanCut, type PlanEdit, type Preset,
} from '@/lib/media/plan';
import { assertKey, getStorage, maxUploadBytes, mediaKey, storageKind, type StorageKind } from '@/lib/media/storage';
import { buildShortAss, chaptersText, clipSegments, finalizeChapters, parseTranscript, remapCues, toSrt, type Cue, type Span, type Word } from '@/lib/media/timeline';

/**
 * WARD montage — automatic first cut of an episode.
 *
 *   upload ─▶ analyzing (runner: probe, silences, local Whisper) ─▶ planning (Production agent)
 *          ─▶ review (the founder/editor checks every cut, chapter and short)
 *          ─▶ rendering (runner: trimmed episode + vertical shorts with Arabic captions) ─▶ done
 *
 * Nothing is published from here: renders are files for the team to review and upload.
 */

export type ProjectStatus = 'analyzing' | 'planning' | 'review' | 'rendering' | 'done' | 'failed' | 'cancelled';

type StoredRunner = RunnerHandle & { callbackHash?: string; lastPollAt?: string };

export interface ProjectRow {
  id: string;
  org_id: string;
  episode_id: string;
  source_asset_id: string;
  status: ProjectStatus;
  stage: string | null;
  progress: number;
  transcript_source: 'whisper' | 'upload' | 'none';
  settings: { preset?: Preset; language?: string };
  probe: AnalyzeResult['probe'] | null;
  silences: Span[] | null;
  transcript: { engine: string; language?: string; cues: Cue[]; words?: Word[] } | null;
  plan: EditPlan | null;
  runner: StoredRunner | null;
  error: string | null;
  cost_usd: number;
  cost_limit_usd: number;
  created_at: Date;
  updated_at: Date;
}

const sys = (orgId: string): OrgContext => ({ orgId, userId: null, role: 'system' });
const POLL_EVERY_MS = 20_000;

export async function loadProject(q: Queryable, id: string): Promise<ProjectRow | null> {
  const rows = await q.query<ProjectRow>(
    `select id, org_id, episode_id, source_asset_id, status, stage, progress::float8, transcript_source, settings, probe, silences,
            transcript, plan, runner, error, cost_usd::float8, cost_limit_usd::float8, created_at, updated_at
       from ward.montage_projects where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

async function sourceOf(q: Queryable, p: ProjectRow): Promise<{ storage: StorageKind; key: string; size: number; name: string }> {
  const a = (await q.query<{ storage: StorageKind; storage_key: string; size: string; name: string }>(
    'select storage, storage_key, size, name from ward.media_assets where id = $1', [p.source_asset_id]))[0];
  if (!a) throw new Error('source_missing');
  return { storage: a.storage, key: a.storage_key, size: Number(a.size), name: a.name };
}

function ttlSeconds(): number {
  return (env().WARD_SANDBOX_TIMEOUT_MIN + 60) * 60;
}

// ─────────────────────────── callbacks from the runner ───────────────────────────

function appUrl(): string | null {
  const e = env();
  if (e.WARD_SITE_URL) return e.WARD_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

function makeCallback(projectId: string): { url: string | null; hash?: string } {
  const base = appUrl();
  if (runnerMode() === 'local' || !base) return { url: null };
  const token = randomBytes(32).toString('base64url');
  return { url: `${base}/api/montage/callback/${projectId}?t=${token}`, hash: hashToken(token) };
}

export function callbackTokenMatches(stored: string | undefined, token: string | null): boolean {
  if (!stored || !token) return false;
  const a = Buffer.from(stored, 'hex');
  const b = Buffer.from(hashToken(token), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─────────────────────────── upload & create ───────────────────────────

export interface UploadIntent {
  storage: StorageKind;
  key: string;
  maxBytes: number;
  /** local storage: PUT the file body here. */
  uploadUrl?: string;
  /** vercel-blob: the route that issues the client token for @vercel/blob/client upload(). */
  handleUploadUrl?: string;
}

export async function uploadIntent(ctx: OrgContext, episodeId: string, input: { name: string; size: number; type: string }): Promise<UploadIntent> {
  const kind = storageKind();
  if (!kind) throw badRequest('media_storage_not_configured', 'اربط مخزن Vercel Blob بالمشروع أو اضبط WARD_MEDIA_STORAGE');
  if (!/^(video|audio)\//.test(input.type) && !/\.(mp4|mov|m4v|mkv|webm|mp3|m4a|wav|aac)$/i.test(input.name)) throw badRequest('unsupported_media_type');
  const max = maxUploadBytes();
  if (input.size > max) throw badRequest('file_too_large', `max ${Math.round(max / 1024 / 1024)} MB`);
  const exists = await withOrg(ctx, (q) => q.query('select 1 from ward.episodes where id = $1', [episodeId]));
  if (!exists.length) throw notFound();
  const key = mediaKey(ctx.orgId, episodeId, randomUUID(), input.name);
  return kind === 'local'
    ? { storage: kind, key, maxBytes: max, uploadUrl: `/api/os/montage/upload?key=${encodeURIComponent(key)}` }
    : { storage: kind, key, maxBytes: max, handleUploadUrl: '/api/os/montage/upload' };
}

export interface CreateInput {
  key: string;
  name: string;
  mime: string;
  /** The size the browser read from the file: a stored object of another size is an incomplete upload. */
  size?: number;
  transcript_source: 'whisper' | 'upload' | 'none';
  transcript_text?: string;
  transcript_name?: string;
  preset: Preset;
}

export async function createProject(ctx: OrgContext, episodeId: string, input: CreateInput): Promise<string> {
  const kind = storageKind();
  if (!kind) throw badRequest('media_storage_not_configured');
  assertKey(input.key, ctx.orgId);
  if (!input.key.startsWith(`ward/${ctx.orgId}/${episodeId}/`)) throw badRequest('invalid_media_key');
  const storage = getStorage(kind);
  const head = await storage.head(input.key);
  if (!head) throw badRequest('upload_not_found');
  if (input.size && head.size !== input.size) {
    await storage.delete([input.key]);
    throw badRequest('upload_incomplete', `stored ${head.size} of ${input.size} bytes`);
  }
  if (head.size > maxUploadBytes()) {
    await storage.delete([input.key]);
    throw badRequest('file_too_large');
  }
  let transcript: ProjectRow['transcript'] = null;
  if (input.transcript_source === 'upload') {
    let cues: Cue[] = [];
    try {
      cues = parseTranscript(input.transcript_text ?? '', input.transcript_name ?? '');
    } catch {
      /* reported below */
    }
    if (cues.length < 2) throw badRequest('transcript_unreadable', 'SRT / VTT / JSON');
    transcript = { engine: 'upload', cues };
  }
  const id = await withOrg(ctx, async (q) => {
    const ep = await q.query('select 1 from ward.episodes where id = $1', [episodeId]);
    if (!ep.length) throw notFound();
    const busy = await q.query(`select 1 from ward.montage_projects where episode_id = $1 and status in ('analyzing','planning','rendering')`, [episodeId]);
    if (busy.length) throw conflict('montage_busy', 'هناك مونتاج قيد التنفيذ لهذه الحلقة');
    const asset = await q.query<{ id: string }>(
      `insert into ward.media_assets (org_id, episode_id, kind, storage, storage_key, name, mime, size, uploaded_by)
       values ($1,$2,'source',$3,$4,$5,$6,$7,$8) returning id`,
      [ctx.orgId, episodeId, kind, input.key, input.name.slice(0, 255), head.contentType ?? input.mime ?? 'video/mp4', head.size, ctx.userId],
    );
    const limit = (await getSettings(q, ctx.orgId))['limits.montage_usd'];
    const p = await q.query<{ id: string }>(
      `insert into ward.montage_projects (org_id, episode_id, source_asset_id, transcript_source, settings, transcript, cost_limit_usd, created_by)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8) returning id`,
      [ctx.orgId, episodeId, asset[0]!.id, input.transcript_source, json({ preset: input.preset, language: 'ar' }), transcript ? json(transcript) : null, limit, ctx.userId],
    );
    await audit(q, ctx, 'montage.created', { type: 'montage_project', id: p[0]!.id }, { episode_id: episodeId, size: head.size, transcript: input.transcript_source });
    return p[0]!.id;
  });
  await startAnalysis(ctx.orgId, id);
  return id;
}

// ─────────────────────────── analysis ───────────────────────────

export async function startAnalysis(orgId: string, projectId: string): Promise<void> {
  const ctx = sys(orgId);
  const { p, src } = await withOrg(ctx, async (q) => {
    const p = await loadProject(q, projectId);
    if (!p) throw notFound();
    return { p, src: await sourceOf(q, p) };
  });
  try {
    const storage = getStorage(src.storage);
    const needsWhisper = p.transcript_source === 'whisper';
    const callback = makeCallback(projectId);
    const handle = await startRunner({
      task: 'analyze',
      needsWhisper,
      callbackUrl: callback.url,
      spec: {
        source: { url: await storage.runnerInput(src.key, ttlSeconds()) },
        analyze: {
          silence: { noiseDb: -35, minSeconds: 0.4 },
          transcribe: needsWhisper ? { engine: 'whisper-local', model: env().WARD_WHISPER_MODEL, language: p.settings.language ?? 'ar' } : { engine: 'none' },
        },
      },
    });
    await withOrg(ctx, async (q) => {
      await q.query(
        `update ward.montage_projects set status = 'analyzing', stage = 'starting', progress = 0, error = null, runner = $2::jsonb where id = $1`,
        [projectId, json({ ...handle, callbackHash: callback.hash })],
      );
      await enqueue(q, orgId, 'montage.poll', { projectId }, { runAt: new Date(Date.now() + POLL_EVERY_MS) });
    });
  } catch (err) {
    await fail(orgId, projectId, `runner_start_failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function fail(orgId: string, projectId: string, error: string): Promise<void> {
  await withOrg(sys(orgId), async (q) => {
    await q.query(`update ward.montage_projects set status = 'failed', error = $2, runner = null where id = $1`, [projectId, error.slice(0, 2000)]);
    await q.query(`update ward.montage_renders set status = 'failed', error = coalesce(error, 'cancelled'), finished_at = now() where project_id = $1 and status = 'rendering'`, [projectId]);
    await notify(q, orgId, { kind: 'montage', severity: 'warning', title: 'تعذّر إكمال المونتاج الآلي', body: error.slice(0, 400), link: `/os/montage/${projectId}` });
  });
}

// ─────────────────────────── polling & results ───────────────────────────

/**
 * Check the runner of an analyzing/rendering project. Cheap and safe to call from anywhere
 * (queue, status endpoint): a short lease keeps two callers from polling at the same time.
 */
export async function syncProject(orgId: string, projectId: string, opts: { force?: boolean } = {}): Promise<'idle' | 'running' | 'finished' | 'failed'> {
  const ctx = sys(orgId);
  const leased = await withOrg(ctx, (q) =>
    q.query<{ runner: StoredRunner; status: ProjectStatus }>(
      `update ward.montage_projects set runner = runner || jsonb_build_object('lastPollAt', now())
        where id = $1 and status in ('analyzing','rendering') and runner is not null
          and ($2 or coalesce((runner->>'lastPollAt')::timestamptz, 'epoch'::timestamptz) < now() - interval '8 seconds')
        returning runner, status`,
      [projectId, opts.force ?? false],
    ),
  );
  const row = leased[0];
  if (!row) return 'idle';
  const handle = row.runner;
  let poll;
  try {
    poll = await pollRunner(handle);
  } catch (err) {
    // A transient API error is not a failed edit; try again on the next poll unless it is hopeless.
    const ageMin = (Date.now() - new Date(handle.startedAt).getTime()) / 60_000;
    if (ageMin > env().WARD_SANDBOX_TIMEOUT_MIN + 15) {
      await fail(orgId, projectId, `runner_unreachable: ${err instanceof Error ? err.message : String(err)}`);
      return 'failed';
    }
    return 'running';
  }
  if (poll.state === 'running') {
    const ageMin = (Date.now() - new Date(handle.startedAt).getTime()) / 60_000;
    if (handle.mode === 'local' ? ageMin > 24 * 60 : ageMin > env().WARD_SANDBOX_TIMEOUT_MIN + 5) {
      await stopRunner(handle, { keepFiles: true });
      await fail(orgId, projectId, 'runner_timeout');
      return 'failed';
    }
    await withOrg(ctx, (q) =>
      q.query(`update ward.montage_projects set stage = $3, progress = $4 where id = $1 and runner->>'runId' = $2`, [
        projectId, handle.runId, String(poll.progress?.stage ?? 'running').slice(0, 60), Math.max(0, Math.min(100, Number(poll.progress?.pct ?? 0))),
      ]),
    );
    return 'running';
  }
  if (poll.state === 'lost') {
    await stopRunner(handle, { keepFiles: true });
    await fail(orgId, projectId, poll.error);
    return 'failed';
  }
  await acceptResult(orgId, projectId, poll.result);
  return 'finished';
}

/** Store a runner result (from the callback or from polling). Idempotent: only the current run counts. */
export async function acceptResult(orgId: string, projectId: string, result: RunnerResult): Promise<boolean> {
  const ctx = sys(orgId);
  const p = await withOrg(ctx, (q) => loadProject(q, projectId));
  if (!p?.runner || !result.runId || result.runId !== p.runner.runId) return false;
  const handle = p.runner;
  // Claim the result: clearing `runner` for this runId makes every other delivery a no-op.
  const claimed = await withOrg(ctx, (q) =>
    q.query(`update ward.montage_projects set runner = null where id = $1 and runner->>'runId' = $2 returning id`, [projectId, result.runId]),
  );
  if (!claimed.length) return false;
  void stopRunner(handle);

  if (!result.ok && !('partial' in result && result.partial)) {
    await fail(orgId, projectId, `${result.error ?? 'runner_failed'}${result.detail ? ` — ${result.detail.slice(-600)}` : ''}`);
    return true;
  }
  if (result.task === 'analyze' && p.status === 'analyzing') {
    const transcript = p.transcript ?? (result.transcript ? { engine: result.transcript.engine, language: result.transcript.language, cues: result.transcript.cues, words: result.transcript.words } : null);
    await withOrg(ctx, async (q) => {
      await q.query(
        `update ward.montage_projects set status = 'planning', stage = 'plan', progress = 100, probe = $2::jsonb, silences = $3::jsonb, transcript = $4::jsonb where id = $1`,
        [projectId, json(result.probe), json(result.silences), transcript ? json(transcript) : null],
      );
      await q.query(`update ward.media_assets set duration_s = $2, width = $3, height = $4 where id = $1`, [
        p.source_asset_id, result.probe.duration, result.probe.video?.width ?? null, result.probe.video?.height ?? null,
      ]);
      await enqueue(q, orgId, 'montage.plan', { projectId }, { idempotencyKey: `montage.plan:${projectId}:${result.runId}` });
    });
    return true;
  }
  if (result.task === 'render' && p.status === 'rendering') {
    await storeRenders(orgId, p, result);
    return true;
  }
  return false;
}

async function storeRenders(orgId: string, p: ProjectRow, result: RenderResult): Promise<void> {
  const ctx = sys(orgId);
  await withOrg(ctx, async (q) => {
    const renders = await q.query<{ id: string; name: string; kind: string; spec: { files: Record<string, { key: string; mime: string; kind: 'episode_render' | 'short_render' | 'thumbnail' }> } }>(
      `select id, name, kind, spec from ward.montage_renders where project_id = $1 and status = 'rendering'`, [p.id]);
    const src = await sourceOf(q, p);
    let okCount = 0;
    const failed: string[] = [];
    for (const r of renders) {
      const job = result.jobs[r.name];
      if (!job?.ok) {
        failed.push(r.name);
        await q.query(`update ward.montage_renders set status = 'failed', error = $2, finished_at = now() where id = $1`, [r.id, (job?.error ?? 'missing').slice(0, 1000)]);
        continue;
      }
      const ids: Record<string, string> = {};
      for (const [file, meta] of Object.entries(r.spec.files)) {
        const up = result.uploads[file];
        if (!up?.ok) continue;
        const a = await q.query<{ id: string }>(
          `insert into ward.media_assets (org_id, episode_id, kind, storage, storage_key, name, mime, size, duration_s, meta)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
           on conflict (storage, storage_key) do update set size = excluded.size returning id`,
          [orgId, p.episode_id, meta.kind, src.storage, meta.key, file, meta.mime, up.size, meta.kind === 'thumbnail' ? null : job.duration ?? null, json({ project_id: p.id, render_id: r.id })],
        );
        ids[meta.kind] = a[0]!.id;
      }
      okCount++;
      await q.query(
        `update ward.montage_renders set status = 'done', asset_id = $2, thumbnail_asset_id = $3, duration_s = $4, finished_at = now() where id = $1`,
        [r.id, ids.episode_render ?? ids.short_render ?? null, ids.thumbnail ?? null, job.duration ?? null],
      );
    }
    const status = okCount ? 'done' : 'failed';
    await q.query(`update ward.montage_projects set status = $2, stage = null, progress = 100, error = $3 where id = $1`, [
      p.id, status, failed.length ? `failed_renders: ${failed.join(', ')}` : null,
    ]);
    await notify(q, orgId, {
      kind: 'montage',
      severity: okCount ? 'info' : 'warning',
      title: okCount ? 'المونتاج الآلي جاهز للمراجعة' : 'فشل إخراج المونتاج',
      body: okCount ? `${okCount} ملف جاهز${failed.length ? ` — تعذّر: ${failed.join('، ')}` : ''}. راجع النسخة قبل أي نشر.` : failed.join('، '),
      link: `/os/montage/${p.id}`,
    });
  });
}

// ─────────────────────────── planning (Production agent) ───────────────────────────

async function spentFor(orgId: string, projectId: string): Promise<number> {
  const rows = await withOrg(sys(orgId), (q) =>
    q.query<{ total: number }>(`select coalesce(sum(cost_usd),0)::float8 as total from ward.model_usage where purpose = $1`, [`montage:${projectId}`]),
  );
  return num(rows[0]?.total);
}

export async function planProject(orgId: string, projectId: string): Promise<void> {
  const ctx = sys(orgId);
  const data = await withOrg(ctx, async (q) => {
    const p = await loadProject(q, projectId);
    if (!p || p.status !== 'planning') return null;
    const ep = (await q.query<{ title: string; topic: string; is_minor: boolean | null; guest: string | null }>(
      `select e.title, e.topic, g.is_minor, g.name as guest from ward.episodes e left join ward.guests g on g.id = e.guest_id where e.id = $1`, [p.episode_id]))[0];
    return { p, ep };
  });
  if (!data) return;
  const { p, ep } = data;
  const duration = p.probe?.duration ?? 0;
  const cues = p.transcript?.cues ?? [];
  const preset: Preset = p.settings.preset ?? 'normal';
  let agent: Parameters<typeof composePlan>[0]['agent'];
  if (cues.length >= 3) {
    const units = planUnits(cues);
    try {
      const { runAgentStructured } = await import('@/lib/agents/runner');
      const { data: ap, runId } = await runAgentStructured({
        ctx,
        agent: 'production',
        purpose: `montage:${projectId}`,
        name: 'montage_plan',
        schema: AgentPlanSchema,
        maxTokens: 6000,
        capUsd: { scope: 'montage', limit: p.cost_limit_usd, spent: () => spentFor(orgId, projectId) },
        task: agentTask({
          episodeTitle: ep?.title ?? '',
          topic: ep?.topic,
          guestNote: ep?.is_minor ? 'تنبيه: الضيف قاصر — احمِ خصوصيته واقترح حذف أي معلومة تعرّف به خارج ما يلزم.' : ep?.guest ? `الضيف: ${ep.guest} (تأكد من حالة التأكيد قبل أي نشر).` : undefined,
          duration,
          units,
        }),
      });
      agent = { plan: applyAgentPlan(ap, units, duration), runId };
    } catch (err) {
      agent = { error: err instanceof Error ? err.message.slice(0, 500) : String(err) };
    }
  }
  const plan = composePlan({ duration, silences: p.silences ?? [], cues, words: p.transcript?.words, preset, agent });
  const spent = await spentFor(orgId, projectId);
  await withOrg(ctx, async (q) => {
    const done = await q.query(
      `update ward.montage_projects set status = 'review', stage = null, plan = $2::jsonb, plan_run_id = $3, cost_usd = $4 where id = $1 and status = 'planning' returning id`,
      [projectId, json(plan), plan.agent.runId ?? null, spent],
    );
    if (done.length) {
      await notify(q, orgId, {
        kind: 'montage',
        title: 'خطة المونتاج جاهزة للمراجعة',
        body: `${plan.cuts.length} قص مقترح، ${plan.shorts.length} مقطع قصير، ${plan.chapters.length} فصل.${plan.agent.error ? ` (الوكيل: ${plan.agent.error.slice(0, 120)})` : ''}`,
        link: `/os/montage/${projectId}`,
      });
    }
  });
}

// ─────────────────────────── review edits ───────────────────────────

export async function updatePlan(ctx: OrgContext, projectId: string, edit: PlanEdit): Promise<EditPlan> {
  return withOrg(ctx, async (q) => {
    const p = await loadProject(q, projectId);
    if (!p) throw notFound();
    if (!p.plan || !['review', 'done', 'failed'].includes(p.status)) throw conflict('montage_not_editable');
    const rebuild = (preset: Preset): PlanCut[] => {
      const dur = p.plan!.duration;
      const out: PlanCut[] = [];
      let n = 0;
      for (const [a, b] of deadAirCuts(p.silences ?? [], dur, preset, p.transcript?.words)) out.push({ id: `d${++n}`, kind: 'dead', start: a, end: b, reason: `صمت ${(b - a).toFixed(1)} ث`, enabled: true });
      for (const s of speechCuts(p.transcript?.cues ?? [])) out.push({ id: `d${++n}`, kind: s.kind, start: s.span[0], end: s.span[1], reason: s.reason, enabled: true });
      return out;
    };
    const next = editPlan(p.plan, edit, rebuild);
    await q.query(`update ward.montage_projects set plan = $2::jsonb, status = case when status = 'failed' then 'review' else status end, error = case when status = 'failed' then null else error end where id = $1`, [projectId, json(next)]);
    return next;
  });
}

// ─────────────────────────── rendering ───────────────────────────

const safeName = (s: string) => s.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'ward';

export async function startRender(ctx: OrgContext, projectId: string): Promise<void> {
  const { p, src, ep } = await withOrg(ctx, async (q) => {
    const p = await loadProject(q, projectId);
    if (!p) throw notFound();
    if (!p.plan || !['review', 'done', 'failed'].includes(p.status)) throw conflict('montage_not_ready');
    const ep = (await q.query<{ number: number | null }>('select number from ward.episodes where id = $1', [p.episode_id]))[0];
    return { p, src: await sourceOf(q, p), ep };
  });
  const plan = p.plan!;
  const keeps = planKeeps(plan);
  if (!keeps.length) throw badRequest('nothing_left_to_render');
  const storage = getStorage(src.storage);
  const batch = randomUUID();
  const prefix = `ward/${ctx.orgId}/${p.episode_id}/${batch}`;
  const tag = safeName(`ward-ep${ep?.number ?? ''}`);
  const cues = p.transcript?.cues ?? [];
  const words = p.transcript?.words;
  const ttl = ttlSeconds();

  type FileMeta = { key: string; mime: string; kind: 'episode_render' | 'short_render' | 'thumbnail' };
  const renders: { name: string; kind: 'episode' | 'short'; title: string; files: Record<string, FileMeta>; summary: Record<string, unknown> }[] = [];
  const jobs: Record<string, unknown>[] = [];
  const outputs: Record<string, unknown> = {};

  const episodeFile = `${tag}-montage.mp4`;
  jobs.push({ name: 'episode', kind: 'episode', output: episodeFile, sourceDuration: plan.duration, segments: keeps, loudnorm: true });
  renders.push({ name: 'episode', kind: 'episode', title: 'الحلقة بعد المونتاج', files: { [episodeFile]: { key: `${prefix}/${episodeFile}`, mime: 'video/mp4', kind: 'episode_render' } }, summary: { segments: keeps.length } });

  let n = 0;
  for (const s of plan.shorts.filter((x) => x.enabled)) {
    const segs = clipSegments(keeps, s.start, s.end);
    if (!segs.length) continue;
    n++;
    const name = `short-${n}`;
    const video = `${tag}-short-${n}.mp4`;
    const thumb = `${tag}-short-${n}.jpg`;
    const ass = s.captions || s.hook ? buildShortAss({ cues: s.captions ? cues : [], words: s.captions ? words : undefined, segments: segs, hook: s.hook }) : undefined;
    jobs.push({ name, kind: 'short', output: video, thumbnail: thumb, start: segs[0]![0], end: segs[segs.length - 1]![1], segments: segs, framing: s.framing, ass });
    renders.push({
      name, kind: 'short', title: s.title,
      files: { [video]: { key: `${prefix}/${video}`, mime: 'video/mp4', kind: 'short_render' }, [thumb]: { key: `${prefix}/${thumb}`, mime: 'image/jpeg', kind: 'thumbnail' } },
      summary: { short_id: s.id, start: s.start, end: s.end, framing: s.framing, hook: s.hook, captions: s.captions },
    });
  }
  for (const r of renders) {
    for (const [file, meta] of Object.entries(r.files)) {
      const max = meta.kind === 'episode_render' ? Math.max(src.size * 3, 512 * 1024 * 1024) : 512 * 1024 * 1024;
      outputs[file] = await storage.runnerOutput(meta.key, meta.mime, max, ttl);
    }
  }

  // Replace the previous renders of this project (files and rows).
  const old = await withOrg(ctx, async (q) => {
    const rows = await q.query<{ storage_key: string; id: string }>(
      `select a.storage_key, a.id from ward.media_assets a
        where a.id in (select asset_id from ward.montage_renders where project_id = $1 union select thumbnail_asset_id from ward.montage_renders where project_id = $1)`,
      [projectId],
    );
    await q.query('delete from ward.montage_renders where project_id = $1', [projectId]);
    if (rows.length) await q.query('delete from ward.media_assets where id = any($1::uuid[])', [`{${rows.map((r) => r.id).join(',')}}`]);
    for (const r of renders) {
      await q.query(`insert into ward.montage_renders (org_id, project_id, kind, name, title, spec) values ($1,$2,$3,$4,$5,$6::jsonb)`, [
        ctx.orgId, projectId, r.kind, r.name, r.title.slice(0, 200), json({ files: r.files, ...r.summary }),
      ]);
    }
    await q.query(
      `update ward.montage_projects set status = 'rendering', stage = 'starting', progress = 0, error = null, approved_by = $2, approved_at = now() where id = $1`,
      [projectId, ctx.userId],
    );
    await audit(q, ctx, 'montage.render_started', { type: 'montage_project', id: projectId }, { jobs: renders.length, kept_seconds: keeps.reduce((t, [a, b]) => t + b - a, 0) });
    return rows.map((r) => r.storage_key);
  });
  void storage.delete(old);

  try {
    const callback = makeCallback(projectId);
    const handle = await startRunner({
      task: 'render',
      callbackUrl: callback.url,
      spec: { source: { url: await storage.runnerInput(src.key, ttl) }, render: { jobs }, outputs },
    });
    await withOrg(ctx, async (q) => {
      await q.query(`update ward.montage_projects set runner = $2::jsonb where id = $1`, [projectId, json({ ...handle, callbackHash: callback.hash })]);
      await enqueue(q, ctx.orgId, 'montage.poll', { projectId }, { runAt: new Date(Date.now() + POLL_EVERY_MS) });
    });
  } catch (err) {
    await fail(ctx.orgId, projectId, `runner_start_failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function cancelProject(ctx: OrgContext, projectId: string): Promise<void> {
  const p = await withOrg(ctx, (q) => loadProject(q, projectId));
  if (!p) throw notFound();
  if (!['analyzing', 'planning', 'rendering'].includes(p.status)) return;
  await withOrg(ctx, async (q) => {
    await q.query(`update ward.montage_projects set status = 'cancelled', runner = null, stage = null where id = $1`, [projectId]);
    await q.query(`update ward.montage_renders set status = 'failed', error = 'cancelled', finished_at = now() where project_id = $1 and status = 'rendering'`, [projectId]);
    await audit(q, ctx, 'montage.cancelled', { type: 'montage_project', id: projectId });
  });
  if (p.runner) await stopRunner(p.runner);
}

/** Re-run the analysis (e.g. after a failure) on the same uploaded file. */
export async function reanalyze(ctx: OrgContext, projectId: string): Promise<void> {
  const p = await withOrg(ctx, (q) => loadProject(q, projectId));
  if (!p) throw notFound();
  if (['analyzing', 'planning', 'rendering'].includes(p.status)) throw conflict('montage_busy');
  await withOrg(ctx, async (q) => {
    await q.query(
      `update ward.montage_projects set status = 'analyzing', plan = null, error = null, transcript = case when transcript_source = 'upload' then transcript else null end where id = $1`,
      [projectId],
    );
    await audit(q, ctx, 'montage.reanalyze', { type: 'montage_project', id: projectId });
  });
  await startAnalysis(ctx.orgId, projectId);
}

/** Re-run only the Production agent on the existing analysis. */
export async function replan(ctx: OrgContext, projectId: string): Promise<void> {
  await withOrg(ctx, async (q) => {
    const p = await loadProject(q, projectId);
    if (!p) throw notFound();
    if (!p.probe || !['review', 'done', 'failed'].includes(p.status)) throw conflict('montage_not_ready');
    await q.query(`update ward.montage_projects set status = 'planning', error = null where id = $1`, [projectId]);
    await enqueue(q, ctx.orgId, 'montage.plan', { projectId });
    await audit(q, ctx, 'montage.replan', { type: 'montage_project', id: projectId });
  });
}

/** Delete the project, its renders and the uploaded source (rows and stored files). */
export async function deleteProject(ctx: OrgContext, projectId: string): Promise<void> {
  const p = await withOrg(ctx, (q) => loadProject(q, projectId));
  if (!p) throw notFound();
  if (p.runner) await stopRunner(p.runner);
  const { keys, storage } = await withOrg(ctx, async (q) => {
    const src = await sourceOf(q, p);
    const rows = await q.query<{ id: string; storage_key: string }>(
      `select id, storage_key from ward.media_assets where id = $2 or id in (select asset_id from ward.montage_renders where project_id = $1 union select thumbnail_asset_id from ward.montage_renders where project_id = $1)`,
      [projectId, p.source_asset_id],
    );
    await q.query('delete from ward.montage_projects where id = $1', [projectId]);
    if (rows.length) await q.query('delete from ward.media_assets where id = any($1::uuid[])', [`{${rows.map((r) => r.id).join(',')}}`]);
    await audit(q, ctx, 'montage.deleted', { type: 'montage_project', id: projectId }, { files: rows.length });
    return { keys: rows.map((r) => r.storage_key), storage: src.storage };
  });
  await getStorage(storage).delete(keys);
}

// ─────────────────────────── exports ───────────────────────────

export function exportText(p: ProjectRow, format: 'srt' | 'chapters' | 'cuts' | 'source-srt'): { body: string; name: string; type: string } {
  if (!p.plan) throw conflict('montage_not_ready');
  const keeps = planKeeps(p.plan);
  const cues = p.transcript?.cues ?? [];
  if (format === 'srt') return { body: toSrt(remapCues(cues, keeps)), name: 'ward-montage.srt', type: 'application/x-subrip; charset=utf-8' };
  if (format === 'source-srt') return { body: toSrt(cues), name: 'ward-source.srt', type: 'application/x-subrip; charset=utf-8' };
  if (format === 'chapters') {
    const ch = finalizeChapters(p.plan.chapters, keeps);
    return { body: chaptersText(ch.chapters) + (ch.valid ? '\n' : `\n\n# ${ch.reason}: YouTube needs 3+ chapters of 10s+, first at 0:00\n`), name: 'ward-chapters.txt', type: 'text/plain; charset=utf-8' };
  }
  const lines = ['start,end,duration,kind,enabled,reason', ...p.plan.cuts.map((c) => `${c.start},${c.end},${(c.end - c.start).toFixed(3)},${c.kind},${c.enabled},"${c.reason.replace(/"/g, '""')}"`)];
  return { body: lines.join('\n') + '\n', name: 'ward-cuts.csv', type: 'text/csv; charset=utf-8' };
}
