import Link from "next/link";
import { CreateModel } from "@/components/CreateModel";
import { StudioNew } from "@/components/StudioNew";
import { Empty, PageHead, fmtDate } from "@/components/ui";
import { listProjects } from "@/lib/ai/studio/studio";
import { withUser } from "@/lib/db/pool";
import { loadPrimaryModel } from "@/lib/server/data";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "App Studio" };

export default async function StudioPage() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const [m, apps] = await Promise.all([loadPrimaryModel(s), withUser(s.auth.userId, (db) => listProjects(db, s.auth.workspaceId))]);
  if (!m) return (<><PageHead title={t.studio.title} subtitle={t.studio.subtitle} /><CreateModel t={t} /></>);
  return (
    <>
      <PageHead title={t.studio.title} subtitle={t.studio.subtitle} />
      <div className="grid grid-2">
        <section className="card stack">
          <h2>{t.studio.newApp}</h2>
          <StudioNew t={t} />
          <p className="hint small">{t.studio.limitsNote}</p>
        </section>
        <section className="card">
          <h2>{t.studio.title} <span className="muted num">({apps.length})</span></h2>
          {apps.length === 0 ? <Empty>{t.studio.empty}</Empty> : (
            <div className="list">
              {apps.map((a) => (
                <Link key={a.id} href={`/ai/studio/${a.id}`} className="list-item">
                  <div className="grow">
                    <div className="row">
                      <strong className="truncate" dir="auto">{a.name}</strong>
                      {a.publishedSlug && <span className="badge ok">{t.studio.published}</span>}
                    </div>
                    {a.description && <div className="small muted truncate" dir="auto">{a.description}</div>}
                    <div className="tiny muted"><span className="num">{a.versions}</span> {t.studio.versionsCount} · {fmtDate(a.updatedAt, locale)}</div>
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
