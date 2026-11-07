import { AdminAction } from "@/components/admin-client";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { query } from "@/lib/db";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Errors", robots: { index: false } };

export default async function AdminErrors({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await pageAdmin();
  const all = (await searchParams).all === "1";
  const rows = await query<{ id: string; source: string; message: string; stack: string | null; context: unknown; occurrences: number; first_seen: Date; last_seen: Date; resolved_at: Date | null }>(
    `SELECT * FROM error_events WHERE ($1 OR resolved_at IS NULL) ORDER BY last_seen DESC LIMIT 200`,
    [all],
  );
  return (
    <AdminShell title="Application errors">
      <p className="small muted">Unexpected errors grouped by cause. Marking one resolved hides it until it happens again. {all ? <a href="/admin/errors">Show open only</a> : <a href="/admin/errors?all=1">Show resolved too</a>}</p>
      {rows.length === 0 && <div className="alert alert-ok">No open errors.</div>}
      {rows.map((e) => (
        <details key={e.id} className="card-flat" style={{ marginBottom: 10 }}>
          <summary className="spread">
            <span><span className="chip">{e.source}</span> <strong>{e.message.slice(0, 160)}</strong></span>
            <span className="small muted">×{e.occurrences} · last {fmtDate(e.last_seen)}{e.resolved_at ? " · resolved" : ""}</span>
          </summary>
          <pre className="mono small" style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(e.context, null, 2)}{"\n"}{e.stack}</pre>
          {!e.resolved_at && <AdminAction url={`/api/admin/errors/${e.id}`} body={{}} label="Mark resolved" />}
        </details>
      ))}
    </AdminShell>
  );
}
