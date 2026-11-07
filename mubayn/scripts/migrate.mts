// Applies db/migrations/*.sql in order, each in its own transaction, and
// records them in schema_migrations. Safe to run repeatedly.
//   DATABASE_URL=... node scripts/migrate.mts
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined;
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  // Serialise concurrent deploys.
  await client.query("SELECT pg_advisory_lock(727274)");
  const dir = path.resolve(import.meta.dirname, "../db/migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Map(
    (await client.query("SELECT name, checksum FROM schema_migrations")).rows.map((r) => [r.name, r.checksum]),
  );
  for (const file of files) {
    const sql = await readFile(path.join(dir, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (applied.has(file)) {
      if (applied.get(file) !== checksum) throw new Error(`Migration ${file} was edited after being applied`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [file, checksum]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
  console.log("migrations up to date");
} finally {
  await client.end();
}
