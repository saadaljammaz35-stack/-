import { config } from "@/lib/config";
import { one } from "@/lib/db";
import { json } from "@/lib/http";

/** For uptime monitors. Reports what is configured, never secret values. */
export async function GET() {
  const started = Date.now();
  let db = false;
  try {
    db = Boolean(await one(`SELECT 1 AS ok`));
  } catch {
    db = false;
  }
  const c = config();
  const stuck = db
    ? await one<{ n: number }>(`SELECT count(*)::int AS n FROM analysis_jobs WHERE status = 'queued' AND next_run_at < now() - interval '10 minutes'`).catch(() => null)
    : null;
  const body = {
    status: db ? "ok" : "degraded",
    db,
    storage: c.STORAGE_DRIVER,
    email: c.EMAIL_DRIVER,
    ai: Boolean(c.ANTHROPIC_API_KEY),
    overdueJobs: stuck?.n ?? null,
    ms: Date.now() - started,
  };
  return json(body, db ? 200 : 503);
}
