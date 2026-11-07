import Link from "next/link";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { query } from "@/lib/db";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "AI jobs", robots: { index: false } };

export default async function AdminJobs() {
  await pageAdmin();
  const jobs = await query<{ id: string; inspection_id: string; status: string; trigger: string; attempts: number; max_attempts: number; last_error: string | null; next_run_at: Date; locked_at: Date | null; created_at: Date; finished_at: Date | null; brand: string; model: string }>(
    `SELECT j.*, i.brand, i.model FROM analysis_jobs j JOIN inspections i ON i.id = j.inspection_id
      ORDER BY (j.status IN ('queued','running')) DESC, (j.status IN ('failed','dead')) DESC, j.updated_at DESC LIMIT 200`,
  );
  const errorsByKind = await query<{ error_kind: string; n: number }>(
    `SELECT error_kind, count(*)::int AS n FROM analysis_attempts WHERE outcome = 'failed' AND started_at > now() - interval '7 days' GROUP BY error_kind ORDER BY n DESC`,
  );
  return (
    <AdminShell title="AI processing">
      <p className="muted small">Jobs run right after submission and every minute from the scheduler. A job that stops responding for 10 minutes is retried automatically. Failed analyses never produce a report.</p>
      {errorsByKind.length > 0 && (
        <div className="row small" style={{ marginBottom: 14 }}>Failures (7 days): {errorsByKind.map((e) => <span key={e.error_kind} className="chip">{e.error_kind}: {e.n}</span>)}</div>
      )}
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Inspection</th><th>Status</th><th>Trigger</th><th>Attempts</th><th>Last error</th><th>Next run</th><th>Created</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td><Link href={`/admin/inspections/${j.inspection_id}`}>{j.brand} {j.model}</Link></td>
                <td><span className="chip">{j.status}</span>{j.locked_at && j.status === "running" ? <div className="small muted">since {fmtDate(j.locked_at)}</div> : null}</td>
                <td className="small">{j.trigger}</td>
                <td>{j.attempts}/{j.max_attempts}</td>
                <td className="small" style={{ maxWidth: 360 }}>{j.last_error ?? "—"}</td>
                <td className="small">{j.status === "queued" ? fmtDate(j.next_run_at) : "—"}</td>
                <td className="small">{fmtDate(j.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
