import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminAction } from "@/components/admin-client";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { audit } from "@/lib/audit";
import { one, query } from "@/lib/db";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Customer", robots: { index: false } };

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await pageAdmin();
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
    query<{ id: string; created_at: Date; last_seen_at: Date; ip: string | null; user_agent: string | null; revoked_at: Date | null; expires_at: Date }>(
      `SELECT id, created_at, last_seen_at, ip::text, user_agent, revoked_at, expires_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]),
    query<{ template: string; status: string; error: string | null; created_at: Date }>(`SELECT template, status, error, created_at FROM email_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]),
  ]);
  return (
    <AdminShell title={u.full_name ?? u.email ?? u.id}>
      <div className="card-flat stack">
        <div className="mono">{u.email}</div>
        <div className="row small"><span className="chip">{u.status}</span><span className="chip">{u.role}</span><span>verified: {u.email_verified_at ? fmtDate(u.email_verified_at) : "no"}</span><span>joined {fmtDate(u.created_at)}</span><span>failed logins: {u.failed_logins}</span>{u.locked_until && <span>locked until {fmtDate(u.locked_until)}</span>}</div>
        {u.id !== admin.user.id && (
          <div className="row">
            {u.status === "active"
              ? <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: "disable" }} label="Disable account" danger confirmText="Disable this account and sign it out everywhere?" />
              : <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: "enable" }} label="Re-enable account" />}
            <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: "revoke_sessions" }} label="Sign out all sessions" confirmText="Sign this customer out everywhere?" />
          </div>
        )}
      </div>
      <h2 style={{ fontSize: "1.2rem", marginTop: 24 }}>Inspections</h2>
      <div className="table-wrap"><table className="t"><tbody>
        {inspections.map((i) => <tr key={i.id}><td><Link href={`/admin/inspections/${i.id}`}>{i.brand} {i.model}</Link></td><td><span className="chip">{i.status}</span></td><td className="small">{fmtDate(i.created_at)}</td></tr>)}
      </tbody></table></div>
      <div className="grid-2" style={{ marginTop: 24 }}>
        <section><h2 style={{ fontSize: "1.2rem" }}>Sessions</h2><div className="table-wrap"><table className="t"><tbody>
          {sessions.map((s) => <tr key={s.id}><td className="small">{fmtDate(s.created_at)}<div className="muted">last {fmtDate(s.last_seen_at)}</div></td><td className="small mono">{s.ip ?? "—"}</td><td className="small">{s.revoked_at ? "revoked" : s.expires_at < new Date() ? "expired" : "active"}</td></tr>)}
        </tbody></table></div></section>
        <section><h2 style={{ fontSize: "1.2rem" }}>E-mails</h2><div className="table-wrap"><table className="t"><tbody>
          {emails.map((e, i) => <tr key={i}><td className="small">{e.template}</td><td className="small">{e.status}{e.error ? `: ${e.error}` : ""}</td><td className="small">{fmtDate(e.created_at)}</td></tr>)}
        </tbody></table></div></section>
      </div>
    </AdminShell>
  );
}
