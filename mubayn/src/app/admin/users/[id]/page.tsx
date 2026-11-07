import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminAction, AdminRecoveryCode } from "@/components/admin-client";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { StatusChip } from "@/components/status";
import { adminT, userLabel } from "@/lib/admin-i18n";
import { audit } from "@/lib/audit";
import { emailEnabled } from "@/lib/config";
import { one, query } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Customer", robots: { index: false } };

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await pageAdmin();
  const locale = await getLocale();
  const t = adminT(locale);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const u = await one<{ id: string; email: string | null; full_name: string | null; status: string; role: string; locale: string; email_verified_at: Date | null; created_at: Date; failed_logins: number; locked_until: Date | null }>(
    `SELECT id, email, full_name, status, role, locale, email_verified_at, created_at, failed_logins, locked_until FROM users WHERE id = $1 AND status <> 'deleted'`,
    [id],
  );
  if (!u) notFound();
  await audit(admin.user.id, "admin.viewed_customer", { type: "user", id });
  const [inspections, sessions, emails] = await Promise.all([
    query<{ id: string; brand: string; model: string; status: string; created_at: Date }>(`SELECT id, brand, model, status, created_at FROM inspections WHERE user_id = $1 ORDER BY created_at DESC`, [id]),
    query<{ id: string; created_at: Date; last_seen_at: Date; ip: string | null; revoked_at: Date | null; expires_at: Date }>(
      `SELECT id, created_at, last_seen_at, ip::text, revoked_at, expires_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]),
    query<{ template: string; status: string; error: string | null; created_at: Date }>(`SELECT template, status, error, created_at FROM email_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]),
  ]);
  return (
    <AdminShell title={u.full_name ?? u.email ?? u.id} locale={locale}>
      <div className="card-flat stack">
        <div className="mono">{u.email}</div>
        <div className="row small">
          <span className="chip">{userLabel(u.status, locale)}</span><span className="chip">{userLabel(u.role, locale)}</span>
          <span>{t("c_verified")}: {u.email_verified_at ? fmtDate(u.email_verified_at) : t("no")}</span>
          <span>{t("c_joined")}: {fmtDate(u.created_at)}</span><span>{t("failed_logins")}: {u.failed_logins}</span>
          {u.locked_until && <span>{t("locked_until")} {fmtDate(u.locked_until)}</span>}
        </div>
        {u.id !== admin.user.id && (
          <div className="row">
            {u.status === "active"
              ? <AdminAction locale={locale} url={`/api/admin/users/${u.id}`} body={{ action: "disable" }} label={t("disable_account")} danger confirmText={t("disable_confirm")} />
              : <AdminAction locale={locale} url={`/api/admin/users/${u.id}`} body={{ action: "enable" }} label={t("enable_account")} />}
            <AdminAction locale={locale} url={`/api/admin/users/${u.id}`} body={{ action: "revoke_sessions" }} label={t("revoke_sessions")} confirmText={t("revoke_confirm")} />
            {!emailEnabled() && u.role !== "admin" && u.status === "active" && <AdminRecoveryCode userId={u.id} locale={locale} />}
          </div>
        )}
      </div>
      <h2 style={{ fontSize: "1.2rem", marginTop: 24 }}>{t("c_inspections")}</h2>
      <div className="table-wrap"><table className="t"><tbody>
        {inspections.map((i) => <tr key={i.id}><td><Link href={`/admin/inspections/${i.id}`}>{i.brand} {i.model}</Link></td><td><StatusChip status={i.status} locale={locale} /></td><td className="small mono">{fmtDate(i.created_at)}</td></tr>)}
      </tbody></table></div>
      <div className="grid-2" style={{ marginTop: 24 }}>
        <section><h2 style={{ fontSize: "1.2rem" }}>{t("h_sessions")}</h2><div className="table-wrap"><table className="t"><tbody>
          {sessions.map((s) => <tr key={s.id}><td className="small mono">{fmtDate(s.created_at)}<div className="muted">{t("last_seen")} {fmtDate(s.last_seen_at)}</div></td><td className="small mono">{s.ip ?? "—"}</td><td className="small">{s.revoked_at ? t("s_revoked") : s.expires_at < new Date() ? t("s_expired") : t("s_active_session")}</td></tr>)}
        </tbody></table></div></section>
        <section><h2 style={{ fontSize: "1.2rem" }}>{t("h_emails")}</h2><div className="table-wrap"><table className="t"><tbody>
          {emails.map((e, i) => <tr key={i}><td className="small mono">{e.template}</td><td className="small">{e.status}{e.error ? `: ${e.error}` : ""}</td><td className="small mono">{fmtDate(e.created_at)}</td></tr>)}
        </tbody></table></div></section>
      </div>
    </AdminShell>
  );
}
