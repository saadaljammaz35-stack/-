import { after } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { one, query, tx } from "@/lib/db";
import { conflict, notFound, reportError } from "@/lib/errors";
import { clientIp, json, readJson, route } from "@/lib/http";
import { enqueueAnalysis, runDueJobs } from "@/lib/jobs";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** retry: run a failed analysis again. reanalyze: produce a new report version for a completed one. */
export const POST = route<Ctx>("admin.inspections", async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) throw notFound();
  const { action } = await readJson(req, z.object({ action: z.enum(["retry", "reanalyze"]) }));
  const insp = await one<{ status: string }>(`SELECT status FROM inspections WHERE id = $1`, [id]);
  if (!insp) throw notFound();
  if (action === "retry" && insp.status !== "failed") throw conflict("not_failed", "Only failed inspections can be retried");
  if (action === "reanalyze" && insp.status !== "completed") throw conflict("not_completed", "Only completed inspections can be re-analysed");
  await tx(async (db) => {
    const job = await enqueueAnalysis(id, action === "retry" ? "admin_retry" : "admin_reanalyze", db);
    if (!job) throw conflict("job_running", "An analysis is already queued or running");
    if (action === "retry") await query(`UPDATE inspections SET status = 'queued', updated_at = now() WHERE id = $1`, [id], db);
    await audit(admin.user.id, `admin.inspection_${action}`, { type: "inspection", id }, {}, clientIp(req), db);
  });
  after(() => runDueJobs({ maxJobs: 1, budgetMs: 270_000 }).catch((e) => reportError("jobs:after_admin", e)));
  return json({ ok: true });
});
