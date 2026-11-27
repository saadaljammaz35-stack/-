import { env } from '@/lib/env';

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run a multi-statement script without parameters (migrations only). */
  exec(text: string): Promise<void>;
}

export interface Database {
  readonly kind: 'pglite' | 'postgres';
  /**
   * Owner-level access inside one transaction. Use only for migrations, authentication,
   * rate limiting and the job queue. Everything tenant-facing must go through `withOrg`.
   */
  system<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface OrgContext {
  orgId: string;
  userId: string | null;
  /** 'agent' and 'system' are server-side actors; they never come from a request. */
  role: MemberRole | 'agent' | 'system';
  ip?: string | null;
}

/**
 * Run `fn` in a transaction as the restricted `ward_app` role with the tenant pinned via
 * `app.org_id`. Row-level security then guarantees that nothing outside the organization
 * can be read or written, whatever the query says.
 *
 * Never call an AI provider inside `fn`: keep transactions short and do network work outside.
 */
export async function withOrg<T>(ctx: OrgContext, fn: (q: Queryable) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.system(async (q) => {
    await q.query('set local role ward_app');
    await q.query(`select set_config('app.org_id', $1, true), set_config('app.user_id', $2, true)`, [
      ctx.orgId,
      ctx.userId ?? '',
    ]);
    return fn(q);
  });
}

export async function system<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.system(fn);
}

// ───────────────────────── adapters ─────────────────────────

async function createPglite(dataDir: string): Promise<Database> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir !== 'memory://') {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(dataDir, { recursive: true });
  }
  const pg = await PGlite.create(dataDir === 'memory://' ? undefined : dataDir);
  return {
    kind: 'pglite',
    async system(fn) {
      return pg.transaction(async (tx) =>
        fn({
          async query<T>(text: string, params?: unknown[]) {
            return (await tx.query(text, params as unknown[])).rows as T[];
          },
          async exec(text: string) {
            await tx.exec(text);
          },
        }),
      );
    },
    async close() {
      await pg.close();
    },
  };
}

/**
 * json/jsonb parameters. postgres.js JSON.stringify()s every value bound to a json/jsonb
 * parameter, but this codebase passes JSON text (see `json()` below, also used with PGlite):
 * stringifying again stored `{"a":1}` as the JSON *string* "{\"a\":1}". Text passes through.
 */
export const JSON_PARAM_TYPE = {
  to: 114,
  from: [114, 3802],
  serialize: (x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x)),
  parse: (x: string) => JSON.parse(x) as unknown,
};

async function createPostgres(url: string, max: number): Promise<Database> {
  const { default: postgres } = await import('postgres');
  // prepare:false keeps us compatible with Supabase's transaction pooler (port 6543).
  const sql = postgres(url, { max, prepare: false, idle_timeout: 20, connect_timeout: 10, onnotice: () => {}, types: { json: JSON_PARAM_TYPE } });
  return {
    kind: 'postgres',
    async system(fn) {
      return sql.begin(async (tx) =>
        fn({
          async query<T>(text: string, params?: unknown[]) {
            return (await tx.unsafe(text, (params ?? []) as never[])) as unknown as T[];
          },
          async exec(text: string) {
            await tx.unsafe(text);
          },
        }),
      ) as Promise<never>;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}

const globalRef = globalThis as unknown as { __wardDb?: Promise<Database> };

export function getDb(): Promise<Database> {
  if (!globalRef.__wardDb) {
    const e = env();
    globalRef.__wardDb = e.DATABASE_URL
      ? createPostgres(e.DATABASE_URL, e.DB_POOL_MAX)
      : createPglite(e.PGLITE_DATA_DIR).then(async (db) => {
          // Local embedded database: apply migrations and the idempotent seed on first use,
          // so `npm run dev` works out of the box. Hosted Postgres uses `npm run db:migrate`.
          const [{ migrate }, { seed }] = await Promise.all([import('@/lib/db/migrate'), import('@/lib/seed')]);
          globalRef.__wardDb = Promise.resolve(db);
          await migrate(db);
          const founder =
            e.WARD_FOUNDER_EMAIL && e.WARD_FOUNDER_PASSWORD ? { email: e.WARD_FOUNDER_EMAIL, password: e.WARD_FOUNDER_PASSWORD, name: e.WARD_FOUNDER_NAME } : null;
          await seed({ orgSlug: e.WARD_ORG_SLUG, founder });
          return db;
        });
  }
  return globalRef.__wardDb;
}

/** Tests and scripts can install an explicit database (e.g. an in-memory PGlite). */
export async function openDatabase(target: { url?: string; dataDir?: string }): Promise<Database> {
  return target.url ? createPostgres(target.url, 2) : createPglite(target.dataDir ?? 'memory://');
}

export function setDb(db: Database | null): void {
  globalRef.__wardDb = db ? Promise.resolve(db) : undefined;
}

// ───────────────────────── helpers ─────────────────────────

/** Serialize a string list as a Postgres array literal; use with `$n::text[]` / `$n::uuid[]`. */
export function pgArray(values: readonly string[]): string {
  return `{${values.map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
}

export function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function one<T>(q: Queryable, text: string, params?: unknown[]): Promise<T | null> {
  const rows = await q.query<T>(text, params);
  return rows[0] ?? null;
}
