import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Creates (if needed) and migrates the integration-test database. Uses the
 * local PostgreSQL started by scripts/dev-db.sh. Set TEST_DATABASE_URL /
 * TEST_MIGRATION_DATABASE_URL to point at another server.
 */
export default function setup(): void {
  const root = path.resolve(import.meta.dirname, "../..");
  if (!process.env.TEST_MIGRATION_DATABASE_URL) {
    execFileSync("bash", [path.join(root, "scripts/dev-db.sh"), "omnix_test"], {
      stdio: "inherit",
      env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" },
    });
  }
  const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "postgres://omnix_owner:omnix_owner_dev@localhost:5432/omnix_test";
  execFileSync("node", [path.join(root, "scripts/migrate.mts"), "up"], {
    stdio: "inherit",
    env: { ...process.env, MIGRATION_DATABASE_URL: url, OMNIX_SKIP_BACKUP: "1" },
  });
  // Rate-limit windows from earlier runs would otherwise leak into this one.
  execFileSync("psql", [url, "-qc", "TRUNCATE rate_limit_buckets"], { stdio: "inherit" });
  // A run without the Python worker leaves its CPU job queued; the next run's
  // worker would claim that stale job (oldest first) instead of its own.
  execFileSync("psql", [url, "-qc", "UPDATE ai_training_jobs SET status = 'cancelled', status_reason = 'stale job from an earlier test run' WHERE status IN ('queued', 'claimed', 'running')"], {
    stdio: "inherit",
  });
}
