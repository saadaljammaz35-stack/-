import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminAction } from "@/components/admin-client";
import { AdminShell, fmtDate, usd } from "@/components/admin-nav";
import { audit } from "@/lib/audit";
import { one, query } from "@/lib/db";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Inspection", robots: { index: false } };

export default async function AdminInspection({ params }: { params: Promise<{ id: string }> }) {
  const admin = await pageAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const insp = await one<{ id: string; user_id: string; email: string | null; status: string; device_category: string; brand: string; model: string; storage: string | null; color: string | null; purchase_context: string; seller_claims: string | null; asking_price: string | null; report_language: string; created_at: Date; submitted_at: Date | null; completed_at: Date | null }>(
    `SELECT i.*, u.email FROM inspections i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
    [id],
  );
  if (!insp) notFound();
  await audit(admin.user.id, "admin.viewed_inspection", { type: "inspection", id });
  const [evidence, jobs, attempts, reports] = await Promise.all([
    query<{ id: string; kind: string; status: string; original_filename: string | null; bytes: number | null; sha256: string | null; width: number | null; height: number | null; duration_ms: number | null; frame_time_ms: number | null; rejected_reason: string | null }>(
      `SELECT id, kind, status, original_filename, bytes, sha256, width, height, duration_ms, frame_time_ms, rejected_reason FROM evidence WHERE inspection_id = $1 ORDER BY kind = 'video_frame', created_at`, [id]),
    query<{ id: string; status: string; trigger: string; attempts: number; max_attempts: number; last_error: string | null; created_at: Date; next_run_at: Date; finished_at: Date | null }>(
      `SELECT id, status, trigger, attempts, max_attempts, last_error, created_at, next_run_at, finished_at FROM analysis_jobs WHERE inspection_id = $1 ORDER BY created_at DESC`, [id]),
    query<{ id: string; attempt_no: number; model: string; outcome: string; error_kind: string | null; error_message: string | null; http_status: number | null; input_tokens: number | null; output_tokens: number | null; cost_usd_micros: number | null; request_id: string | null; started_at: Date; finished_at: Date | null; stop_reason: string | null }>(
      `SELECT id, attempt_no, model, outcome, error_kind, error_message, http_status, input_tokens, output_tokens, cost_usd_micros, request_id, started_at, finished_at, stop_reason
         FROM analysis_attempts WHERE inspection_id = $1 ORDER BY started_at DESC`, [id]),
    query<{ id: string; version: number; status: string; condition_score: number; reviewed_at: Date | null; created_at: Date }>(
      `SELECT id, version, status, condition_score, reviewed_at, created_at FROM reports WHERE inspection_id = $1 ORDER BY version DESC`, [id]),
  ]);
  return (
    <AdminShell title={`${insp.brand} ${insp.model}`}>
      <div className="card-flat stack">
        <div className="row small">
          <span className={`chip st st-${insp.status}`}>{insp.status}</span>
          <Link className="mono" href={`/admin/users/${insp.user_id}`}>{insp.email}</Link>
          <span>{insp.device_category}</span><span>{insp.storage}</span><span>{insp.color}</span><span>context: {insp.purchase_context}</span><span>report: {insp.report_language}</span>
        </div>
        {insp.seller_claims && <div className="small"><strong>Seller claims:</strong> {insp.seller_claims}</div>}
        <div className="small muted">created {fmtDate(insp.created_at)} · submitted {fmtDate(insp.submitted_at)} · completed {fmtDate(insp.completed_at)}</div>
        <div className="row">
          {insp.status === "failed" && <AdminAction url={`/api/admin/inspections/${id}`} body={{ action: "retry" }} label="Retry analysis" />}
          {insp.status === "completed" && <AdminAction url={`/api/admin/inspections/${id}`} body={{ action: "reanalyze" }} label="Re-analyse (new report version)" confirmText="This runs a new paid AI analysis and publishes a new version. Continue?" />}
        </div>
      </div>

      <h2 style={{ fontSize: "1.2rem", marginTop: 22 }}>Reports</h2>
      <div className="table-wrap"><table className="t"><tbody>
        {reports.length === 0 && <tr><td className="muted">No report. A report exists only when an analysis succeeded.</td></tr>}
        {reports.map((r) => <tr key={r.id}><td><Link href={`/admin/reports/${r.id}`}>v{r.version}</Link></td><td><span className="chip">{r.status}</span></td><td>{r.condition_score}/100</td><td>{r.reviewed_at ? `reviewed ${fmtDate(r.reviewed_at)}` : "not reviewed"}</td><td className="small">{fmtDate(r.created_at)}</td></tr>)}
      </tbody></table></div>

      <h2 style={{ fontSize: "1.2rem", marginTop: 22 }}>Analysis attempts</h2>
      <div className="table-wrap"><table className="t">
        <thead><tr><th>#</th><th>Outcome</th><th>Model</th><th>Tokens in/out</th><th>Cost</th><th>Error</th><th>Request id</th><th>Started</th></tr></thead>
        <tbody>{attempts.map((a) => (
          <tr key={a.id}><td>{a.attempt_no}</td><td><span className="chip">{a.outcome}</span>{a.stop_reason ? <div className="small muted">{a.stop_reason}</div> : null}</td><td className="small">{a.model}</td>
            <td className="small">{a.input_tokens ?? "—"} / {a.output_tokens ?? "—"}</td><td>{usd(a.cost_usd_micros)}</td>
            <td className="small" style={{ maxWidth: 320 }}>{a.error_kind ? `${a.error_kind}${a.http_status ? ` (${a.http_status})` : ""}: ${a.error_message}` : "—"}</td>
            <td className="mono small">{a.request_id ?? "—"}</td><td className="small">{fmtDate(a.started_at)}</td></tr>
        ))}</tbody>
      </table></div>

      <h2 style={{ fontSize: "1.2rem", marginTop: 22 }}>Jobs</h2>
      <div className="table-wrap"><table className="t"><tbody>
        {jobs.map((j) => <tr key={j.id}><td><span className="chip">{j.status}</span></td><td className="small">{j.trigger}</td><td className="small">attempts {j.attempts}/{j.max_attempts}</td><td className="small">{j.last_error ?? ""}</td><td className="small">next {fmtDate(j.next_run_at)}</td></tr>)}
      </tbody></table></div>

      <h2 style={{ fontSize: "1.2rem", marginTop: 22 }}>Evidence ({evidence.length})</h2>
      <div className="ev-grid">
        {evidence.map((e) => (
          <div className="ev-tile" key={e.id}>
            <div className="thumb">{e.status === "ready" && e.kind !== "video" ? <img src={`/api/evidence/${e.id}/file`} alt="" loading="lazy" /> : e.status === "ready" ? <video src={`/api/evidence/${e.id}/file`} controls preload="metadata" /> : <span className="small">{e.status}</span>}</div>
            <div className="meta"><span className="chip">{e.kind}{e.frame_time_ms != null ? ` @${Math.round(e.frame_time_ms / 1000)}s` : ""}</span>
              <span className="small muted" dir="ltr">{e.original_filename} {e.width ? `${e.width}×${e.height}` : ""} {e.bytes ? `${Math.round(e.bytes / 1024)} KB` : ""}</span>
              {e.rejected_reason && <span className="small" style={{ color: "var(--bad)" }}>{e.rejected_reason}</span>}
              <span className="mono small">{e.sha256?.slice(0, 16)}</span></div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
