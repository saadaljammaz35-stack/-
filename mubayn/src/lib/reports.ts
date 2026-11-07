import { z } from "zod";
import { one, query } from "./db";
import { notFound } from "./errors";

export type ReportRow = {
  id: string;
  inspection_id: string;
  user_id: string;
  version: number;
  status: "published" | "superseded" | "withdrawn";
  analysis_attempt_id: string;
  language: "ar" | "en";
  overall_condition: string;
  condition_score: number;
  confidence: string;
  body: ReportBody;
  pdf_storage_key: string | null;
  pdf_sha256: string | null;
  pdf_generated_at: Date | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  created_at: Date;
};

export type ReportBody = {
  device_match: { matches_declared_device: "yes" | "no" | "uncertain"; observed_device: string; reasoning: string };
  evidence_quality: { rating: "good" | "fair" | "poor"; issues: string[] };
  overall_condition: string;
  condition_score: number;
  confidence: string;
  summary: string;
  seller_claims_check: { claim: string; verdict: "consistent" | "contradicted" | "not_verifiable"; explanation: string; evidence_ids: string[] }[];
  areas_not_covered: string[];
  limitations: string[];
  recommended_checks: string[];
  evidence_index: { ref: string; evidence_id: string; kind: string; frame_time_ms: number | null }[];
  validation: { dropped_findings: number };
  model: string;
  prompt_version: string;
};

export type FindingRow = {
  id: string;
  position: number;
  area: string;
  severity: "info" | "minor" | "moderate" | "major" | "critical";
  title: string;
  detail: string;
  confidence: string;
  evidence_ids: string[];
};

export type FullReport = {
  report: ReportRow;
  findings: FindingRow[];
  inspection: { id: string; brand: string; model: string; device_category: string; storage: string | null; color: string | null; seller_claims: string | null; submitted_at: Date | null };
  attempt: { id: string; model: string; prompt_version: string; started_at: Date; finished_at: Date | null; request_id: string | null };
  evidence: { id: string; kind: string; sha256: string; storage_key: string; frame_time_ms: number | null; parent_evidence_id: string | null; label: string | null; original_filename: string | null; ref: string }[];
};

async function load(report: ReportRow | null): Promise<FullReport> {
  if (!report) throw notFound();
  const findings = await query<FindingRow>(`SELECT * FROM findings WHERE report_id = $1 ORDER BY position`, [report.id]);
  const inspection = (await one<FullReport["inspection"]>(
    `SELECT id, brand, model, device_category, storage, color, seller_claims, submitted_at FROM inspections WHERE id = $1`,
    [report.inspection_id],
  ))!;
  const attempt = (await one<FullReport["attempt"]>(
    `SELECT id, model, prompt_version, started_at, finished_at, request_id FROM analysis_attempts WHERE id = $1`,
    [report.analysis_attempt_id],
  ))!;
  const refs = new Map(report.body.evidence_index.map((e) => [e.evidence_id, e.ref]));
  const rows = await query<Omit<FullReport["evidence"][number], "ref">>(
    `SELECT id, kind, sha256, storage_key, frame_time_ms, parent_evidence_id, label, original_filename FROM evidence WHERE id = ANY($1::uuid[])`,
    [[...refs.keys()]],
  );
  const evidence = rows
    .map((r) => ({ ...r, ref: refs.get(r.id)! }))
    .sort((a, b) => Number(a.ref.slice(1)) - Number(b.ref.slice(1)));
  return { report, findings, inspection, attempt, evidence };
}

/** Customer access: the report must belong to the signed-in user. */
export async function getOwnedReport(userId: string, reportId: string): Promise<FullReport> {
  if (!z.string().uuid().safeParse(reportId).success) throw notFound();
  return load(await one<ReportRow>(`SELECT * FROM reports WHERE id = $1 AND user_id = $2 AND status <> 'withdrawn'`, [reportId, userId]));
}

/** Admin access (caller must have passed requireAdmin). */
export async function getReportForAdmin(reportId: string): Promise<FullReport> {
  if (!z.string().uuid().safeParse(reportId).success) throw notFound();
  return load(await one<ReportRow>(`SELECT * FROM reports WHERE id = $1`, [reportId]));
}

export async function latestReportId(inspectionId: string): Promise<string | null> {
  const r = await one<{ id: string }>(
    `SELECT id FROM reports WHERE inspection_id = $1 AND status = 'published' ORDER BY version DESC LIMIT 1`,
    [inspectionId],
  );
  return r?.id ?? null;
}

export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 10).toUpperCase();
}
