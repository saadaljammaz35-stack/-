import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { runDueJobs } from "@/lib/jobs";
import { json, readJson, route } from "@/lib/http";
import { deleteDraft, deviceSchema, getOwnedInspection, listEvidence, updateInspection } from "@/lib/inspections";
import { latestReportId } from "@/lib/reports";
import { one } from "@/lib/db";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("inspections.get", async (_req, { params }) => {
  const s = await requireUser();
  const { id } = await params;
  const insp = await getOwnedInspection(s.user.id, id);
  const evidence = await listEvidence(s.user.id, id);
  const job = await one<{ status: string; attempts: number; max_attempts: number; next_run_at: Date }>(
    `SELECT status, attempts, max_attempts, next_run_at FROM analysis_jobs WHERE inspection_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [id],
  );
  // The customer's status page polls this while waiting. If a job for this
  // inspection is due (e.g. a retry after a provider error), run it now
  // instead of waiting for the scheduler. Claiming uses SKIP LOCKED, so
  // concurrent polls cannot process the same job twice.
  if (insp.status === "queued") {
    const due = await one(`SELECT 1 FROM analysis_jobs WHERE inspection_id = $1 AND status = 'queued' AND next_run_at <= now()`, [id]);
    if (due) after(() => runDueJobs({ maxJobs: 1, budgetMs: 270_000 }).catch((e) => reportError("jobs:after_poll", e)));
  }
  return json({
    id: insp.id,
    status: insp.status,
    reportId: insp.status === "completed" ? await latestReportId(id) : null,
    job: job ? { status: job.status, attempts: job.attempts, maxAttempts: job.max_attempts, nextRunAt: job.next_run_at } : null,
    evidence: evidence.map((e) => ({ id: e.id, kind: e.kind, status: e.status, label: e.label, filename: e.original_filename, durationMs: e.duration_ms })),
  });
});

export const PATCH = route<Ctx>("inspections.update", async (req, { params }) => {
  const s = await requireUser();
  const { id } = await params;
  await updateInspection(s.user.id, id, await readJson(req, deviceSchema));
  return json({ ok: true });
});

export const DELETE = route<Ctx>("inspections.delete", async (_req, { params }) => {
  const s = await requireUser();
  const { id } = await params;
  await deleteDraft(s.user.id, id);
  return json({ ok: true });
});
