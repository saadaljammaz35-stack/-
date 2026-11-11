import Link from "next/link";
import { NewDataset } from "@/components/DatasetForms";
import { Empty, PageHead, StatusBadge, fmtDate } from "@/components/ui";
import { datasetFromRow } from "@/lib/ai/training/datasets";
import { withUser } from "@/lib/db/pool";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Datasets" };

export default async function DatasetsPage() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const datasets = await withUser(s.auth.userId, async (db) =>
    (await db.query("SELECT * FROM ai_datasets WHERE owner_id = $1 AND workspace_id = $2 AND status <> 'archived' ORDER BY created_at DESC", [s.auth.userId, s.auth.workspaceId])).rows.map(datasetFromRow),
  );
  return (
    <>
      <PageHead title={t.datasets.title} subtitle={t.datasets.subtitle} />
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="card"><h2>{t.datasets.create}</h2><NewDataset t={t} /></section>
        <section className="card">
          <h2>{t.datasets.title}</h2>
          {datasets.length === 0 ? <Empty>{t.common.none}</Empty> : (
            <div className="list">
              {datasets.map((d) => (
                <Link key={d.id} href={`/ai/datasets/${d.id}`} className="list-item">
                  <div className="grow">
                    <div className="row"><strong>{d.name}</strong><StatusBadge status={d.status} />{d.rightsConfirmedAt && <span className="badge ok plain">{t.datasets.rights} ✓</span>}</div>
                    <div className="tiny muted num">{d.validCount}/{d.recordCount} {t.datasets.valid} · {fmtDate(d.createdAt, locale)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
