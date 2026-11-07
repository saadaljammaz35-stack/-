import { AdminAction } from "@/components/admin-client";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { query } from "@/lib/db";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Messages", robots: { index: false } };

export default async function AdminMessages() {
  await pageAdmin();
  const rows = await query<{ id: string; name: string; email: string; subject: string; message: string; status: string; created_at: Date }>(
    `SELECT * FROM contact_messages ORDER BY status = 'open' DESC, created_at DESC LIMIT 200`,
  );
  return (
    <AdminShell title="Contact messages">
      {rows.length === 0 && <p className="muted">No messages.</p>}
      {rows.map((m) => (
        <div key={m.id} className="card-flat" style={{ marginBottom: 10 }}>
          <div className="spread"><strong>{m.subject}</strong><span className="small muted">{fmtDate(m.created_at)} · {m.status}</span></div>
          <div className="small"><span>{m.name}</span> · <a className="mono" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}`}>{m.email}</a></div>
          <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{m.message}</p>
          {m.status === "open" && <AdminAction url={`/api/admin/messages/${m.id}`} body={{}} label="Close" />}
        </div>
      ))}
    </AdminShell>
  );
}
