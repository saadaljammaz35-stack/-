import Link from "next/link";
import { StudioNew } from "@/components/StudioNew";
import { fmtDate } from "@/components/ui";
import { listProjects } from "@/lib/ai/studio/studio";
import { withUser } from "@/lib/db/pool";
import { loadPrimaryModel } from "@/lib/server/data";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "App Studio" };

export default async function StudioPage() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const [m, apps] = await Promise.all([loadPrimaryModel(s), withUser(s.auth.userId, (db) => listProjects(db, s.auth.workspaceId))]);
  return (
    <div className="studio-home">
      <section className="card glass studio-hero">
        <StudioNew t={t} hasModel={Boolean(m)} ownerName={s.user.displayName} />
      </section>
      {apps.length > 0 && (
        <section className="stack">
          <h2>{t.studio.yourApps} <span className="muted num">({apps.length})</span></h2>
          <div className="studio-cards">
            {apps.map((a) => (
              <Link key={a.id} href={`/ai/studio/${a.id}`} className="card studio-card">
                <div className="row between">
                  <strong className="truncate" dir="auto">{a.name}</strong>
                  {a.publishedSlug && <span className="badge ok">{t.studio.published}</span>}
                </div>
                {a.description && <div className="small muted studio-card-desc" dir="auto">{a.description}</div>}
                <div className="tiny muted"><span className="num">{a.versions}</span> {t.studio.versionsCount} · {fmtDate(a.updatedAt, locale)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
