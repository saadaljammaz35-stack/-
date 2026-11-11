import { ApiButton } from "@/components/ApiButton";
import { MemoryForm } from "@/components/MemoryForm";
import { Empty, PageHead, fmtDate } from "@/components/ui";
import { listMemories } from "@/lib/ai/memory/memory";
import { withUser } from "@/lib/db/pool";
import { loadPrimaryModel } from "@/lib/server/data";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Memory" };

export default async function MemoryPage() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const [m, memories] = await Promise.all([loadPrimaryModel(s), withUser(s.auth.userId, (db) => listMemories(db, s.auth))]);
  const kind: Record<string, string> = { preference: t.memory.preference, fact: t.memory.fact, project: t.memory.project };
  return (
    <>
      <PageHead
        title={t.memory.title}
        subtitle={t.memory.subtitle}
        actions={m && (
          <ApiButton path={`/api/ai/models/${m.profile.id}`} method="PATCH" body={{ memoryEnabled: !m.profile.memoryEnabled }} className={`btn sm ${m.profile.memoryEnabled ? "" : "primary"}`}>
            {m.profile.memoryEnabled ? `${t.memory.enabled} — ${t.model.off}` : `${t.memory.disabled} — ${t.common.open}`}
          </ApiButton>
        )}
      />
      <div className="grid grid-2">
        <section className="card"><h2>{t.memory.add}</h2><MemoryForm t={t} modelId={m?.profile.id ?? null} /></section>
        <section className="card">
          <h2>{t.memory.title} <span className="muted num">({memories.length})</span></h2>
          {memories.length === 0 ? <Empty>{t.common.none}</Empty> : (
            <div className="list">
              {memories.map((x) => (
                <div key={x.id} className="list-item">
                  <div className="grow">
                    <div className="row"><span className="badge accent plain">{kind[x.kind]}</span>{x.source === "approved" && <span className="badge plain">approved</span>}{!x.modelProfileId && <span className="badge plain">all models</span>}</div>
                    <div dir="auto" style={{ marginTop: 6 }}>{x.content}</div>
                    <div className="tiny muted">{fmtDate(x.createdAt, locale)}{x.lastUsedAt ? ` · used ${fmtDate(x.lastUsedAt, locale)}` : ""}</div>
                  </div>
                  <ApiButton path={`/api/ai/memory/${x.id}`} method="DELETE" confirm={t.common.confirmDelete} className="btn icon sm ghost danger">✕</ApiButton>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
