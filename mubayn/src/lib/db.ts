import pg from "pg";
import { config } from "./config";

/**
 * PostgreSQL access. One pool per process (cached on globalThis so dev-server
 * reloads do not leak connections). All SQL is parameterised; there is no
 * string-built SQL anywhere in the application.
 */

type Queryable = pg.Pool | pg.PoolClient;

const g = globalThis as unknown as { __mubaynPool?: pg.Pool };

// bigint (int8) as JS number is safe for our counters and micros; amounts are int4.
pg.types.setTypeParser(20, (v) => Number(v));

export function pool(): pg.Pool {
  if (!g.__mubaynPool) {
    const c = config();
    g.__mubaynPool = new pg.Pool({
      connectionString: c.DATABASE_URL,
      max: c.DATABASE_POOL_MAX,
      ssl: c.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
      statement_timeout: 15_000,
      idleTimeoutMillis: 10_000,
    });
    g.__mubaynPool.on("error", (err) => {
      console.error(JSON.stringify({ level: "error", msg: "pg pool error", err: err.message }));
    });
  }
  return g.__mubaynPool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  db: Queryable = pool(),
): Promise<T[]> {
  const res = await db.query<T>(sql, params as unknown[]);
  return res.rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  db: Queryable = pool(),
): Promise<T | null> {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export type Db = Queryable;
