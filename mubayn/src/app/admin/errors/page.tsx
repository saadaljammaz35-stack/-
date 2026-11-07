import { AdminAction } from "@/components/admin-client";
import { AdminShell, fmtDate } from "@/components/admin-nav";
import { adminT } from "@/lib/admin-i18n";
import { query } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { pageAdmin } from "@/lib/page-auth";

export const metadata = { title: "Errors", robots: { index: false } };

export default async function AdminErrors({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await pageAdmin();
  const locale = await getLocale();
  const t = adminT(locale);
  const all = (await searchParams).all === "1";
  const rows = await query<{ id: string; source: string; message: string; stack: string | null; context: unknown; occurrences: number; first_seen: Date; last_seen: Date; resolved_at: Date | null }>(
    `SELECT * FROM error_events WHERE ($1 OR resolved_at IS NULL) ORDER BY last_seen DESC LIMIT 200`,
    [all],
  );
  return (
    <AdminShell title={t("t_errors")} locale={locale}>
      <p className="small muted">{t("errors_intro")} {all ? <a href="/admin/errors">{t("show_open")}</a> : <a href="/admin/errors?all=1">{t("show_all")}</a>}</p>
      {rows.length === 0 && <div className="alert alert-ok">{t("no_errors")}</div>}
      {rows.map((e) => (
        <details key={e.id} className="card-flat" style={{ marginBottom: 10 }}>
          <summary className="spread">
            <span><span className="chip mono">{e.source}</span> <strong dir="ltr">{e.message.slice(0, 160)}</strong></span>
            <span className="small muted">×{e.occurrences} · {t("last")} <bdi className="mono">{fmtDate(e.last_seen)}</bdi>{e.resolved_at ? ` · ${t("resolved")}` : ""}</span>
          </summary>
          <pre className="mono small" dir="ltr" style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(e.context, null, 2)}{"\n"}{e.stack}</pre>
          {!e.resolved_at && <AdminAction locale={locale} url={`/api/admin/errors/${e.id}`} body={{}} label={t("mark_resolved")} />}
        </details>
      ))}
    </AdminShell>
  );
}
