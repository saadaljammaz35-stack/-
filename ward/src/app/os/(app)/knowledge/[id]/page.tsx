import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { formatDate, label, tr } from '@/lib/i18n';
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledge';
import { Card, Flash, PageHeader } from '@/components/os/ui';
import { ConfirmSubmit } from '@/components/os/client';

export default async function KnowledgeDoc({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const { id } = await params;
  const doc = (await withOrg(session, (q) => q.query<{ id: string; title: string; category: string; source: string; content: string; verified: boolean; status: string; file_id: string | null; file_name: string | null; updated_at: Date }>(
    `select d.id, d.title, d.category, d.source, d.content, d.verified, d.status, d.file_id, f.name as file_name, d.updated_at
       from ward.knowledge_documents d left join ward.stored_files f on f.id = d.file_id where d.id = $1`, [id])))[0];
  if (!doc) notFound();
  const write = can(session.role, 'content.write');
  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <PageHeader title={doc.title} subtitle={`${label(locale, doc.category)} · ${doc.source} · ${formatDate(locale, doc.updated_at, true)}${doc.verified ? ' · ✓' : ''}`}
        actions={doc.file_id ? <a className="btn btn-sm" href={`/api/os/files/${doc.file_id}`}>{doc.file_name}</a> : null} />
      {(doc.source === 'upload' || doc.source === 'agent') && !doc.verified && (
        <div className="notice">{tr(locale, 'هذا المحتوى غير موثّق: يعامله الوكلاء كبيانات غير موثوقة حتى يوثّقه المؤسس.', 'Unverified: agents treat this as untrusted data until the founder verifies it.')}</div>
      )}
      <Card>
        <form action={`/api/os/knowledge/${doc.id}`} method="post" className="stack">
          <fieldset disabled={!write} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <input className="input" name="title" defaultValue={doc.title} maxLength={300} />
            <div className="row">
              <select className="select" style={{ width: 200 }} name="category" defaultValue={doc.category}>{KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{label(locale, c)}</option>)}</select>
              <select className="select" style={{ width: 160 }} name="status" defaultValue={doc.status}><option value="active">{tr(locale, 'نشط', 'Active')}</option><option value="archived">{tr(locale, 'مؤرشف', 'Archived')}</option></select>
              {session.role === 'owner' && <label className="row small"><input type="hidden" name="verified" value="false" /><input type="checkbox" name="verified" value="true" defaultChecked={doc.verified} />{tr(locale, 'موثّق من المؤسس', 'Verified by founder')}</label>}
            </div>
            <textarea className="textarea" name="content" defaultValue={doc.content} style={{ minHeight: 360 }} />
            {write && <div><button className="btn btn-primary">{tr(locale, 'حفظ وإعادة الفهرسة', 'Save & re-index')}</button></div>}
          </fieldset>
        </form>
        {can(session.role, 'knowledge.delete') && (
          <form action={`/api/os/knowledge/${doc.id}`} method="post" style={{ marginTop: 16 }}>
            <input type="hidden" name="_action" value="delete" />
            <ConfirmSubmit className="btn btn-sm btn-danger" message={tr(locale, 'حذف الوثيقة نهائيًا؟', 'Delete permanently?')}>{tr(locale, 'حذف', 'Delete')}</ConfirmSubmit>
          </form>
        )}
      </Card>
    </div>
  );
}
