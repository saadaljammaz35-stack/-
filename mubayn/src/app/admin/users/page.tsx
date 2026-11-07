import Link from "next/link";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { query } from "@/lib/db";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Customers", robots: { index: false } };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await pageAdmin();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const rows = await query<{ id: string; email: string | null; full_name: string | null; status: string; role: string; email_verified_at: Date | null; created_at: Date; inspections: number; reports: number }>(
    `SELECT u.id, u.email, u.full_name, u.status, u.role, u.email_verified_at, u.created_at,
            (SELECT count(*)::int FROM inspections i WHERE i.user_id = u.id) AS inspections,
            (SELECT count(*)::int FROM reports r WHERE r.user_id = u.id AND r.status = 'published') AS reports
       FROM users u
      WHERE u.status <> 'deleted' AND ($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.full_name ILIKE '%' || $1 || '%')
      ORDER BY u.created_at DESC LIMIT 200`,
    [q],
  );
  return (
    <AdminShell title="Customers">
      <form className="row" style={{ marginBottom: 14 }}><input name="q" defaultValue={q} placeholder="Search e-mail or name" style={{ maxWidth: 360 }} /><button className="btn btn-sm">Search</button></form>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Customer</th><th>Status</th><th>Verified</th><th>Inspections</th><th>Reports</th><th>Joined</th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`}><strong>{u.full_name ?? "—"}</strong></Link><div className="mono">{u.email}</div></td>
                <td><span className="chip">{u.status}{u.role === "admin" ? " · admin" : ""}</span></td>
                <td>{u.email_verified_at ? "yes" : "no"}</td>
                <td>{u.inspections}</td><td>{u.reports}</td><td className="small">{fmtDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
