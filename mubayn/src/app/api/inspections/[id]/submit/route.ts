import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { submitInspection } from "@/lib/inspections";
import { runDueJobs } from "@/lib/jobs";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("inspections.submit", async (_req, { params }) => {
  const s = await requireUser();
  const { id } = await params;
  await submitInspection(s.user, id);
  // Start right away; the cron runner picks it up if this invocation ends early.
  after(() => runDueJobs({ maxJobs: 1, budgetMs: 270_000 }).catch((e) => reportError("jobs:after_submit", e)));
  return json({ ok: true, status: "queued" });
});
