import Link from "next/link";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { adminT, jobLabel, triggerLabel } from "@/lib/admin-i18n";
import { query } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "AI jobs", robots: { index: false } };

export default async function AdminJobs() {
  await pageAdmin();
  const locale = await getLocale();
  const t = adminT(locale);
  const jobs = await query<{ id: string; inspection_id: string; status: string; trigger: string; attempts: number; max_attempts: number; last_error: string | null; next_run_at: Date; locked_at: Date | null; created_at: Date; finished_at: Date | null; brand: string; model: string }>(
    `SELECT j.*, i.brand, i.model FROM analysis_jobs j JOIN inspections i ON i.id = j.inspection_id
      ORDER BY (j.status IN ('queued','running')) DESC, (j.status IN ('failed','dead')) DESC, j.updated_at DESC LIMIT 200`,
  );
  const errorsByKind = await query<{ error_kind: string; n: number }>(
    `SELECT error_kind, count(*)::int AS n FROM analysis_attempts WHERE outcome = 'failed' AND started_at > now() - interval '7 days' GROUP BY error_kind ORDER BY n DESC`,
  );
  return (
    <AdminShell title={t("t_jobs")} locale={locale}>
      <p className="muted small">{t("jobs_intro")}</p>
      {errorsByKind.length > 0 && (
        <div className="row small" style={{ marginBottom: 14 }}>{t("failures_7d")}: {errorsByKind.map((e) => <span key={e.error_kind} className="chip mono">{e.error_kind}: {e.n}</span>)}</div>
      )}
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>{t("c_inspection")}</th><th>{t("c_status")}</th><th>{t("c_trigger")}</th><th>{t("c_attempts")}</th><th>{t("c_last_error")}</th><th>{t("c_next_run")}</th><th>{t("c_created")}</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td><Link href={`/admin/inspections/${j.inspection_id}`}>{j.brand} {j.model}</Link></td>
                <td><span className="chip">{jobLabel(j.status, locale)}</span>{j.locked_at && j.status === "running" ? <div className="small muted">{t("since")} <bdi className="mono">{fmtDate(j.locked_at)}</bdi></div> : null}</td>
                <td className="small">{triggerLabel(j.trigger, locale)}</td>
                <td>{j.attempts}/{j.max_attempts}</td>
                <td className="small" style={{ maxWidth: 360 }} dir="ltr">{j.last_error ?? "—"}</td>
                <td className="small mono">{j.status === "queued" ? fmtDate(j.next_run_at) : "—"}</td>
                <td className="small mono">{fmtDate(j.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
