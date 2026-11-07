import Link from "next/link";
import { AdminShell, usd } from "@/components/admin-nav";
import { launchReadiness } from "@/lib/config";
import { one, query } from "@/lib/db";
import { pageAdmin } from "@/lib/page-auth";
import { getLimits } from "@/lib/settings";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminHome() {
  await pageAdmin();
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
  return (
    <AdminShell title="Overview">
      <div className="kpis">
        <div className="kpi"><span>Customers</span><b>{users?.total ?? 0}</b><span>{users?.verified ?? 0} verified · {users?.new7 ?? 0} new in 7 days</span></div>
        <div className="kpi"><span>Reports completed</span><b>{count(insp, "completed")}</b><span>{count(insp, "queued") + count(insp, "analyzing")} in progress · {count(insp, "failed")} failed</span></div>
        <div className="kpi"><span>AI jobs</span><b>{count(jobs, "queued") + count(jobs, "running")}</b><span>queued/running · {count(jobs, "dead") + count(jobs, "failed")} failed/dead</span></div>
        <div className="kpi"><span>AI spend</span><b>{usd(cost?.today)}</b><span>today · {usd(cost?.d7)} 7d · {usd(cost?.d30)} 30d</span></div>
        <div className="kpi"><span>Time to report</span><b>{timing?.p50 != null ? `${Math.round(timing.p50)}s` : "—"}</b><span>median · p95 {timing?.p95 != null ? `${Math.round(timing.p95)}s` : "—"}</span></div>
        <div className="kpi"><span>Needs attention</span><b>{(open?.errors ?? 0) + (open?.messages ?? 0)}</b><span><Link href="/admin/errors">{open?.errors ?? 0} errors</Link> · <Link href="/admin/messages">{open?.messages ?? 0} messages</Link></span></div>
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <section>
          <h2 style={{ fontSize: "1.2rem" }}>Last 14 days</h2>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Day (UTC)</th><th>Submitted</th><th>Completed</th><th>Failed jobs</th><th>AI cost</th></tr></thead>
              <tbody>{daily.map((d) => <tr key={d.day}><td className="mono">{d.day}</td><td>{d.submitted}</td><td>{d.completed}</td><td>{d.failed}</td><td>{usd(d.cost)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="small muted">Attempt failure rate (30 days): {cost && cost.attempts30 ? `${Math.round((cost.failed30 / cost.attempts30) * 100)}%` : "—"} of {cost?.attempts30 ?? 0} attempts.
            Daily cap: {limits.dailyAnalysesGlobal} submissions · {limits.monthlyInspectionsPerUser} per user per month.</p>
        </section>
        <section>
          <h2 style={{ fontSize: "1.2rem" }}>Launch readiness</h2>
          <div className="table-wrap">
            <table className="t">
              <tbody>{readiness.map((r) => <tr key={r.item}><td>{r.ok ? "✅" : "❌"}</td><td>{r.item}</td><td className="small muted">{r.detail}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
