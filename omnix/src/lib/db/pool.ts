import "server-only";
import pg from "pg";
import { env } from "@/lib/config/env";
import { log } from "@/lib/log";

export type Db = pg.PoolClient;

const g = globalThis as unknown as { __omnixPool?: pg.Pool; __omnixRoleChecked?: Promise<void> };

export function pool(): pg.Pool {
  if (!g.__omnixPool) {
    const e = env();
    g.__omnixPool = new pg.Pool({
      connectionString: e.DATABASE_URL,
      ssl: e.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
      max: e.DATABASE_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: "omnix",
    });
    g.__omnixPool.on("error", (err) => log.error("db.pool_error", { error: err.message }));
  }
  return g.__omnixPool;
}

/**
 * Row level security only protects anything if the application's database
 * role is subject to it. Refuse to serve requests (in production) from a
 * superuser or a BYPASSRLS role.
 */
async function checkRole(client: pg.PoolClient): Promise<void> {
  const { rows } = await client.query<{ rolsuper: boolean; rolbypassrls: boolean; is_app: boolean }>(
    `SELECT r.rolsuper, r.rolbypassrls, pg_has_role(current_user, 'omnix_app', 'member') AS is_app
       FROM pg_roles r WHERE r.rolname = current_user`,
  );
  const r = rows[0];
  const unsafe = !r || r.rolsuper || r.rolbypassrls || !r.is_app;
  if (unsafe) {
    const msg =
      "DATABASE_URL must connect as a login role that is a member of omnix_app and is neither superuser nor BYPASSRLS; " +
      "otherwise row level security is not enforced.";
    if (env().NODE_ENV === "production") throw new Error(msg);
    log.warn("db.unsafe_role", { message: msg });
  }
}

async function ensureRoleChecked(client: pg.PoolClient): Promise<void> {
  g.__omnixRoleChecked ??= checkRole(client).catch((err) => {
    g.__omnixRoleChecked = undefined;
    throw err;
  });
  await g.__omnixRoleChecked;
}

async function tx<T>(userId: string | null, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await ensureRoleChecked(client);
    await client.query("BEGIN");
    // Transaction-local: the setting disappears at COMMIT/ROLLBACK, so a
    // pooled connection can never carry one user's identity into the next request.
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId ?? ""]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Run `fn` in a transaction where every query is filtered by RLS for `userId`. */
export function withUser<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("withUser requires a uuid");
  return tx(userId, fn);
}

/** Pre-authentication work (login, session lookup). No user context: RLS hides all rows. */
export function withAnon<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return tx(null, fn);
}

export async function closePool(): Promise<void> {
  if (g.__omnixPool) {
    await g.__omnixPool.end();
    g.__omnixPool = undefined;
    g.__omnixRoleChecked = undefined;
  }
}
