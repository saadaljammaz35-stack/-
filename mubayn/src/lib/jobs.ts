import { createHash, randomUUID } from "node:crypto";
import { analyze, costMicros, PROMPT_VERSION, type Analysis, type EvidenceInput } from "./ai";
import { audit } from "./audit";
import { config } from "./config";
import { one, query, tx, type Db } from "./db";
import { log, redactSecrets, reportError } from "./errors";
import { analysisCopy, extractFrames, imageInfo } from "./media";
import { estimatePrice } from "./price";
import { storage } from "./storage";

/**
 * Analysis job queue in PostgreSQL (SELECT ... FOR UPDATE SKIP LOCKED), so it
 * works on serverless hosting without a separate queue service. Jobs are run
 * (a) right after submission inside the same request's after() hook and
 * (b) by the cron endpoint every minute, which also recovers stuck jobs.
 *
 * A report is created ONLY from a successful, schema-valid model response.
 * A failed analysis never produces a report.
 */

type JobRow = {
  id: string;
  inspection_id: string;
  status: string;
  trigger: string;
  attempts: number;
  max_attempts: number;
};

const BACKOFF_SECONDS = [60, 300, 900, 1800];
const STALE_MINUTES = 10;

export async function enqueueAnalysis(
  inspectionId: string,
  trigger: "submission" | "customer_retry" | "admin_retry" | "admin_reanalyze",
  db?: Db,
): Promise<string | null> {
  const row = await one<{ id: string }>(
    `INSERT INTO analysis_jobs (inspection_id, trigger) VALUES ($1, $2)
     ON CONFLICT (inspection_id) WHERE status IN ('queued', 'running') DO NOTHING RETURNING id`,
    [inspectionId, trigger],
    db,
  );
  return row?.id ?? null;
}

async function recoverStale(): Promise<void> {
  await query(
    `UPDATE analysis_jobs SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
            locked_at = NULL, locked_by = NULL, last_error = 'worker stopped before finishing (timeout or crash)',
            next_run_at = now(), updated_at = now(),
            finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END
      WHERE status = 'running' AND locked_at < now() - make_interval(mins => $1)`,
    [STALE_MINUTES],
  );
  await query(
    `UPDATE analysis_attempts SET outcome = 'failed', error_kind = 'interrupted', error_message = 'worker stopped before finishing', finished_at = now()
      WHERE outcome = 'running' AND started_at < now() - make_interval(mins => $1)`,
    [STALE_MINUTES],
  );
  // Inspections whose jobs died that way.
  await query(
    `UPDATE inspections i SET status = 'failed', updated_at = now()
      WHERE i.status IN ('queued','analyzing')
        AND NOT EXISTS (SELECT 1 FROM analysis_jobs j WHERE j.inspection_id = i.id AND j.status IN ('queued','running'))
        AND EXISTS (SELECT 1 FROM analysis_jobs j WHERE j.inspection_id = i.id AND j.status = 'dead')`,
  );
}

async function claim(worker: string): Promise<JobRow | null> {
  return one<JobRow>(
    `UPDATE analysis_jobs SET status = 'running', locked_at = now(), locked_by = $1, attempts = attempts + 1, updated_at = now()
      WHERE id = (SELECT id FROM analysis_jobs WHERE status = 'queued' AND next_run_at <= now()
                   ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING id, inspection_id, status, trigger, attempts, max_attempts`,
    [worker],
  );
}

/** Runs due jobs until none are left or the time budget is used. */
export async function runDueJobs(opts: { maxJobs?: number; budgetMs?: number } = {}): Promise<{ ran: number; results: string[] }> {
  const worker = `w-${randomUUID().slice(0, 8)}`;
  const started = Date.now();
  const results: string[] = [];
  await recoverStale();
  while (results.length < (opts.maxJobs ?? 3) && Date.now() - started < (opts.budgetMs ?? 200_000)) {
    const job = await claim(worker);
    if (!job) break;
    try {
      results.push(await runJob(job));
    } catch (e) {
      // runJob handles expected failures itself; this is a bug or infrastructure outage.
      await reportError("jobs:run", e, { jobId: job.id });
      await failJob(job, "internal", e instanceof Error ? e.message : String(e), true);
      results.push(`${job.id}:internal_error`);
    }
  }
  return { ran: results.length, results };
}

type Evidence = {
  id: string;
  user_id: string;
  kind: "image" | "video" | "video_frame";
  parent_evidence_id: string | null;
  storage_key: string;
  sha256: string;
  duration_ms: number | null;
  frame_time_ms: number | null;
  label: string | null;
  original_filename: string | null;
  width: number | null;
  height: number | null;
};

function mmss(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function ensureFrames(video: Evidence): Promise<Evidence[]> {
  const existing = await query<Evidence>(
    `SELECT * FROM evidence WHERE parent_evidence_id = $1 AND kind = 'video_frame' AND status = 'ready' ORDER BY frame_time_ms`,
    [video.id],
  );
  if (existing.length) return existing;
  const buf = await storage().get(video.storage_key);
  const frames = await extractFrames(buf, video.duration_ms ?? 0, 8);
  const out: Evidence[] = [];
  const insp = video.storage_key.split("/e/")[0]!; // u/<uid>/i/<iid>
  for (const f of frames) {
    const id = randomUUID();
    const key = `${insp}/f/${id}.jpg`;
    await storage().put(key, f.jpeg, "image/jpeg");
    const dims = await imageInfo(f.jpeg).catch(() => ({ width: null, height: null }));
    const row = await one<Evidence>(
      `INSERT INTO evidence (id, inspection_id, user_id, kind, parent_evidence_id, storage_key, declared_mime, detected_mime, bytes, sha256,
                             width, height, frame_time_ms, status, verified_at)
       SELECT $1, inspection_id, user_id, 'video_frame', id, $2, 'image/jpeg', 'image/jpeg', $3, $4, $5, $6, $7, 'ready', now()
         FROM evidence WHERE id = $8 RETURNING *`,
      [id, key, f.jpeg.length, createHash("sha256").update(f.jpeg).digest("hex"), dims.width, dims.height, f.timeMs, video.id],
    );
    out.push(row!);
  }
  return out;
}

async function runJob(job: JobRow): Promise<string> {
  const insp = await one<{
    id: string; user_id: string; status: string; device_category: string; brand: string; model: string; storage: string | null;
    color: string | null; purchase_context: string; seller_claims: string | null; asking_price: string | null; report_language: "ar" | "en";
  }>(`SELECT * FROM inspections WHERE id = $1`, [job.inspection_id]);
  if (!insp || insp.status === "canceled") {
    await query(`UPDATE analysis_jobs SET status='canceled', finished_at=now(), updated_at=now() WHERE id=$1`, [job.id]);
    return `${job.id}:canceled`;
  }
  await query(`UPDATE inspections SET status='analyzing', updated_at=now() WHERE id=$1`, [insp.id]);

  // 1. Collect evidence, extracting video frames where needed.
  const primary = await query<Evidence>(
    `SELECT * FROM evidence WHERE inspection_id = $1 AND status = 'ready' AND kind IN ('image','video') ORDER BY created_at`,
    [insp.id],
  );
  const items: { ev: Evidence; caption: string }[] = [];
  let n = 0;
  let v = 0;
  for (const ev of primary.filter((e) => e.kind === "image")) {
    n += 1;
    items.push({ ev, caption: `photo${ev.label ? `, customer caption: "${ev.label.slice(0, 80)}"` : ""}` });
  }
  for (const video of primary.filter((e) => e.kind === "video")) {
    v += 1;
    const frames = await ensureFrames(video);
    for (const f of frames) {
      n += 1;
      items.push({ ev: f, caption: `frame from video V${v}${video.label ? ` ("${video.label.slice(0, 80)}")` : ""} at ${mmss(f.frame_time_ms ?? 0)}` });
    }
  }
  if (items.filter((i) => i.ev.kind === "image").length === 0) {
    await failJob(job, "no_evidence", "No usable photos", false);
    return `${job.id}:no_evidence`;
  }

  // 2. Prepare the exact bytes sent, and keep a copy for traceability.
  const attemptId = randomUUID();
  const inputs: EvidenceInput[] = [];
  const manifest: { ref: string; evidence_id: string; kind: string; original_sha256: string; sent_sha256: string; sent_key: string; frame_time_ms: number | null }[] = [];
  const base = `u/${insp.user_id}/i/${insp.id}/a/${attemptId}`;
  for (const [i, item] of items.entries()) {
    const ref = `E${i + 1}`;
    const original = await storage().get(item.ev.storage_key);
    const jpeg = await analysisCopy(original);
    const sentKey = `${base}/${ref}.jpg`;
    await storage().put(sentKey, jpeg, "image/jpeg");
    inputs.push({ ref, kind: item.ev.kind === "video_frame" ? "video_frame" : "image", jpeg, caption: item.caption });
    manifest.push({
      ref,
      evidence_id: item.ev.id,
      kind: item.ev.kind,
      original_sha256: item.ev.sha256,
      sent_sha256: createHash("sha256").update(jpeg).digest("hex"),
      sent_key: sentKey,
      frame_time_ms: item.ev.frame_time_ms,
    });
  }

  const c = config();
  await query(
    `INSERT INTO analysis_attempts (id, job_id, inspection_id, attempt_no, provider, model, prompt_version, evidence_manifest)
     VALUES ($1,$2,$3,$4,'anthropic',$5,$6,$7)`,
    [attemptId, job.id, insp.id, job.attempts, c.AI_MODEL, PROMPT_VERSION, JSON.stringify(manifest)],
  );

  // 3. Call the model.
  const result = await analyze(
    {
      category: insp.device_category, brand: insp.brand, model: insp.model, storage: insp.storage, color: insp.color,
      purchaseContext: insp.purchase_context, sellerClaims: insp.seller_claims, askingPrice: insp.asking_price, language: insp.report_language,
    },
    inputs,
  );
  const cost = costMicros(c.AI_MODEL, result.inputTokens ?? 0, result.outputTokens ?? 0);

  if (!result.ok) {
    await query(
      `UPDATE analysis_attempts SET outcome='failed', error_kind=$2, error_message=$3, http_status=$4, response_raw=$5, request_id=$6,
              input_tokens=$7, output_tokens=$8, cost_usd_micros=$9, stop_reason=$10, finished_at=now() WHERE id=$1`,
      [attemptId, result.kind, redactSecrets(result.message).slice(0, 2000), result.httpStatus, redactSecrets(JSON.stringify(result.raw ?? null)), result.requestId,
       result.inputTokens ?? null, result.outputTokens ?? null, result.inputTokens ? cost : null, result.stopReason ?? null],
    );
    await failJob(job, result.kind, result.message, result.retryable);
    return `${job.id}:failed:${result.kind}`;
  }

  // 4. Validate citations against what was actually sent.
  const refMap = new Map(manifest.map((m) => [m.ref, m.evidence_id]));
  const { findings, dropped } = mapFindings(result.analysis, refMap);
  if (findings.length === 0 && result.analysis.overall_condition !== "insufficient_evidence") {
    await query(
      `UPDATE analysis_attempts SET outcome='failed', error_kind='no_cited_findings', error_message=$2, response_raw=$3, request_id=$4,
              input_tokens=$5, output_tokens=$6, cost_usd_micros=$7, stop_reason=$8, finished_at=now() WHERE id=$1`,
      [attemptId, `No finding cited valid evidence (${dropped} dropped)`, JSON.stringify(result.raw), result.requestId, result.inputTokens, result.outputTokens, cost, result.stopReason],
    );
    await failJob(job, "no_cited_findings", "The analysis did not cite any of the evidence", true);
    return `${job.id}:failed:no_cited_findings`;
  }

  const score = Math.max(0, Math.min(100, Math.round(result.analysis.condition_score)));

  // 4b. Price from live listings (web search). Best effort: a failure leaves
  // the report without a price and never fails the job.
  const SEV: Record<string, number> = { critical: 0, major: 1, moderate: 2, minor: 3, info: 4 };
  const price = await estimatePrice({
    category: insp.device_category, brand: insp.brand, model: insp.model, storage: insp.storage, color: insp.color,
    askingPrice: insp.asking_price, overallCondition: result.analysis.overall_condition, conditionScore: score,
    mainIssues: findings.filter((f) => f.severity !== "info").sort((a, z) => SEV[a.severity]! - SEV[z.severity]!).slice(0, 5).map((f) => f.title),
    language: insp.report_language,
  });
  if (!price.ok) log("warn", "price estimate unavailable", { inspectionId: insp.id, reason: price.reason });
  const priceCost = costMicros(c.AI_MODEL, price.inputTokens, price.outputTokens, price.searches) ?? 0;
  const totalCost = cost === null ? null : cost + priceCost;
  const totalIn = (result.inputTokens ?? 0) + price.inputTokens;
  const totalOut = (result.outputTokens ?? 0) + price.outputTokens;

  const body = {
    price_estimate: price.ok ? price.estimate : null,
    price_unavailable_reason: price.ok ? null : price.reason,
    ...result.analysis,
    condition_score: score,
    findings: undefined,
    seller_claims_check: result.analysis.seller_claims_check.map((s) => ({
      ...s,
      evidence_ids: s.evidence_refs.map((r) => refMap.get(r.trim().toUpperCase())).filter(Boolean),
      evidence_refs: undefined,
    })),
    evidence_index: manifest.map((m) => ({ ref: m.ref, evidence_id: m.evidence_id, kind: m.kind, frame_time_ms: m.frame_time_ms })),
    validation: { dropped_findings: dropped },
    model: result.model,
    prompt_version: PROMPT_VERSION,
  };

  const reportId = await tx(async (db) => {
    const next = await one<{ v: number }>(`SELECT COALESCE(max(version),0)+1 AS v FROM reports WHERE inspection_id=$1`, [insp.id], db);
    await query(`UPDATE reports SET status='superseded' WHERE inspection_id=$1 AND status='published'`, [insp.id], db);
    const r = await one<{ id: string }>(
      `INSERT INTO reports (inspection_id, user_id, version, analysis_attempt_id, language, overall_condition, condition_score, confidence, body)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [insp.id, insp.user_id, next!.v, attemptId, insp.report_language, result.analysis.overall_condition, score, result.analysis.confidence, JSON.stringify(body)],
      db,
    );
    for (const [i, f] of findings.entries()) {
      await query(
        `INSERT INTO findings (report_id, position, area, severity, title, detail, confidence, evidence_ids) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [r!.id, i + 1, f.area, f.severity, f.title.slice(0, 300), f.detail.slice(0, 4000), f.confidence, f.evidenceIds],
        db,
      );
    }
    await query(
      `UPDATE analysis_attempts SET outcome='succeeded', response_raw=$2, request_id=$3, input_tokens=$4, output_tokens=$5, cost_usd_micros=$6,
              stop_reason=$7, model=$8, finished_at=now() WHERE id=$1`,
      [attemptId, JSON.stringify(result.raw), result.requestId, totalIn, totalOut, totalCost, result.stopReason, result.model],
      db,
    );
    await query(`UPDATE analysis_jobs SET status='succeeded', finished_at=now(), locked_at=NULL, last_error=NULL, updated_at=now() WHERE id=$1`, [job.id], db);
    await query(`UPDATE inspections SET status='completed', completed_at=now(), updated_at=now() WHERE id=$1`, [insp.id], db);
    await audit(null, "report.published", { type: "report", id: r!.id }, { inspection: insp.id, version: next!.v, attempt: attemptId }, null, db);
    return r!.id;
  });

  // 5. PDF (best effort here; the download route regenerates it if missing).
  try {
    const { ensureReportPdf } = await import("./pdf");
    await ensureReportPdf(reportId);
  } catch (e) {
    await reportError("jobs:pdf", e, { reportId });
  }
  // No e-mail: the inspection page opens the report as soon as it exists,
  // and the dashboard lists it.
  log("info", "report published", { reportId, inspectionId: insp.id, costMicros: totalCost, priced: price.ok });
  return `${job.id}:succeeded:${reportId}`;
}

export function mapFindings(a: Analysis, refMap: Map<string, string>) {
  let dropped = 0;
  const findings: { area: string; severity: string; title: string; detail: string; confidence: string; evidenceIds: string[] }[] = [];
  for (const f of a.findings) {
    const ids = [...new Set(f.evidence_refs.map((r) => refMap.get(r.trim().toUpperCase())).filter((x): x is string => Boolean(x)))];
    if (ids.length === 0) {
      dropped += 1;
      continue;
    }
    findings.push({ area: f.area, severity: f.severity, title: f.title, detail: f.detail, confidence: f.confidence, evidenceIds: ids });
  }
  return { findings, dropped };
}

async function failJob(job: JobRow, kind: string, message: string, retryable: boolean): Promise<void> {
  const willRetry = retryable && job.attempts < job.max_attempts;
  const delay = BACKOFF_SECONDS[Math.min(job.attempts - 1, BACKOFF_SECONDS.length - 1)] ?? 900;
  await query(
    `UPDATE analysis_jobs SET status=$2, last_error=$3, locked_at=NULL, locked_by=NULL,
            next_run_at = CASE WHEN $2 = 'queued' THEN now() + make_interval(secs => $4) ELSE next_run_at END,
            finished_at = CASE WHEN $2 = 'queued' THEN NULL ELSE now() END, updated_at=now()
      WHERE id=$1`,
    [job.id, willRetry ? "queued" : retryable ? "dead" : "failed", redactSecrets(`${kind}: ${message}`).slice(0, 2000), delay],
  );
  if (willRetry) {
    await query(`UPDATE inspections SET status='queued', updated_at=now() WHERE id=$1`, [job.inspection_id]);
    return;
  }
  // A re-analysis of an already completed inspection keeps the existing report.
  const hasReport = await one(`SELECT 1 FROM reports WHERE inspection_id=$1 AND status='published'`, [job.inspection_id]);
  // The failure is shown on the inspection page, with a retry button.
  await query(`UPDATE inspections SET status=$2, updated_at=now() WHERE id=$1`, [job.inspection_id, hasReport ? "completed" : "failed"]);
}

/** Customer-initiated retry after a failure. Limited so it cannot be used to farm free analyses. */
export async function customerRetry(userId: string, inspectionId: string): Promise<void> {
  const insp = await one<{ status: string }>(`SELECT status FROM inspections WHERE id=$1 AND user_id=$2`, [inspectionId, userId]);
  if (!insp) {
    const { notFound } = await import("./errors");
    throw notFound();
  }
  const { conflict } = await import("./errors");
  if (insp.status !== "failed") throw conflict("not_failed", "Only a failed analysis can be retried");
  const retries = await one<{ n: number }>(`SELECT count(*)::int AS n FROM analysis_jobs WHERE inspection_id=$1 AND trigger='customer_retry'`, [inspectionId]);
  if ((retries?.n ?? 0) >= 2) throw conflict("retry_limit", "This inspection was already retried twice. Contact support.");
  await tx(async (db) => {
    await query(`UPDATE inspections SET status='queued', updated_at=now() WHERE id=$1`, [inspectionId], db);
    await enqueueAnalysis(inspectionId, "customer_retry", db);
    await audit(userId, "analysis.customer_retry", { type: "inspection", id: inspectionId }, {}, null, db);
  });
}
