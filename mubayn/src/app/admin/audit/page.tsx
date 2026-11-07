import { AdminShell, fmtDate } from "@/components/admin-nav";
import { adminT } from "@/lib/admin-i18n";
import { query } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Audit log", robots: { index: false } };

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await pageAdmin();
  const locale = await getLocale();
  const t = adminT(locale);
  const action = ((await searchParams).action ?? "").slice(0, 60);
  const rows = await query<{ id: number; action: string; target_type: string | null; target_id: string | null; metadata: unknown; ip: string | null; created_at: Date; actor: string | null }>(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.metadata, a.ip::text, a.created_at, u.email AS actor
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
      WHERE ($1 = '' OR a.action LIKE $1 || '%') ORDER BY a.id DESC LIMIT 300`,
    [action],
  );
  return (
    <AdminShell title={t("t_audit")} locale={locale}>
      <form className="row" style={{ marginBottom: 14 }}><input name="action" defaultValue={action} placeholder={t("audit_ph")} style={{ maxWidth: 320 }} dir="ltr" /><button className="btn btn-sm">{t("filter")}</button></form>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>{t("c_time")}</th><th>{t("c_actor")}</th><th>{t("c_action")}</th><th>{t("c_target")}</th><th>{t("c_details")}</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td className="small mono">{fmtDate(r.created_at)}</td><td className="mono small">{r.actor ?? t("system")}</td><td className="small mono">{r.action}</td>
              <td className="mono small">{r.target_type}:{r.target_id?.slice(0, 8)}</td><td className="mono small" style={{ maxWidth: 380, overflowWrap: "anywhere" }}>{JSON.stringify(r.metadata)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </AdminShell>
  );
}
