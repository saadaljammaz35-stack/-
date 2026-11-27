import { openDatabase, setDb, withOrg, type Database, type OrgContext } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { seed } from '@/lib/seed';
import { __setAdapterForTests } from '@/lib/ai/gateway';
import { PROVIDERS, type ProviderId } from '@/lib/settings';
import type { ChatRequest, ChatResult, ProviderAdapter, StreamEvent, ToolCall } from '@/lib/ai/types';

export const FOUNDER = { email: 'founder@ward.test', password: 'correct horse battery staple', name: 'المؤسس' };

export interface TestEnv {
  db: Database;
  orgId: string;
  founderId: string;
  founder: OrgContext;
}

/** A fresh in-memory Postgres (PGlite) with every migration applied and the seed loaded. */
export async function setupDb(): Promise<TestEnv> {
  process.env.WARD_INLINE_JOBS = 'false';
  process.env.WARD_RETRY_BASE_MS = '1';
  for (const k of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'OLLAMA_BASE_URL', 'DATABASE_URL']) delete process.env[k];
  // TEST_DATABASE_URL runs the suite against a real Postgres (postgres.js driver) instead of the
  // in-memory PGlite: the schema is recreated for every setup, so run with --no-file-parallelism.
  const url = process.env.TEST_DATABASE_URL;
  if (url) process.env.DATABASE_URL = url;
  const db = await openDatabase(url ? { url } : { dataDir: 'memory://' });
  if (url) await db.system((q) => q.exec('drop schema if exists ward cascade'));
  setDb(db);
  await migrate(db);
  const s = await seed({ founder: FOUNDER });
  return { db, orgId: s.orgId, founderId: s.founderId!, founder: { orgId: s.orgId, userId: s.founderId!, role: 'owner' } };
}

export async function teardown(env: TestEnv | undefined): Promise<void> {
  for (const p of PROVIDERS) __setAdapterForTests(p, null);
  setDb(null);
  await env?.db.close();
}

export async function addMember(env: TestEnv, email: string, role: 'admin' | 'editor' | 'viewer'): Promise<OrgContext> {
  const { hashPassword } = await import('@/lib/auth/password');
  const id = await env.db.system(async (q) => {
    const u = await q.query<{ id: string }>('insert into ward.users (email, name, password_hash) values ($1,$2,$3) returning id', [email, email, await hashPassword('member password 123')]);
    await q.query('insert into ward.organization_members (org_id, user_id, role) values ($1,$2,$3)', [env.orgId, u[0]!.id, role]);
    return u[0]!.id;
  });
  return { orgId: env.orgId, userId: id, role };
}

export type Reply = Partial<Pick<ChatResult, 'text' | 'toolCalls'>> & { inputTokens?: number; outputTokens?: number; error?: Error; delayMs?: number };

/**
 * TEST-ONLY scripted model. It is installed through `__setAdapterForTests`, which throws in
 * production, so the application itself can never answer with canned output.
 */
export class ScriptedProvider implements ProviderAdapter {
  calls: ChatRequest[] = [];
  inFlight = 0;
  maxInFlight = 0;
  constructor(
    public readonly id: ProviderId,
    private readonly handler: (req: ChatRequest, n: number) => Reply,
  ) {}
  configured() {
    return true;
  }
  async chat(req: ChatRequest): Promise<ChatResult> {
    const n = this.calls.push(req);
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      const r = this.handler(req, n);
      if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
      if (r.error) throw r.error;
      return {
        text: r.text ?? '',
        toolCalls: r.toolCalls ?? [],
        usage: { inputTokens: r.inputTokens ?? 1000, outputTokens: r.outputTokens ?? 200 },
        stopReason: r.toolCalls?.length ? 'tool_use' : 'end_turn',
        provider: this.id,
        model: req.model,
      };
    } finally {
      this.inFlight--;
    }
  }
  async *stream(req: ChatRequest): AsyncGenerator<StreamEvent> {
    const result = await this.chat(req);
    for (const word of result.text.split(' ')) yield { type: 'text', delta: `${word} ` };
    yield { type: 'done', result };
  }
}

export function install(provider: ScriptedProvider): ScriptedProvider {
  __setAdapterForTests(provider.id, provider);
  return provider;
}

export const toolCall = (name: string, args: Record<string, unknown>, id = `t_${name}_${Math.random().toString(36).slice(2, 7)}`): ToolCall => ({ id, name, args });

/** Last user message of a request, for routing scripted replies. */
export const lastUser = (req: ChatRequest) => [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
export const hasToolResult = (req: ChatRequest, name: string) => req.messages.some((m) => m.role === 'tool' && m.name === name);

export async function q1<T>(ctx: OrgContext, sql: string, params: unknown[] = []): Promise<T> {
  return (await withOrg(ctx, (q) => q.query<T>(sql, params)))[0]!;
}

export async function setPrice(env: TestEnv, model: string, input: number, output: number) {
  const { getSettings, setSetting } = await import('@/lib/settings');
  await withOrg(env.founder, async (q) => {
    const s = await getSettings(q, env.orgId);
    await setSetting(q, env.orgId, 'ai.prices', { ...s['ai.prices'], [`anthropic:${model}`]: { input, output, verified: true } }, env.founderId);
  });
}
