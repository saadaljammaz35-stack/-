import { AdminAction } from "@/components/admin-client";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { adminT } from "@/lib/admin-i18n";
import { query } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Messages", robots: { index: false } };

export default async function AdminMessages() {
  await pageAdmin();
  const locale = await getLocale();
  const t = adminT(locale);
  const rows = await query<{ id: string; name: string; email: string; subject: string; message: string; status: string; created_at: Date }>(
    `SELECT * FROM contact_messages ORDER BY status = 'open' DESC, created_at DESC LIMIT 200`,
  );
  return (
    <AdminShell title={t("t_messages")} locale={locale}>
      {rows.length === 0 && <p className="muted">{t("no_messages")}</p>}
      {rows.map((m) => (
        <div key={m.id} className="card-flat" style={{ marginBottom: 10 }}>
          <div className="spread"><strong>{m.subject}</strong><span className="small muted"><bdi className="mono">{fmtDate(m.created_at)}</bdi> · {m.status === "open" ? t("m_open") : t("m_closed")}</span></div>
          <div className="small"><span>{m.name}</span> · <a className="mono" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}`}>{m.email}</a></div>
          <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{m.message}</p>
          {m.status === "open" && <AdminAction locale={locale} url={`/api/admin/messages/${m.id}`} body={{}} label={t("close")} />}
        </div>
      ))}
    </AdminShell>
  );
}
