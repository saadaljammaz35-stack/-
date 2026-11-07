import Link from "next/link";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { query } from "@/lib/db";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Inspections", robots: { index: false } };
const STATUSES = ["", "draft", "queued", "analyzing", "completed", "failed", "canceled"];

export default async function AdminInspections({ searchParams }: { searchParams: Promise<{ status?: string; review?: string }> }) {
  await pageAdmin();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? "") ? (sp.status ?? "") : "";
  const unreviewed = sp.review === "pending";
  const rows = await query<{ id: string; brand: string; model: string; status: string; created_at: Date; submitted_at: Date | null; email: string | null; report_id: string | null; reviewed_at: Date | null; score: number | null }>(
    `SELECT i.id, i.brand, i.model, i.status, i.created_at, i.submitted_at, u.email, r.id AS report_id, r.reviewed_at, r.condition_score AS score
       FROM inspections i JOIN users u ON u.id = i.user_id
       LEFT JOIN LATERAL (SELECT id, reviewed_at, condition_score FROM reports WHERE inspection_id = i.id AND status = 'published' ORDER BY version DESC LIMIT 1) r ON true
      WHERE ($1 = '' OR i.status = $1) AND (NOT $2 OR (r.id IS NOT NULL AND r.reviewed_at IS NULL))
      ORDER BY COALESCE(i.submitted_at, i.created_at) DESC LIMIT 300`,
    [status, unreviewed],
  );
  return (
    <AdminShell title="Inspections">
      <div className="row small" style={{ marginBottom: 14 }}>
        {STATUSES.map((s) => <Link key={s} className={`chip${s === status && !unreviewed ? " st-completed" : ""}`} href={s ? `/admin/inspections?status=${s}` : "/admin/inspections"}>{s || "all"}</Link>)}
        <Link className={`chip${unreviewed ? " st-completed" : ""}`} href="/admin/inspections?review=pending">reports not reviewed</Link>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Device</th><th>Customer</th><th>Status</th><th>Score</th><th>Reviewed</th><th>Submitted</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/inspections/${r.id}`}>{r.brand} {r.model}</Link></td>
                <td className="mono">{r.email}</td>
                <td><span className={`chip st st-${r.status}`}>{r.status}</span></td>
                <td>{r.score ?? "—"}</td>
                <td>{r.report_id ? (r.reviewed_at ? "yes" : <Link href={`/admin/reports/${r.report_id}`}>review</Link>) : "—"}</td>
                <td className="small">{fmtDate(r.submitted_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
