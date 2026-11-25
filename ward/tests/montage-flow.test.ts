import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withOrg } from '@/lib/db';
import { seed } from '@/lib/seed';
import { createProject, deleteProject, exportText, loadProject, planProject, startRender, syncProject, updatePlan, uploadIntent, type ProjectRow } from '@/lib/media/montage';
import { localPath, writeLocal } from '@/lib/media/storage';
import { install, q1, ScriptedProvider, setupDb, teardown, type TestEnv } from './helpers';

/**
 * End to end with the real runner and real ffmpeg on a generated 22 s clip:
 * upload → analysis → Production agent plan → founder edit → render → files → delete.
 */
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

function makeClip(file: string) {
  // tone 0–4 s, silence 4–7 s, tone 7–13 s, silence 13–16 s, tone 16–22 s
  const tone = (f: number, d: number) => `sine=frequency=${f}:duration=${d}:sample_rate=48000`;
  const sil = (d: number) => `anullsrc=r=48000:cl=mono,atrim=duration=${d}`;
  const graph = [tone(440, 4), sil(3), tone(550, 6), sil(3), tone(660, 6)].map((s, i) => `${s}[a${i}]`).join(';') + ';[a0][a1][a2][a3][a4]concat=n=5:v=0:a=1[a]';
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25', '-filter_complex', graph, '-map', '0:v', '-map', '[a]', '-t', '22', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', file]);
}

const SRT = `1
00:00:00,200 --> 00:00:03,900
مرحبا بكم في بودكاست وارد

2
00:00:07,100 --> 00:00:12,900
ضيفنا اليوم بدأ قناته وهو صغير

3
00:00:16,100 --> 00:00:21,800
وبعدها صارت القناة أكبر من عمره
`;

const probeDuration = (file: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

async function until(projectId: string, env: TestEnv, want: ProjectRow['status'][], timeoutMs = 120_000): Promise<ProjectRow> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await syncProject(env.orgId, projectId, { force: true });
    const p = (await withOrg(env.founder, (q) => loadProject(q, projectId)))!;
    if (want.includes(p.status)) return p;
    if (p.status === 'failed') throw new Error(`montage failed: ${p.error}`);
    if (Date.now() > deadline) throw new Error(`timeout in ${p.status}/${p.stage}`);
    await new Promise((r) => setTimeout(r, 400));
  }
}

describe.skipIf(!hasFfmpeg)('montage end to end (local runner, real ffmpeg)', () => {
  let env: TestEnv;
  let dir: string;
  let clip: string;
  let episodeId: string;

  beforeAll(async () => {
    env = await setupDb();
    dir = mkdtempSync(path.join(tmpdir(), 'ward-montage-'));
    process.env.WARD_MEDIA_STORAGE = 'local';
    process.env.WARD_MEDIA_RUNNER = 'local';
    process.env.WARD_MEDIA_DIR = path.join(dir, 'media');
    process.env.WARD_MEDIA_WORK_DIR = path.join(dir, 'work');
    clip = path.join(dir, 'clip.mp4');
    makeClip(clip);
    episodeId = (await q1<{ id: string }>(env.founder, 'select id from ward.episodes limit 1')).id;
  }, 60_000);

  afterAll(async () => {
    for (const k of ['WARD_MEDIA_STORAGE', 'WARD_MEDIA_RUNNER', 'WARD_MEDIA_DIR', 'WARD_MEDIA_WORK_DIR']) delete process.env[k];
    await teardown(env);
    rmSync(dir, { recursive: true, force: true });
  });

  it('cuts the silences, follows the agent plan and renders the episode and a captioned short', async () => {
    const provider = install(
      new ScriptedProvider('anthropic', () => ({
        text: JSON.stringify({
          summary: 'حلقة عن قناة بدأت من الصغر.',
          chapters: [{ cue: 0, title: 'المقدمة' }, { cue: 1, title: 'البداية' }, { cue: 2, title: 'أكبر من عمره' }],
          shorts: [{ start_cue: 1, end_cue: 2, title: 'بدأ صغير', hook: 'بدأ قناته صغير!', reason: 'قصة كاملة', score: 8, framing: 'fit' }],
          content_cuts: [],
          notes: ['تأكد من موافقة ولي الأمر قبل النشر.'],
        }),
        inputTokens: 1200,
        outputTokens: 300,
      })),
    );

    const intent = await uploadIntent(env.founder, episodeId, { name: 'الحلقة الأولى.mp4', size: 1000, type: 'video/mp4' });
    expect(intent.storage).toBe('local');
    expect(intent.key).toMatch(new RegExp(`^ward/${env.orgId}/${episodeId}/[0-9a-f-]{36}/media\\.mp4$`)); // non-ASCII names are made safe
    await writeLocal(intent.key, Readable.toWeb(createReadStream(clip)) as ReadableStream<Uint8Array>, 50 * 1024 * 1024);

    const id = await createProject(env.founder, episodeId, { key: intent.key, name: 'الحلقة الأولى.mp4', mime: 'video/mp4', transcript_source: 'upload', transcript_text: SRT, transcript_name: 'ep.srt', preset: 'normal' });
    const analyzed = await until(id, env, ['planning']);
    expect(analyzed.probe?.duration).toBeCloseTo(22, 0);
    expect(analyzed.silences?.length).toBe(2);

    await planProject(env.orgId, id);
    const review = (await withOrg(env.founder, (q) => loadProject(q, id)))!;
    expect(review.status).toBe('review');
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]!.messages[0]!.content).toContain('[1]');
    const plan = review.plan!;
    expect(plan.agent.ran).toBe(true);
    expect(plan.cuts.filter((c) => c.kind === 'dead')).toHaveLength(2);
    expect(plan.chapters.map((c) => c.title)).toEqual(['المقدمة', 'البداية', 'أكبر من عمره']);
    expect(plan.shorts).toHaveLength(1);
    expect(review.cost_usd).toBeGreaterThan(0);

    // The founder adjusts the short before rendering.
    await updatePlan(env.founder, id, { shorts: [{ id: plan.shorts[0]!.id, title: 'من المطبخ إلى القناة', framing: 'center' }] });

    await startRender(env.founder, id);
    const done = await until(id, env, ['done']);
    expect(done.error).toBeNull();
    const renders = await withOrg(env.founder, (q) =>
      q.query<{ kind: string; status: string; storage_key: string; thumb: string | null; duration_s: number }>(
        `select r.kind, r.status, a.storage_key, t.storage_key as thumb, r.duration_s::float8 from ward.montage_renders r
           join ward.media_assets a on a.id = r.asset_id left join ward.media_assets t on t.id = r.thumbnail_asset_id where r.project_id = $1 order by r.kind`,
        [id],
      ),
    );
    expect(renders.map((r) => [r.kind, r.status])).toEqual([['episode', 'done'], ['short', 'done']]);
    const episodeFile = localPath(renders[0]!.storage_key);
    const shortFile = localPath(renders[1]!.storage_key);
    // 22 s minus two 3 s pauses, each trimmed to a 0.44 s breath.
    expect(probeDuration(episodeFile)).toBeCloseTo(22 - 2 * (3 - 0.44), 0);
    expect(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', shortFile]).toString().trim()).toBe('1080,1920');
    expect(existsSync(localPath(renders[1]!.thumb!))).toBe(true);

    const p = (await withOrg(env.founder, (q) => loadProject(q, id)))!;
    const srt = exportText(p, 'srt').body;
    expect(srt).toContain('وبعدها صارت القناة أكبر من عمره');
    expect(srt).toContain('00:00:10,980 --> 00:00:16,680'); // 16.1 s − two cuts of 2.56 s
    expect(exportText(p, 'chapters').body.split('\n')[0]).toBe('0:00 المقدمة');

    // Another organization cannot see the project.
    const rival = await seed({ orgSlug: 'rival-montage', founder: { email: 'rival-m@org.test', password: 'rival long password', name: 'R' } });
    expect(await withOrg({ orgId: rival.orgId, userId: rival.founderId!, role: 'owner' }, (q) => loadProject(q, id))).toBeNull();

    // Deleting removes the rows and every stored file.
    await deleteProject(env.founder, id);
    expect(existsSync(episodeFile)).toBe(false);
    expect(existsSync(localPath(intent.key))).toBe(false);
    expect(await withOrg(env.founder, (q) => loadProject(q, id))).toBeNull();
  }, 180_000);

  it('without a transcript it still cuts silences, and the agent is not called', async () => {
    const intent = await uploadIntent(env.founder, episodeId, { name: 'raw.mp4', size: 1000, type: 'video/mp4' });
    await writeLocal(intent.key, Readable.toWeb(createReadStream(clip)) as ReadableStream<Uint8Array>, 50 * 1024 * 1024);
    const provider = install(new ScriptedProvider('anthropic', () => ({ text: '{}' })));
    const id = await createProject(env.founder, episodeId, { key: intent.key, name: 'raw.mp4', mime: 'video/mp4', transcript_source: 'none', preset: 'tight' });
    await until(id, env, ['planning']);
    await planProject(env.orgId, id);
    const p = (await withOrg(env.founder, (q) => loadProject(q, id)))!;
    expect(p.status).toBe('review');
    expect(provider.calls).toHaveLength(0);
    expect(p.plan!.cuts.length).toBe(2);
    expect(p.plan!.shorts).toEqual([]);
  }, 120_000);

  it('rejects keys outside the organization and missing uploads', async () => {
    await expect(createProject(env.founder, episodeId, { key: `ward/${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}/${episodeId}/${'1'.repeat(8)}-1111-1111-1111-${'1'.repeat(12)}/x.mp4`, name: 'x.mp4', mime: 'video/mp4', transcript_source: 'none', preset: 'normal' })).rejects.toThrow(/invalid_media_key/);
    const intent = await uploadIntent(env.founder, episodeId, { name: 'never-uploaded.mp4', size: 10, type: 'video/mp4' });
    await expect(createProject(env.founder, episodeId, { key: intent.key, name: 'x.mp4', mime: 'video/mp4', transcript_source: 'none', preset: 'normal' })).rejects.toThrow(/upload_not_found/);
    await expect(uploadIntent(env.founder, episodeId, { name: 'notes.pdf', size: 10, type: 'application/pdf' })).rejects.toThrow(/unsupported_media_type/);
  });
});
