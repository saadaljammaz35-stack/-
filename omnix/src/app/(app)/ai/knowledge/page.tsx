import { ApiButton, AutoRefresh } from "@/components/ApiButton";
import { KnowledgeSearch, KnowledgeText, KnowledgeUpload } from "@/components/Knowledge";
import { Empty, PageHead, StatusBadge, fmtDate, fmtNumber } from "@/components/ui";
import { listDocuments } from "@/lib/ai/rag/knowledge";
import { withUser } from "@/lib/db/pool";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Knowledge" };

export default async function KnowledgePage() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const docs = await withUser(s.auth.userId, (db) => listDocuments(db, s.auth.workspaceId));
  const busy = docs.some((d) => d.processingStatus === "pending" || d.processingStatus === "processing");
  const label: Record<string, string> = { pending: t.knowledge.pending, processing: t.knowledge.processing, ready: t.knowledge.ready, failed: t.knowledge.failed };
  return (
    <>
      <AutoRefresh active={busy} />
      <PageHead title={t.knowledge.title} subtitle={t.knowledge.subtitle} actions={<ApiButton path="/api/ai/knowledge/reindex" className="btn sm">{t.knowledge.reindex}</ApiButton>} />
      <div className="grid grid-2">
        <section className="card"><h2>{t.common.upload}</h2><KnowledgeUpload t={t} /></section>
        <section className="card"><h2>{t.knowledge.addText}</h2><KnowledgeText t={t} /></section>
      </div>
      <section className="card" style={{ marginTop: 16 }}><h2>{t.common.search}</h2><KnowledgeSearch t={t} /></section>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.knowledge.title} <span className="muted num">({fmtNumber(docs.length, locale)})</span></h2>
        {docs.length === 0 ? <Empty>{t.common.none}</Empty> : (
          <div className="table-wrap">
            <table className="table responsive">
              <thead><tr><th>{t.knowledge.titleField}</th><th>{t.common.status}</th><th>{t.knowledge.chunks}</th><th>{t.knowledge.tags}</th><th>{t.common.created}</th><th>{t.common.actions}</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td data-label={t.knowledge.titleField}><strong dir="auto">{d.title}</strong><div className="tiny muted ltr">{d.filename} · {(d.byteSize / 1024).toFixed(1)} KB{d.revision > 1 ? ` · rev ${d.revision}` : ""}</div></td>
                    <td data-label={t.common.status}><StatusBadge status={d.processingStatus} label={label[d.processingStatus]} />{d.processingError && <div className="tiny" style={{ color: "var(--bad)" }}>{d.processingError}</div>}</td>
                    <td data-label={t.knowledge.chunks} className="num">{d.chunkCount}</td>
                    <td data-label={t.knowledge.tags}>{d.tags.map((x) => <span key={x} className="badge plain" style={{ marginInlineEnd: 4 }}>{x}</span>)}</td>
                    <td data-label={t.common.created} className="small">{fmtDate(d.createdAt, locale)}</td>
                    <td data-label={t.common.actions}>
                      <div className="row">
                        <ApiButton path={`/api/ai/knowledge/${d.id}/reprocess`} className="btn sm ghost">{t.knowledge.reprocess}</ApiButton>
                        <ApiButton path={`/api/ai/knowledge/${d.id}`} method="DELETE" confirm={t.common.confirmDelete} className="btn sm ghost danger">{t.common.delete}</ApiButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
