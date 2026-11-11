import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiButton } from "@/components/ApiButton";
import { DatasetUpload, RightsForm } from "@/components/DatasetForms";
import { Empty, PageHead, Stat, StatusBadge, fmtDate } from "@/components/ui";
import { getDataset } from "@/lib/ai/training/datasets";
import { withUser } from "@/lib/db/pool";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Dataset" };

const FILTERS = ["all", "valid", "invalid", "duplicate", "pii_flagged", "pending"] as const;

export default async function DatasetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { id } = await params;
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as (typeof FILTERS)[number]) && status !== "all" ? status! : null;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await requireSession();
  const { t, locale } = await getDict();
  const data = await withUser(s.auth.userId, async (db) => {
    const ds = await getDataset(db, id).catch(() => null);
    if (!ds) return null;
    const items = await db.query(
      `SELECT id, content, source, validation_status, validation_errors, split FROM ai_dataset_items
        WHERE dataset_id = $1 AND ($2::text IS NULL OR validation_status = $2) ORDER BY created_at, id LIMIT 100`,
      [id, filter],
    );
    return { ds, items: items.rows };
  });
  if (!data) notFound();
  const { ds, items } = data;
  const r = ds.lastValidation;
  return (
    <>
      <PageHead title={ds.name} subtitle={ds.description || t.datasets.subtitle} actions={<><StatusBadge status={ds.status} /><Link className="btn sm" href="/ai/datasets">{t.common.back}</Link></>} />
      <div className="grid grid-3" style={{ alignItems: "start" }}>
        <section className="card stack"><h2>{t.common.upload}</h2><DatasetUpload t={t} id={ds.id} /></section>
        <section className="card stack">
          <h2>{t.datasets.validate}</h2>
          <p className="small muted" style={{ margin: 0 }}>{ds.recordCount} {t.datasets.records}</p>
          <ApiButton path={`/api/ai/datasets/${ds.id}/validate`} className="btn primary">{t.datasets.validate}</ApiButton>
          {r && <div className="tiny muted">{fmtDate(r.validatedAt, locale)}</div>}
        </section>
        <section className="card stack">
          <h2>{t.datasets.rights}</h2>
          {ds.rightsConfirmedAt ? (<><div className="alert ok small">✓ {fmtDate(ds.rightsConfirmedAt, locale)}</div><p className="small" dir="auto" style={{ margin: 0 }}>{ds.rightsStatement}</p></>) : <RightsForm t={t} id={ds.id} />}
        </section>
      </div>
      {r && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>{t.datasets.report}</h2>
          <div className="grid grid-4">
            <Stat label={t.datasets.valid} value={`${r.valid}/${r.total}`} />
            <Stat label={t.datasets.duplicates} value={r.duplicates} />
            <Stat label={t.datasets.pii} value={r.piiFlagged} />
            <Stat label={t.datasets.invalid} value={r.invalid} />
          </div>
          <p className="small" style={{ marginTop: 12 }}>
            <b>{t.datasets.splits}:</b> train {r.splits.train} · validation {r.splits.validation} · test {r.splits.test} · tokens ~{r.tokens.total} (median {r.tokens.median}) · Arabic {Math.round(r.arabicShare * 100)}%
          </p>
          {r.readyForTraining ? <div className="alert ok">{t.datasets.ready} — <Link href="/ai/training" style={{ textDecoration: "underline" }}>{t.nav.training}</Link></div> : (
            <div className="alert warn"><div><b>{t.datasets.blockers}:</b><ul style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>{r.blockers.map((b) => <li key={b}>{b}</li>)}</ul></div></div>
          )}
        </section>
      )}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="row between"><h2 style={{ margin: 0 }}>{t.datasets.items}</h2>
          <div className="segmented">{FILTERS.map((f) => <Link key={f} href={`?status=${f}`} aria-current={(filter ?? "all") === f ? "page" : undefined} className="btn sm ghost" style={(filter ?? "all") === f ? { background: "var(--surface)" } : undefined}>{f.replace("_", " ")}</Link>)}</div>
        </div>
        {items.length === 0 ? <Empty>{t.common.none}</Empty> : (
          <div className="list" style={{ marginTop: 8 }}>
            {items.map((it) => (
              <div key={it.id} className="list-item" style={{ alignItems: "flex-start" }}>
                <div className="grow stack" style={{ gap: 4 }}>
                  <div className="row"><StatusBadge status={it.validation_status} />{it.split && <span className="badge plain">{it.split}</span>}<span className="badge plain">{it.source}</span></div>
                  {(it.content.messages as { role: string; content: string }[]).map((msg, i) => (
                    <div key={i} className="small" dir="auto"><b className="muted">{msg.role}:</b> {msg.content.slice(0, 300)}</div>
                  ))}
                  {it.validation_errors?.length > 0 && <div className="tiny" style={{ color: "var(--bad)" }}>{it.validation_errors.join("; ")}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
