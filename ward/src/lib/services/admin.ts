import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '@/lib/env';
import { system, withOrg, type OrgContext } from '@/lib/db';
import { audit } from '@/lib/audit';
import { can } from '@/lib/auth/permissions';
import { hashPassword, PASSWORD_MIN_LENGTH, sha256, verifyPassword } from '@/lib/auth/password';
import { badRequest, conflict, forbidden, notFound } from '@/lib/http';
import { AGENT_BY_SLUG, type AgentSlug } from '@/lib/agents/definitions';
import { parseCron } from '@/lib/cron';
import { enqueue } from '@/lib/queue';
import { getSettings, PROVIDERS, setSetting, type ProviderId } from '@/lib/settings';
import { adapterFor } from '@/lib/ai/gateway';
import { optNumber, optText } from '@/lib/services/forms';

// ───────── agents ─────────

export const AgentConfigInput = z.object({
  provider: z.preprocess((v) => (v === '' ? null : v), z.enum(PROVIDERS).nullable()).optional(),
  model: optText(120),
  economy_model: optText(120),
  temperature: z.coerce.number().min(0).max(2).optional(),
  max_tool_iterations: z.coerce.number().int().min(1).max(12).optional(),
  max_output_tokens: z.coerce.number().int().min(256).max(32000).optional(),
  daily_budget_usd: optNumber(0, 1000),
  instructions: optText(8000),
  status: z.enum(['idle', 'paused', 'disabled']).optional(),
  allowed_tools: z.preprocess((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]), z.array(z.string()).optional()),
});

export async function updateAgent(ctx: OrgContext, slug: AgentSlug, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'agents.configure')) throw forbidden();
  const def = AGENT_BY_SLUG[slug];
  if (!def) throw notFound();
  const c = AgentConfigInput.parse(raw);
  // The founder can narrow an agent's tools but never grant tools outside its definition.
  if (c.allowed_tools && c.allowed_tools.some((t) => !def.tools.includes(t))) throw badRequest('tool_outside_agent_definition');
  await withOrg(ctx, async (q) => {
    const agent = (await q.query<{ id: string }>('select id from ward.ai_agents where slug = $1', [slug]))[0];
    if (!agent) throw notFound();
    if (c.instructions !== undefined || c.status !== undefined) {
      await q.query('update ward.ai_agents set instructions = coalesce($2, instructions), status = coalesce($3, status) where id = $1', [agent.id, c.instructions ?? null, c.status ?? null]);
    }
    const map: Record<string, unknown> = {
      provider: c.provider, model: c.model, economy_model: c.economy_model, temperature: c.temperature,
      max_tool_iterations: c.max_tool_iterations, max_output_tokens: c.max_output_tokens, daily_budget_usd: c.daily_budget_usd,
    };
    const sets: string[] = [];
    const params: unknown[] = [agent.id];
    for (const [col, val] of Object.entries(map)) {
      if (val === undefined) continue;
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    }
    if (c.allowed_tools) sets.push(`allowed_tools = $${params.push(`{${c.allowed_tools.join(',')}}`)}::text[]`);
    if (sets.length) await q.query(`update ward.agent_configs set ${sets.join(', ')} where agent_id = $1`, params);
    await audit(q, ctx, 'agent.configured', { type: 'agent', id: agent.id }, { slug, fields: Object.keys(c) });
  });
}

export async function forgetMemory(ctx: OrgContext, memoryId: string): Promise<void> {
  if (!can(ctx.role, 'agents.configure')) throw forbidden();
  await withOrg(ctx, async (q) => {
    await q.query('delete from ward.agent_memories where id = $1', [memoryId]);
    await audit(q, ctx, 'agent.memory_deleted', { type: 'memory', id: memoryId });
  });
}

// ───────── settings ─────────

const money = (max: number) => z.coerce.number().positive().max(max);
export const SettingsInput = z.object({
  'limits.workflow_usd': money(100).optional(),
  'limits.meeting_usd': money(100).optional(),
  'limits.daily_usd': money(1000).optional(),
  'limits.monthly_usd': money(10000).optional(),
  'limits.max_steps': z.coerce.number().int().min(1).max(12).optional(),
  'limits.max_parallel': z.coerce.number().int().min(1).max(6).optional(),
  fallback_order: z.string().optional(),
  models: z.record(z.string(), z.string()).optional(),
  prices: z.string().optional(),
});

export async function updateSettings(ctx: OrgContext, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'settings.write')) throw forbidden();
  const s = SettingsInput.parse(raw);
  await withOrg(ctx, async (q) => {
    const current = await getSettings(q, ctx.orgId);
    for (const key of ['limits.workflow_usd', 'limits.meeting_usd', 'limits.daily_usd', 'limits.monthly_usd', 'limits.max_steps', 'limits.max_parallel'] as const) {
      if (s[key] !== undefined) await setSetting(q, ctx.orgId, key, s[key] as number, ctx.userId);
    }
    if (s.fallback_order !== undefined) {
      const order = s.fallback_order.split(/[,\s]+/).filter(Boolean);
      await setSetting(q, ctx.orgId, 'ai.fallback_order', z.array(z.enum(PROVIDERS)).min(1).parse(order), ctx.userId);
    }
    if (s.models) {
      const next = structuredClone(current['ai.models']);
      for (const [k, v] of Object.entries(s.models)) {
        const [provider, tier] = k.split('.') as [ProviderId, 'standard' | 'economy'];
        if (PROVIDERS.includes(provider) && (tier === 'standard' || tier === 'economy') && v.trim()) next[provider][tier] = v.trim().slice(0, 120);
      }
      await setSetting(q, ctx.orgId, 'ai.models', next, ctx.userId);
    }
    if (s.prices !== undefined) {
      // One price per line: "provider:model input output" in USD per 1M tokens (founder-verified).
      const prices: Record<string, { input: number; output: number; verified: boolean }> = {};
      for (const line of s.prices.split('\n').map((l) => l.trim()).filter(Boolean)) {
        const [key, input, output, cacheRead] = line.split(/\s+/);
        if (!key || !/^[a-z]+:[\w.\-:/]+$/.test(key) || !PROVIDERS.includes(key.split(':')[0] as ProviderId)) throw badRequest('invalid_price_line', line);
        const i = Number(input);
        const o = Number(output);
        if (!Number.isFinite(i) || !Number.isFinite(o) || i < 0 || o < 0) throw badRequest('invalid_price_line', line);
        const c = cacheRead === undefined ? undefined : Number(cacheRead);
        if (c !== undefined && (!Number.isFinite(c) || c < 0)) throw badRequest('invalid_price_line', line);
        prices[key] = { input: i, output: o, ...(c !== undefined ? { cacheRead: c } : {}), verified: true };
      }
      await setSetting(q, ctx.orgId, 'ai.prices', prices, ctx.userId);
    }
    await audit(q, ctx, 'settings.updated', { type: 'settings' }, { keys: Object.keys(s) });
  });
}

/** Real connectivity check: a cheap authenticated call to each configured provider. */
export async function checkIntegrations(ctx: OrgContext): Promise<Record<string, { status: string; error?: string }>> {
  if (!can(ctx.role, 'settings.write')) throw forbidden();
  const e = env();
  const probes: Record<ProviderId, () => Promise<Response>> = {
    openai: () => fetch(`${e.OPENAI_BASE_URL}/models`, { headers: { authorization: `Bearer ${e.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(10_000) }),
    deepseek: () => fetch(`${e.DEEPSEEK_BASE_URL}/models`, { headers: { authorization: `Bearer ${e.DEEPSEEK_API_KEY}` }, signal: AbortSignal.timeout(10_000) }),
    anthropic: () => fetch(`${e.ANTHROPIC_BASE_URL}/v1/models`, { headers: { 'x-api-key': e.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(10_000) }),
    gemini: () => fetch(`${e.GEMINI_BASE_URL}/models`, { headers: { 'x-goog-api-key': e.GEMINI_API_KEY ?? '' }, signal: AbortSignal.timeout(10_000) }),
    ollama: () => fetch(`${e.OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5_000) }),
  };
  const out: Record<string, { status: string; error?: string }> = {};
  for (const p of PROVIDERS) {
    if (!adapterFor(p).configured()) {
      out[p] = { status: 'missing' };
      continue;
    }
    try {
      const res = await probes[p]();
      out[p] = res.ok ? { status: 'ok' } : { status: 'error', error: `HTTP ${res.status}` };
    } catch (err) {
      out[p] = { status: 'error', error: err instanceof Error ? err.message.slice(0, 200) : 'error' };
    }
  }
  await withOrg(ctx, async (q) => {
    for (const [p, r] of Object.entries(out)) {
      await q.query(
        `insert into ward.integrations (org_id, provider, status, last_checked_at, last_error) values ($1,$2,$3,now(),$4)
         on conflict (org_id, provider) do update set status = excluded.status, last_checked_at = now(), last_error = excluded.last_error`,
        [ctx.orgId, p, r.status, r.error ?? null],
      );
    }
    await audit(q, ctx, 'integrations.checked', { type: 'integrations' }, out);
  });
  return out;
}

// ───────── automations ─────────

export const AutomationInput = z.object({
  enabled: z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean()).optional(),
  cron: z.string().trim().max(100).optional(),
  max_cost_usd: z.coerce.number().min(0).max(20).optional(),
  uses_ai: z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean()).optional(),
});

export async function updateAutomation(ctx: OrgContext, id: string, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'settings.write')) throw forbidden();
  const a = AutomationInput.parse(raw);
  if (a.cron) parseCron(a.cron); // throws on an invalid expression
  await withOrg(ctx, async (q) => {
    const rows = await q.query(
      `update ward.automations set enabled = coalesce($2, enabled), cron = coalesce($3, cron), max_cost_usd = coalesce($4, max_cost_usd),
              uses_ai = coalesce($5, uses_ai), next_run_at = null where id = $1 returning id`,
      [id, a.enabled ?? null, a.cron || null, a.max_cost_usd ?? null, a.uses_ai ?? null],
    );
    if (!rows.length) throw notFound();
    await audit(q, ctx, 'automation.updated', { type: 'automation', id }, a);
  });
}

export async function runAutomationNow(ctx: OrgContext, id: string): Promise<void> {
  if (!can(ctx.role, 'settings.write')) throw forbidden();
  await withOrg(ctx, async (q) => {
    const a = (await q.query<{ enabled: boolean }>('select enabled from ward.automations where id = $1', [id]))[0];
    if (!a) throw notFound();
    if (!a.enabled) throw conflict('automation_disabled', 'Enable the automation first.');
    await enqueue(q, ctx.orgId, 'automation.run', { automationId: id, manual: true }, { idempotencyKey: `auto:${id}:manual:${randomUUID()}`, maxAttempts: 1 });
    await audit(q, ctx, 'automation.run_now', { type: 'automation', id });
  });
}

// ───────── members (founder only) ─────────

export const MemberInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  role: z.enum(['admin', 'editor', 'viewer']),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
});

export async function addMember(ctx: OrgContext, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'members.manage')) throw forbidden('missing_permission:members.manage');
  const m = MemberInput.parse(raw);
  const hash = await hashPassword(m.password);
  // Users are global rows: created through system context, then attached to this org only.
  await system(async (q) => {
    const existing = (await q.query<{ id: string }>('select id from ward.users where email = $1', [m.email]))[0];
    const id = existing?.id ?? (await q.query<{ id: string }>('insert into ward.users (email, name, password_hash) values ($1,$2,$3) returning id', [m.email, m.name, hash]))[0]!.id;
    const added = await q.query(`insert into ward.organization_members (org_id, user_id, role) values ($1,$2,$3) on conflict do nothing returning user_id`, [ctx.orgId, id, m.role]);
    if (!added.length) throw conflict('already_a_member');
    await audit(q, ctx, 'member.added', { type: 'user', id }, { email: m.email, role: m.role });
  });
}

export async function changeMemberRole(ctx: OrgContext, userId: string, role: string): Promise<void> {
  if (!can(ctx.role, 'members.manage')) throw forbidden('missing_permission:members.manage');
  const r = z.enum(['admin', 'editor', 'viewer', 'remove']).parse(role);
  if (userId === ctx.userId) throw badRequest('cannot_change_own_role');
  await withOrg(ctx, async (q) => {
    const rows = r === 'remove'
      ? await q.query(`delete from ward.organization_members where user_id = $1 and role <> 'owner' returning user_id`, [userId])
      : await q.query(`update ward.organization_members set role = $2 where user_id = $1 and role <> 'owner' returning user_id`, [userId, r]);
    if (!rows.length) throw notFound();
    await audit(q, ctx, r === 'remove' ? 'member.removed' : 'member.role_changed', { type: 'user', id: userId }, { role: r });
  });
  if (r === 'remove') await system((q) => q.query('update ward.sessions set revoked_at = now() where user_id = $1 and org_id = $2', [userId, ctx.orgId]));
}

// ───────── files ─────────

export async function storeFile(
  ctx: OrgContext,
  file: { name: string; mime: string; data: Uint8Array; purpose: 'knowledge' | 'logo' | 'attachment' | 'episode' | 'agreement'; episodeId?: string | null; sponsorId?: string | null; taskId?: string | null },
): Promise<string> {
  return withOrg(ctx, async (q) => {
    const rows = await q.query<{ id: string }>(
      `insert into ward.stored_files (org_id, name, mime, size, sha256, data, purpose, uploaded_by, episode_id, sponsor_id, task_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [ctx.orgId, file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 200), file.mime, file.data.byteLength, sha256(file.data), Buffer.from(file.data), file.purpose, ctx.userId, file.episodeId ?? null, file.sponsorId ?? null, file.taskId ?? null],
    );
    await audit(q, ctx, 'file.uploaded', { type: 'file', id: rows[0]!.id }, { name: file.name, size: file.data.byteLength, purpose: file.purpose });
    return rows[0]!.id;
  });
}

// ───────── own account ─────────

export const PasswordChange = z
  .object({
    current_password: z.string().min(1).max(200),
    new_password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
    confirm_password: z.string().max(200),
  })
  .refine((v) => v.new_password === v.confirm_password, { message: 'passwords_do_not_match', path: ['confirm_password'] });

/** Any member can change their own password; every other session of theirs is signed out. */
export async function changePassword(ctx: OrgContext & { sessionId?: string }, raw: unknown): Promise<void> {
  if (!ctx.userId) throw forbidden();
  const p = PasswordChange.parse(raw);
  const userId = ctx.userId;
  const current = (await system((q) => q.query<{ password_hash: string }>('select password_hash from ward.users where id = $1', [userId])))[0];
  if (!current || !(await verifyPassword(p.current_password, current.password_hash))) throw badRequest('current_password_incorrect');
  const hash = await hashPassword(p.new_password);
  await system(async (q) => {
    await q.query('update ward.users set password_hash = $2 where id = $1', [userId, hash]);
    await q.query('update ward.sessions set revoked_at = now() where user_id = $1 and id <> $2 and revoked_at is null', [userId, ctx.sessionId ?? '']);
    await audit(q, ctx, 'auth.password_changed', { type: 'user', id: userId });
  });
}
