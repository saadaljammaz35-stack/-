import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminAction } from "@/components/admin-client";
import { AdminShell, fmtDate, usd } from "@/components/admin-nav";
import { StatusChip } from "@/components/status";
import { adminT, attemptLabel, contextLabel, jobLabel, kindLabel, reportStatusLabel, triggerLabel } from "@/lib/admin-i18n";
import { audit } from "@/lib/audit";
import { one, query } from "@/lib/db";
import { t as tr, type Key } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Inspection", robots: { index: false } };

export default async function AdminInspection({ params }: { params: Promise<{ id: string }> }) {
  const admin = await pageAdmin();
  const locale = await getLocale();
  const t = adminT(locale);
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
    <AdminShell title={`${insp.brand} ${insp.model}`} locale={locale}>
      <div className="card-flat stack">
        <div className="row small">
          <StatusChip status={insp.status} locale={locale} />
          <Link className="mono" href={`/admin/users/${insp.user_id}`}>{insp.email}</Link>
          <span>{tr(locale, `cat_${insp.device_category}` as Key)}</span>{insp.storage && <span>{insp.storage}</span>}{insp.color && <span>{insp.color}</span>}
          <span>{t("context")}: {contextLabel(insp.purchase_context, locale)}</span><span>{t("report_lang")}: {insp.report_language === "ar" ? "العربية" : "English"}</span>
        </div>
        {insp.seller_claims && <div className="small"><strong>{t("seller_claims")}:</strong> {insp.seller_claims}</div>}
        <div className="small muted">{t("created")} <bdi className="mono">{fmtDate(insp.created_at)}</bdi> · {t("submitted")} <bdi className="mono">{fmtDate(insp.submitted_at)}</bdi> · {t("completed")} <bdi className="mono">{fmtDate(insp.completed_at)}</bdi></div>
        <div className="row">
          {insp.status === "failed" && <AdminAction locale={locale} url={`/api/admin/inspections/${id}`} body={{ action: "retry" }} label={t("retry_analysis")} />}
          {insp.status === "completed" && <AdminAction locale={locale} url={`/api/admin/inspections/${id}`} body={{ action: "reanalyze" }} label={t("reanalyze")} confirmText={t("reanalyze_confirm")} />}
        </div>
      </div>

      <h2 style={{ fontSize: "1.2rem", marginTop: 22 }}>{t("h_reports")}</h2>
      <div className="table-wrap"><table className="t"><tbody>
        {reports.length === 0 && <tr><td className="muted">{t("no_report")}</td></tr>}
        {reports.map((r) => <tr key={r.id}><td><Link href={`/admin/reports/${r.id}`}>v{r.version}</Link></td><td><span className="chip">{reportStatusLabel(r.status, locale)}</span></td><td>{r.condition_score}/100</td><td>{r.reviewed_at ? `${t("reviewed_at")} ${fmtDate(r.reviewed_at)}` : t("not_reviewed_short")}</td><td className="small mono">{fmtDate(r.created_at)}</td></tr>)}
      </tbody></table></div>

      <h2 style={{ fontSize: "1.2rem", marginTop: 22 }}>{t("h_attempts")}</h2>
      <div className="table-wrap"><table className="t">
        <thead><tr><th>#</th><th>{t("c_outcome")}</th><th>{t("c_model")}</th><th>{t("c_tokens")}</th><th>{t("c_cost")}</th><th>{t("c_error")}</th><th>{t("c_request")}</th><th>{t("c_started")}</th></tr></thead>
        <tbody>{attempts.map((a) => (
          <tr key={a.id}><td>{a.attempt_no}</td><td><span className="chip">{attemptLabel(a.outcome, locale)}</span>{a.stop_reason ? <div className="small muted mono">{a.stop_reason}</div> : null}</td><td className="small mono">{a.model}</td>
            <td className="small" dir="ltr">{a.input_tokens ?? "—"} / {a.output_tokens ?? "—"}</td><td dir="ltr">{usd(a.cost_usd_micros)}</td>
            <td className="small" style={{ maxWidth: 320 }} dir="ltr">{a.error_kind ? `${a.error_kind}${a.http_status ? ` (${a.http_status})` : ""}: ${a.error_message}` : "—"}</td>
            <td className="mono small">{a.request_id ?? "—"}</td><td className="small mono">{fmtDate(a.started_at)}</td></tr>
        ))}</tbody>
      </table></div>

      <h2 style={{ fontSize: "1.2rem", marginTop: 22 }}>{t("h_jobs")}</h2>
      <div className="table-wrap"><table className="t"><tbody>
        {jobs.map((j) => <tr key={j.id}><td><span className="chip">{jobLabel(j.status, locale)}</span></td><td className="small">{triggerLabel(j.trigger, locale)}</td><td className="small">{t("attempts_n")} {j.attempts}/{j.max_attempts}</td><td className="small" dir="ltr">{j.last_error ?? ""}</td><td className="small">{t("next_run")} <bdi className="mono">{fmtDate(j.next_run_at)}</bdi></td></tr>)}
      </tbody></table></div>

      <h2 style={{ fontSize: "1.2rem", marginTop: 22 }}>{t("h_evidence")} ({evidence.length})</h2>
      <div className="ev-grid">
        {evidence.map((e) => (
          <div className="ev-tile" key={e.id}>
            <div className="thumb">{e.status === "ready" && e.kind !== "video" ? <img src={`/api/evidence/${e.id}/file`} alt="" loading="lazy" /> : e.status === "ready" ? <video src={`/api/evidence/${e.id}/file`} controls preload="metadata" /> : <span className="small">{e.status}</span>}</div>
            <div className="meta"><span className="chip">{kindLabel(e.kind, locale)}{e.frame_time_ms != null ? ` @${Math.round(e.frame_time_ms / 1000)}s` : ""}</span>
              <span className="small muted" dir="ltr">{e.original_filename} {e.width ? `${e.width}×${e.height}` : ""} {e.bytes ? `${Math.round(e.bytes / 1024)} KB` : ""}</span>
              {e.rejected_reason && <span className="small" style={{ color: "var(--bad)" }}>{e.rejected_reason}</span>}
              <span className="mono small">{e.sha256?.slice(0, 16)}</span></div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
