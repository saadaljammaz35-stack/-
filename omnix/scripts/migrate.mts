// OMNIX migration runner.
//
//   node scripts/migrate.mts up             apply pending migrations
//   node scripts/migrate.mts down           roll back the most recent migration
//   node scripts/migrate.mts status         list applied / pending
//
// Env:
//   MIGRATION_DATABASE_URL  owner connection (falls back to DATABASE_URL)
//   DATABASE_SSL=true       require TLS with certificate verification
//   OMNIX_BACKUP_DIR        where pre-change pg_dump backups go (default ./backups)
//   OMNIX_SKIP_BACKUP=1     skip the backup (CI only)
//
// Each migration runs in its own transaction and is recorded with a SHA-256
// checksum; editing an applied migration is refused. An advisory lock
// serialises concurrent deploys. Rollback in production requires
// --i-understand-this-destroys-data.
import { readdir, readFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import pg from "pg";

const command = process.argv[2] ?? "up";
const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("MIGRATION_DATABASE_URL (or DATABASE_URL) is required");
  process.exit(1);
}
const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined;
const dir = path.resolve(import.meta.dirname, "../db/migrations");
const LOCK_KEY = 4_206_661; // arbitrary, stable

function redactUrl(u: string): string {
  return u.replace(/\/\/([^:@/]+):[^@/]*@/, "//$1:***@");
}

async function listMigrations(): Promise<{ name: string; up: string; down: string | null }[]> {
  const files = await readdir(dir);
  return files
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort()
    .map((f) => {
      const down = f.replace(/\.sql$/, ".down.sql");
      return { name: f, up: path.join(dir, f), down: files.includes(down) ? path.join(dir, down) : null };
    });
}

function backup(label: string): void {
  if (process.env.OMNIX_SKIP_BACKUP === "1") {
    console.log("backup skipped (OMNIX_SKIP_BACKUP=1)");
    return;
  }
  const which = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
  if (which.status !== 0) {
    console.warn("pg_dump not found — no automatic backup taken. Take a provider snapshot before production changes.");
    return;
  }
  const outDir = path.resolve(process.env.OMNIX_BACKUP_DIR ?? "backups");
  const file = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${label}.dump`);
  mkdirSync(outDir, { recursive: true });
  const res = spawnSync("pg_dump", ["--format=custom", "--no-owner", `--file=${file}`, url!], { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`pg_dump failed; refusing to change the schema without a backup:\n${res.stderr}`);
  }
  console.log(`backup written: ${file}`);
}

const client = new pg.Client({ connectionString: url, ssl });
try {
  await client.connect();
} catch (err) {
  console.error(`cannot connect to ${redactUrl(url)}: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);

  const migrations = await listMigrations();
  const applied = new Map<string, string>(
    (await client.query<{ name: string; checksum: string }>("SELECT name, checksum FROM schema_migrations ORDER BY name"))
      .rows.map((r) => [r.name, r.checksum]),
  );

  if (command === "status") {
    for (const m of migrations) console.log(`${applied.has(m.name) ? "applied" : "pending"}  ${m.name}`);
  } else if (command === "up") {
    const pending = migrations.filter((m) => !applied.has(m.name));
    for (const m of migrations) {
      if (!applied.has(m.name)) continue;
      const sum = createHash("sha256").update(await readFile(m.up, "utf8")).digest("hex");
      if (applied.get(m.name) !== sum) throw new Error(`Migration ${m.name} was edited after being applied`);
    }
    if (pending.length === 0) {
      console.log("migrations up to date");
    } else {
      const ext = await client.query<{ installed: string | null }>(
        "SELECT installed_version AS installed FROM pg_available_extensions WHERE name = 'vector'",
      );
      if (ext.rowCount === 0) {
        throw new Error(
          "The pgvector extension is not available on this PostgreSQL server. Install it " +
            "(e.g. apt install postgresql-16-pgvector, or enable `vector` in Supabase/Neon) and retry.",
        );
      }
      if (applied.size > 0) backup("pre-migrate");
      for (const m of pending) {
        const sql = await readFile(m.up, "utf8");
        const checksum = createHash("sha256").update(sql).digest("hex");
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [m.name, checksum]);
          await client.query("COMMIT");
          console.log(`applied ${m.name}`);
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        }
      }
    }
  } else if (command === "down") {
    const forced = process.argv.includes("--i-understand-this-destroys-data");
    if (process.env.NODE_ENV === "production" && !forced) {
      throw new Error("Refusing to roll back in production without --i-understand-this-destroys-data");
    }
    const last = [...applied.keys()].pop();
    if (!last) {
      console.log("nothing to roll back");
    } else {
      const m = migrations.find((x) => x.name === last);
      if (!m?.down) throw new Error(`No rollback file for ${last}`);
      backup(`pre-rollback-${last.replace(/\.sql$/, "")}`);
      await client.query("BEGIN");
      try {
        await client.query(await readFile(m.down, "utf8"));
        await client.query("DELETE FROM schema_migrations WHERE name = $1", [last]);
        await client.query("COMMIT");
        console.log(`rolled back ${last}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } else {
    throw new Error(`unknown command ${command}`);
  }
} catch (err) {
  const hint = (err as { hint?: string }).hint;
  console.error(`migration failed on ${redactUrl(url)}:`, err instanceof Error ? err.message : err);
  if (hint) console.error(`hint: ${hint}`);
  process.exitCode = 1;
} finally {
  await client.query("SELECT pg_advisory_unlock_all()").catch(() => {});
  await client.end();
}

