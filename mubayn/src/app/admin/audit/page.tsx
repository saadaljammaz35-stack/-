import { AdminShell, fmtDate } from "@/components/admin-nav";
import { query } from "@/lib/db";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Audit log", robots: { index: false } };

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await pageAdmin();
  const action = ((await searchParams).action ?? "").slice(0, 60);
  const rows = await query<{ id: number; action: string; target_type: string | null; target_id: string | null; metadata: unknown; ip: string | null; created_at: Date; actor: string | null }>(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.metadata, a.ip::text, a.created_at, u.email AS actor
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
      WHERE ($1 = '' OR a.action LIKE $1 || '%') ORDER BY a.id DESC LIMIT 300`,
    [action],
  );
  return (
    <AdminShell title="Audit log">
      <form className="row" style={{ marginBottom: 14 }}><input name="action" defaultValue={action} placeholder="Filter by action prefix, e.g. admin." style={{ maxWidth: 320 }} /><button className="btn btn-sm">Filter</button></form>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td className="small">{fmtDate(r.created_at)}</td><td className="mono small">{r.actor ?? "system"}</td><td className="small">{r.action}</td>
              <td className="mono small">{r.target_type}:{r.target_id?.slice(0, 8)}</td><td className="mono small" style={{ maxWidth: 380, overflowWrap: "anywhere" }}>{JSON.stringify(r.metadata)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </AdminShell>
  );
}
