import Link from 'next/link';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { dict, formatDate, label, tr } from '@/lib/i18n';
import { KNOWLEDGE_CATEGORIES, searchKnowledge, type KnowledgeCategory } from '@/lib/knowledge';
import { Card, Empty, Flash, PageHeader } from '@/components/os/ui';

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const sp = await searchParams;
  const category = KNOWLEDGE_CATEGORIES.includes(sp.category as KnowledgeCategory) ? (sp.category as KnowledgeCategory) : undefined;
  const query = sp.q?.trim().slice(0, 300) ?? '';
  const d = await withOrg(session, async (q) => ({
    hits: query ? await searchKnowledge(q, query, 10, category) : [],
    docs: await q.query<{ id: string; title: string; category: string; source: string; verified: boolean; status: string; updated_at: Date; chunks: number }>(
      `select d.id, d.title, d.category, d.source, d.verified, d.status, d.updated_at, (select count(*)::int from ward.knowledge_chunks c where c.document_id = d.id) as chunks
         from ward.knowledge_documents d where ($1::text is null or d.category = $1) order by d.updated_at desc limit 200`, [category ?? null]),
  }));
  const write = can(session.role, 'content.write');
  return (
    <div className="stack">
      <Flash params={sp} />
      <PageHeader title={t.nav.knowledge} subtitle={tr(locale, 'ما يعرفه الفريق عن وارد. الوكلاء يسترجعون منه عند الحاجة، ويُمنعون من اختلاق ما ليس فيه. ✓ = موثّق من المؤسس.', 'What the team knows about WARD. Agents retrieve from it and must not invent what is not here. ✓ = verified by the founder.')} />
      <form className="row" method="get">
        <input className="input" style={{ flex: 1, minWidth: 220 }} name="q" defaultValue={query} placeholder={tr(locale, 'ابحث في الذاكرة…', 'Search memory…')} />
        <select className="select" style={{ width: 180 }} name="category" defaultValue={category ?? ''}>
          <option value="">{t.common.all}</option>
          {KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{label(locale, c)}</option>)}
        </select>
        <button className="btn">{t.common.search}</button>
      </form>
      {query && (
        <Card title={tr(locale, `نتائج الاسترجاع لـ «${query}»`, `Retrieval results for “${query}”`)}>
          {d.hits.length ? <div className="list">{d.hits.map((h) => (
            <Link key={h.chunkId} href={`/os/knowledge/${h.documentId}`} className="stack" style={{ gap: 4 }}>
              <span className="spread"><span style={{ fontWeight: 500 }}>{h.title} {h.verified && '✓'}</span><span className="small faint ltr">{h.score.toFixed(2)}</span></span>
              <span className="small muted">{h.content.slice(0, 280)}…</span>
            </Link>
          ))}</div> : <Empty>{tr(locale, 'لا توجد نتائج.', 'No results.')}</Empty>}
        </Card>
      )}
      {write && (
        <div className="grid-2">
          <Card title={tr(locale, 'رفع ملف (PDF · DOCX · TXT · صورة)', 'Upload (PDF · DOCX · TXT · image)')}>
            <form action="/api/os/knowledge/upload" method="post" encType="multipart/form-data" className="stack">
              <input className="input" type="file" name="file" required accept=".pdf,.docx,.txt,.md,.csv,image/png,image/jpeg,image/webp" />
              <input className="input" name="title" placeholder={tr(locale, 'العنوان (اختياري)', 'Title (optional)')} maxLength={300} />
              <select className="select" name="category" defaultValue="files">{KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{label(locale, c)}</option>)}</select>
              <textarea className="textarea" name="description" placeholder={tr(locale, 'وصف (مطلوب للصور: لا يوجد OCR)', 'Description (required for images: no OCR)')} />
              <button className="btn btn-primary">{tr(locale, 'رفع وفهرسة', 'Upload & index')}</button>
            </form>
          </Card>
          <Card title={tr(locale, 'إضافة معلومة', 'Add a fact')}>
            <form action="/api/os/knowledge" method="post" className="stack">
              <input className="input" name="title" required maxLength={300} placeholder={tr(locale, 'العنوان', 'Title')} />
              <select className="select" name="category" defaultValue="decisions">{KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{label(locale, c)}</option>)}</select>
              <textarea className="textarea" name="content" required placeholder={tr(locale, 'المحتوى', 'Content')} />
              <button className="btn btn-primary">{tr(locale, 'حفظ', 'Save')}</button>
            </form>
          </Card>
        </div>
      )}
      <Card title={`${tr(locale, 'الوثائق', 'Documents')} (${d.docs.length})`}>
        {d.docs.length ? (
          <div className="table-wrap"><table className="table"><tbody>
            {d.docs.map((x) => (
              <tr key={x.id}>
                <td><Link href={`/os/knowledge/${x.id}`} style={{ fontWeight: 500 }}>{x.title}</Link> {x.verified && <span title="verified">✓</span>}{x.status === 'archived' && <span className="small faint"> · {tr(locale, 'مؤرشف', 'archived')}</span>}</td>
                <td className="small">{label(locale, x.category)}</td>
                <td className="small faint">{x.source}</td>
                <td className="small faint">{x.chunks}</td>
                <td className="small faint">{formatDate(locale, x.updated_at)}</td>
              </tr>
            ))}
          </tbody></table></div>
        ) : <Empty>—</Empty>}
      </Card>
    </div>
  );
}
