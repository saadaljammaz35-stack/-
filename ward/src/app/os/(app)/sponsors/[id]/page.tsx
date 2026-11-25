import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { formatDate, label, money, tr } from '@/lib/i18n';
import { Card, Empty, Flash, PageHeader, StatusBadge } from '@/components/os/ui';

const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default async function SponsorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const { id } = await params;
  const d = await withOrg(session, async (q) => {
    const s = (await q.query<{ id: string; name: string; name_pending: boolean; logo_file_id: string | null; category: string | null; sponsorship_type: string | null; contact: { name?: string; email?: string; phone?: string }; agreement_start: Date | null; agreement_end: Date | null; value_amount: number | null; currency: string; visibility_rights: string; logo_use_approved: boolean; status: string; notes: string }>(
      `select id, name, name_pending, logo_file_id, category, sponsorship_type, contact, agreement_start, agreement_end, value_amount::float8, currency, visibility_rights, logo_use_approved, status, notes from ward.sponsors where id = $1`, [id]))[0];
    if (!s) return null;
    const deliverables = await q.query<{ id: string; title: string; due_at: Date | null; status: string; proof_url: string | null; episode: string | null }>(
      `select d.id, d.title, d.due_at, d.status, d.proof_url, e.title as episode from ward.sponsorship_deliverables d left join ward.episodes e on e.id = d.episode_id where d.sponsor_id = $1 order by d.due_at nulls last`, [id]);
    const agreements = await q.query<{ id: string; title: string; status: string; value_amount: number | null; signed_at: Date | null; created_at: Date }>(`select id, title, status, value_amount::float8, signed_at, created_at from ward.sponsorship_agreements where sponsor_id = $1 order by created_at desc`, [id]);
    const episodes = await q.query<{ id: string; title: string; placement: string }>(`select e.id, e.title, es.placement from ward.episode_sponsors es join ward.episodes e on e.id = es.episode_id where es.sponsor_id = $1`, [id]);
    const files = await q.query<{ id: string; name: string; purpose: string }>(`select id, name, purpose from ward.stored_files where sponsor_id = $1 order by created_at desc`, [id]);
    return { s, deliverables, agreements, episodes, files };
  });
  if (!d) notFound();
  const { s } = d;
  const write = can(session.role, 'sponsors.write');
  const founder = can(session.role, 'approvals.decide');
  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <PageHeader title={s.name} subtitle={s.status === 'pending_verification' ? tr(locale, 'بانتظار التحقق من الاتفاق — لا شيء مؤكد بعد.', 'Pending verification — nothing confirmed yet.') : undefined} actions={<StatusBadge status={s.status} locale={locale} />} />
      <Card title={tr(locale, 'بيانات الراعي', 'Sponsor record')}>
        <form action={`/api/os/sponsors/${s.id}`} method="post" className="stack">
          <fieldset disabled={!write} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="grid">
              <label className="field">{tr(locale, 'اسم العلامة', 'Brand name')}<input className="input" name="name" defaultValue={s.name} required maxLength={200} /></label>
              <label className="field">{tr(locale, 'فئة الرعاية', 'Category')}<input className="input" name="category" defaultValue={s.category ?? ''} placeholder={tr(locale, 'راعي الحلقة / شريك المحتوى / شريك التأسيس', 'Episode / content / founding partner')} /></label>
              <label className="field">{tr(locale, 'نوع الرعاية', 'Type')}<select className="select" name="sponsorship_type" defaultValue={s.sponsorship_type ?? ''}><option value="">—</option><option value="cash">{tr(locale, 'نقدية', 'Cash')}</option><option value="in_kind">{tr(locale, 'عينية', 'In-kind')}</option><option value="mixed">{tr(locale, 'مختلطة', 'Mixed')}</option></select></label>
              <label className="field">{tr(locale, 'الحالة', 'Status')}<select className="select" name="status" defaultValue={s.status}>{['pending_verification', 'in_discussion', 'verified', 'active', 'ended', 'declined'].map((x) => <option key={x} value={x}>{label(locale, x)}</option>)}</select></label>
              <label className="field">{tr(locale, 'بداية الاتفاق', 'Start')}<input className="input ltr" type="date" name="agreement_start" defaultValue={day(s.agreement_start)} /></label>
              <label className="field">{tr(locale, 'نهاية الاتفاق', 'End')}<input className="input ltr" type="date" name="agreement_end" defaultValue={day(s.agreement_end)} /></label>
              <label className="field">{tr(locale, 'قيمة الرعاية', 'Value')}<input className="input ltr" type="number" min="0" step="1" name="value_amount" defaultValue={s.value_amount ?? ''} placeholder="—" /></label>
              <label className="field">{tr(locale, 'جهة التواصل', 'Contact name')}<input className="input" name="contact_name" defaultValue={s.contact.name ?? ''} /></label>
              <label className="field">{tr(locale, 'البريد', 'Email')}<input className="input ltr" type="email" name="contact_email" defaultValue={s.contact.email ?? ''} /></label>
              <label className="field">{tr(locale, 'الجوال', 'Phone')}<input className="input ltr" name="contact_phone" defaultValue={s.contact.phone ?? ''} /></label>
            </div>
            <label className="field">{tr(locale, 'حقوق الظهور', 'Visibility rights')}<textarea className="textarea" name="visibility_rights" defaultValue={s.visibility_rights} /></label>
            <label className="row small"><input type="hidden" name="logo_use_approved" value="false" /><input type="checkbox" name="logo_use_approved" value="true" defaultChecked={s.logo_use_approved} />{tr(locale, 'موافقة استخدام الشعار موثقة', 'Logo use approved')}</label>
            <label className="field">{tr(locale, 'ملاحظات', 'Notes')}<textarea className="textarea" name="notes" defaultValue={s.notes} /></label>
            {write && <div><button className="btn btn-primary">{tr(locale, 'حفظ', 'Save')}</button></div>}
          </fieldset>
        </form>
      </Card>
      <div className="grid-2">
        <Card title={tr(locale, 'الشعار والمستندات', 'Logo & documents')}>
          {s.logo_file_id ? (
            // Private, session-authenticated file: the Next image optimizer cannot fetch it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/os/files/${s.logo_file_id}`} alt={s.name} style={{ maxWidth: 160, maxHeight: 120, objectFit: 'contain', borderRadius: 10, background: 'var(--raised)', padding: 8 }} />
          ) : <Empty>{tr(locale, 'لا يوجد شعار.', 'No logo.')}</Empty>}
          {write && <form action={`/api/os/sponsors/${s.id}/logo`} method="post" encType="multipart/form-data" className="row" style={{ marginTop: 10 }}><input className="input" style={{ flex: 1 }} type="file" name="file" accept="image/png,image/jpeg,image/webp" required /><button className="btn btn-sm">{tr(locale, 'رفع الشعار', 'Upload logo')}</button></form>}
          {d.files.filter((f) => f.purpose !== 'logo').map((f) => <a key={f.id} href={`/api/os/files/${f.id}`} className="small" style={{ display: 'block', marginTop: 6 }}>{f.name}</a>)}
        </Card>
        <Card title={tr(locale, 'الحلقات المرتبطة', 'Linked episodes')}>
          {d.episodes.length ? <div className="list">{d.episodes.map((e) => <Link key={e.id} href={`/os/episodes/${e.id}`} className="spread small"><span>{e.title}</span><span className="faint">{e.placement}</span></Link>)}</div> : <Empty>—</Empty>}
        </Card>
        <Card title={tr(locale, 'حقوق الظهور والتسليمات', 'Rights & deliverables')}>
          {d.deliverables.length ? <div className="list">{d.deliverables.map((x) => (
            <form key={x.id} action={`/api/os/deliverables/${x.id}`} method="post" className="spread small">
              <span>{x.title}<span className="faint"> · {formatDate(locale, x.due_at)}{x.episode ? ` · ${x.episode}` : ''}</span>{x.proof_url && <a href={x.proof_url} target="_blank" rel="noopener noreferrer"> ↗</a>}</span>
              {write ? (
                <span className="row"><select className="select" style={{ width: 120, minHeight: 30 }} name="status" defaultValue={x.status}>{['pending', 'delivered', 'verified', 'missed'].map((v) => <option key={v} value={v}>{v}</option>)}</select><input className="input ltr" style={{ width: 160, minHeight: 30 }} name="proof_url" placeholder="proof URL" /><button className="btn btn-sm">✓</button></span>
              ) : <StatusBadge status={x.status} locale={locale} />}
            </form>
          ))}</div> : <Empty>—</Empty>}
          {write && (
            <form action={`/api/os/sponsors/${s.id}/deliverables`} method="post" className="row" style={{ marginTop: 10 }}>
              <input className="input" style={{ flex: 2 }} name="title" required placeholder={tr(locale, 'مثال: ظهور الشعار في الحلقة 1', 'e.g. Logo in episode 1')} />
              <input className="input ltr" style={{ flex: 1 }} type="datetime-local" name="due_at" />
              <button className="btn btn-sm">{tr(locale, 'إضافة', 'Add')}</button>
            </form>
          )}
        </Card>
        <Card title={tr(locale, 'الاتفاقيات', 'Agreements')}>
          {d.agreements.length ? <div className="list">{d.agreements.map((a) => (
            <div key={a.id} className="spread small">
              <span>{a.title}<span className="faint"> · {a.value_amount != null ? money(a.value_amount) : '—'}{a.signed_at ? ` · ${formatDate(locale, a.signed_at)}` : ''}</span></span>
              <span className="row"><StatusBadge status={a.status} locale={locale} />
                {founder && a.status !== 'signed' && <form action={`/api/os/sponsors/${s.id}/agreements`} method="post"><input type="hidden" name="agreement_id" value={a.id} /><input type="hidden" name="status" value="signed" /><button className="btn btn-sm btn-sand">{tr(locale, 'تم التوقيع', 'Mark signed')}</button></form>}
              </span>
            </div>
          ))}</div> : <Empty>{tr(locale, 'لا توجد اتفاقيات. لا تختلق عقودًا.', 'No agreements. Nothing is invented.')}</Empty>}
          {write && (
            <form action={`/api/os/sponsors/${s.id}/agreements`} method="post" className="stack" style={{ marginTop: 10 }}>
              <input className="input" name="title" required placeholder={tr(locale, 'عنوان مسودة الاتفاقية', 'Draft agreement title')} />
              <textarea className="textarea" name="terms" placeholder={tr(locale, 'الشروط', 'Terms')} />
              <div><button className="btn btn-sm">{tr(locale, 'حفظ كمسودة', 'Save draft')}</button></div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
