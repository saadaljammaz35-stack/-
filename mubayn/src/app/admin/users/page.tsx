import Link from "next/link";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { adminT, userLabel } from "@/lib/admin-i18n";
import { query } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Customers", robots: { index: false } };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await pageAdmin();
  const locale = await getLocale();
  const t = adminT(locale);
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
    <AdminShell title={t("t_customers")} locale={locale}>
      <form className="row" style={{ marginBottom: 14 }}><input name="q" defaultValue={q} placeholder={t("search_ph")} style={{ maxWidth: 360 }} /><button className="btn btn-sm">{t("search")}</button></form>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>{t("c_customer")}</th><th>{t("c_status")}</th><th>{t("c_verified")}</th><th>{t("c_inspections")}</th><th>{t("c_reports")}</th><th>{t("c_joined")}</th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`}><strong>{u.full_name ?? "—"}</strong></Link><div className="mono">{u.email}</div></td>
                <td><span className="chip">{userLabel(u.status, locale)}{u.role === "admin" ? ` · ${userLabel("admin", locale)}` : ""}</span></td>
                <td>{u.email_verified_at ? t("yes") : t("no")}</td>
                <td>{u.inspections}</td><td>{u.reports}</td><td className="small mono">{fmtDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
