import Link from "next/link";
import { AdminShell, usd } from "@/components/admin-nav";
import { adminT } from "@/lib/admin-i18n";
import { launchReadiness } from "@/lib/config";
import { one, query } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { pageAdmin } from "@/lib/page-auth";
import { getLimits } from "@/lib/settings";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminHome() {
  await pageAdmin();
  const locale = await getLocale();
  const t = adminT(locale);
  const [users, insp, jobs, cost, timing, open, daily, limits] = await Promise.all([
    one<{ total: number; verified: number; new7: number; disabled: number }>(
      `SELECT count(*) FILTER (WHERE status <> 'deleted')::int AS total,
              count(*) FILTER (WHERE status = 'active' AND email_verified_at IS NOT NULL)::int AS verified,
              count(*) FILTER (WHERE created_at > now() - interval '7 days' AND status <> 'deleted')::int AS new7,
              count(*) FILTER (WHERE status = 'disabled')::int AS disabled FROM users`,
    ),
    query<{ status: string; n: number }>(`SELECT status, count(*)::int AS n FROM inspections GROUP BY status`),
    query<{ status: string; n: number }>(`SELECT status, count(*)::int AS n FROM analysis_jobs GROUP BY status`),
    one<{ today: number; d7: number; d30: number; attempts30: number; failed30: number }>(
      `SELECT COALESCE(sum(cost_usd_micros) FILTER (WHERE started_at >= date_trunc('day', now())),0)::bigint AS today,
              COALESCE(sum(cost_usd_micros) FILTER (WHERE started_at > now() - interval '7 days'),0)::bigint AS d7,
              COALESCE(sum(cost_usd_micros) FILTER (WHERE started_at > now() - interval '30 days'),0)::bigint AS d30,
              count(*) FILTER (WHERE started_at > now() - interval '30 days')::int AS attempts30,
              count(*) FILTER (WHERE started_at > now() - interval '30 days' AND outcome = 'failed')::int AS failed30
         FROM analysis_attempts`,
    ),
    one<{ p50: number | null; p95: number | null }>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM completed_at - submitted_at)) AS p50,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM completed_at - submitted_at)) AS p95
         FROM inspections WHERE completed_at > now() - interval '30 days' AND submitted_at IS NOT NULL`,
    ),
    one<{ errors: number; messages: number }>(
      `SELECT (SELECT count(*)::int FROM error_events WHERE resolved_at IS NULL) AS errors,
              (SELECT count(*)::int FROM contact_messages WHERE status = 'open') AS messages`,
    ),
    query<{ day: string; submitted: number; completed: number; failed: number; cost: number }>(
      `WITH days AS (SELECT generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d)
       SELECT to_char(d, 'YYYY-MM-DD') AS day,
              (SELECT count(*)::int FROM inspections WHERE submitted_at >= d AND submitted_at < d + interval '1 day') AS submitted,
              (SELECT count(*)::int FROM inspections WHERE completed_at >= d AND completed_at < d + interval '1 day') AS completed,
              (SELECT count(*)::int FROM analysis_jobs WHERE status IN ('failed','dead') AND finished_at >= d AND finished_at < d + interval '1 day') AS failed,
              (SELECT COALESCE(sum(cost_usd_micros),0)::bigint FROM analysis_attempts WHERE started_at >= d AND started_at < d + interval '1 day') AS cost
         FROM days ORDER BY d DESC`,
    ),
    getLimits(),
  ]);
  const count = (rows: { status: string; n: number }[], s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  const readiness = launchReadiness();
  const ar = locale === "ar";
  const detail = (d: string) =>
    !ar ? d : d === "missing" ? "غير موجود" : d === "on" ? "مفعّل" : d.startsWith("off:") ? "غير مفعّل: كل الزوار يتشاركون حداً واحداً" : d;
  return (
    <AdminShell title={t("t_overview")} locale={locale}>
      <div className="kpis">
        <div className="kpi"><span>{t("k_customers")}</span><b>{users?.total ?? 0}</b><span>{users?.verified ?? 0} {t("k_verified")} · {users?.new7 ?? 0} {t("k_new7")}</span></div>
        <div className="kpi"><span>{t("k_reports")}</span><b>{count(insp, "completed")}</b><span>{count(insp, "queued") + count(insp, "analyzing")} {t("k_in_progress")} · {count(insp, "failed")} {t("k_failed")}</span></div>
        <div className="kpi"><span>{t("k_jobs")}</span><b>{count(jobs, "queued") + count(jobs, "running")}</b><span>{t("k_queued_running")} · {count(jobs, "dead") + count(jobs, "failed")} {t("k_failed_dead")}</span></div>
        <div className="kpi"><span>{t("k_spend")}</span><b dir="ltr">{usd(cost?.today)}</b><span>{t("k_today")} · <bdi>{usd(cost?.d7)}</bdi> {t("k_7d")} · <bdi>{usd(cost?.d30)}</bdi> {t("k_30d")}</span></div>
        <div className="kpi"><span>{t("k_time")}</span><b dir="ltr">{timing?.p50 != null ? `${Math.round(timing.p50)}s` : "—"}</b><span>{t("k_median")} · p95 <bdi>{timing?.p95 != null ? `${Math.round(timing.p95)}s` : "—"}</bdi></span></div>
        <div className="kpi"><span>{t("k_attention")}</span><b>{(open?.errors ?? 0) + (open?.messages ?? 0)}</b><span><Link href="/admin/errors">{open?.errors ?? 0} {t("k_errors")}</Link> · <Link href="/admin/messages">{open?.messages ?? 0} {t("k_messages")}</Link></span></div>
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <section>
          <h2 style={{ fontSize: "1.2rem" }}>{t("h_last14")}</h2>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>{t("c_day")}</th><th>{t("c_submitted")}</th><th>{t("c_completed")}</th><th>{t("c_failed_jobs")}</th><th>{t("c_cost")}</th></tr></thead>
              <tbody>{daily.map((d) => <tr key={d.day}><td className="mono">{d.day}</td><td>{d.submitted}</td><td>{d.completed}</td><td>{d.failed}</td><td dir="ltr">{usd(d.cost)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="small muted">
            {t("fail_rate")}: {cost && cost.attempts30 ? `${Math.round((cost.failed30 / cost.attempts30) * 100)}%` : "—"} {t("of_attempts")} {cost?.attempts30 ?? 0} {t("attempts_word")}.{" "}
            {t("daily_cap")}: {limits.dailyAnalysesGlobal} {t("submissions")} · {limits.monthlyInspectionsPerUser} {t("per_user_month")}.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: "1.2rem" }}>{t("h_readiness")}</h2>
          <div className="table-wrap">
            <table className="t">
              <tbody>{readiness.map((r) => <tr key={r.item}><td>{r.ok ? "✅" : "❌"}</td><td>{ar ? r.itemAr : r.item}</td><td className="small muted" style={{ overflowWrap: "anywhere" }}><bdi>{detail(r.detail)}</bdi></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
