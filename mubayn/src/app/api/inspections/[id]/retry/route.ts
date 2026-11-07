import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { customerRetry, runDueJobs } from "@/lib/jobs";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("inspections.retry", async (_req, { params }) => {
  const s = await requireUser();
  await rateLimit(`retry:${s.user.id}`, 5, 3600);
  const { id } = await params;
  await customerRetry(s.user.id, id);
  after(() => runDueJobs({ maxJobs: 1, budgetMs: 270_000 }).catch((e) => reportError("jobs:after_retry", e)));
  return json({ ok: true });
});
