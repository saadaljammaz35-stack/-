import { config } from "@/lib/config";
import { safeEqual } from "@/lib/crypto";
import { reportError } from "@/lib/errors";
import { json } from "@/lib/http";
import { runDueJobs } from "@/lib/jobs";
import { pruneRateLimits } from "@/lib/ratelimit";

export const maxDuration = 300;

/** Called every minute by the scheduler with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = config().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return json({ error: { code: "unauthorized" } }, 401);
  try {
    const r = await runDueJobs({ maxJobs: 3, budgetMs: 270_000 });
    if (new Date().getUTCMinutes() === 0) await pruneRateLimits();
    return json(r);
  } catch (e) {
    await reportError("cron:jobs", e);
    return json({ error: { code: "internal" } }, 500);
  }
}
