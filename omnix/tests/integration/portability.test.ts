import { execFileSync } from "node:child_process";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Regression test for a real portability bug: on hosts where the migration
// role lacks BYPASSRLS (common on managed PostgreSQL), SECURITY DEFINER
// functions owned by it saw no rows under FORCE RLS, so nobody could sign in.
// Migration 0006 moves them to a dedicated role with explicit policies. This
// test migrates a fresh database owned by a plain CREATEROLE role (no
// BYPASSRLS, not superuser) and checks the pre-authentication paths.

const SUPER = process.env.TEST_SUPERUSER_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
const DB = "omnix_test_plain_owner";
const OWNER_URL = `postgres://omnix_plain_owner:plain_owner_dev@localhost:5432/${DB}`;
const APP_URL = `postgres://omnix_app_login:omnix_app_dev@localhost:5432/${DB}`;
const USER_ID = "11111111-1111-4111-8111-111111111111";
const WS_ID = "22222222-2222-4222-8222-222222222222";
let available = true;
let app: pg.Pool;

beforeAll(async () => {
  const su = new pg.Client({ connectionString: SUPER });
  try {
    await su.connect();
  } catch {
    available = false;
    return;
  }
  await su.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  await su.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'omnix_plain_owner') THEN
    CREATE ROLE omnix_plain_owner LOGIN PASSWORD 'plain_owner_dev' CREATEROLE NOBYPASSRLS; END IF; END $$`);
  await su.query(`CREATE DATABASE ${DB} OWNER omnix_plain_owner`);
  // Roles are cluster-wide. On a fresh server the migration creates
  // omnix_definer itself (verified manually); here it already exists, so an
  // administrator grants it — exactly the step the migration's error hints at.
  await su.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'omnix_definer') THEN
    GRANT omnix_definer TO omnix_plain_owner WITH SET TRUE; END IF; END $$`);
  await su.end();
  const su2 = new pg.Client({ connectionString: SUPER.replace(/\/[^/]*$/, `/${DB}`) });
  await su2.connect();
  await su2.query("CREATE EXTENSION IF NOT EXISTS vector"); // extension creation needs a superuser on plain PostgreSQL
  await su2.end();
  execFileSync("node", [path.resolve(import.meta.dirname, "../../scripts/migrate.mts"), "up"], {
    env: { ...process.env, MIGRATION_DATABASE_URL: OWNER_URL, OMNIX_SKIP_BACKUP: "1" },
    stdio: "pipe",
  });
  app = new pg.Pool({ connectionString: APP_URL, max: 2 });
  const c = await app.connect();
  await c.query("BEGIN");
  await c.query("SELECT set_config('app.user_id', $1, true)", [USER_ID]);
  await c.query("INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, 'plain@example.test', repeat('h', 30), 'P')", [USER_ID]);
  await c.query("INSERT INTO workspaces (id, name, owner_id) VALUES ($1, 'W', $2)", [WS_ID, USER_ID]);
  await c.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')", [WS_ID, USER_ID]);
  await c.query("COMMIT");
  c.release();
}, 120_000);

afterAll(async () => {
  await app?.end();
});

describe("migrations on a database whose owner lacks BYPASSRLS", () => {
  it("the owner really has no BYPASSRLS", async () => {
    if (!available) return;
    const r = await app.query("SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'omnix_plain_owner'");
    expect(r.rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
  });

  it("login lookup, membership and lockout work through the definer role", async () => {
    if (!available) return;
    expect((await app.query("SELECT user_id FROM omnix_auth_lookup('plain@example.test')")).rows[0]?.user_id).toBe(USER_ID);
    await app.query("SELECT omnix_auth_record_failure($1)", [USER_ID]);
    const c = await app.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT set_config('app.user_id', $1, true)", [USER_ID]);
      expect((await c.query("SELECT omnix_workspace_role($1) AS r", [WS_ID])).rows[0].r).toBe("owner");
      expect((await c.query("SELECT failed_login_count FROM users")).rows[0].failed_login_count).toBe(1);
      await c.query("ROLLBACK");
    } finally {
      c.release();
    }
  });

  it("no application login can act as the definer role", async () => {
    if (!available) return;
    await expect(app.query("SET ROLE omnix_definer")).rejects.toThrow(/permission denied/);
  });
});
