import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { formatDate, label, money, tr } from '@/lib/i18n';
import { EPISODE_STATUSES } from '@/lib/services/content';
import { Card, Empty, Flash, PageHeader, StatusBadge } from '@/components/os/ui';

const toLocalInput = (d: Date | null) => (d ? new Date(new Date(d).getTime() + 3 * 3600_000).toISOString().slice(0, 16) : '');

export default async function EpisodePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const { id } = await params;
  const d = await withOrg(session, async (q) => {
    const e = (await q.query<{ id: string; number: number | null; title: string; topic: string; description: string; status: string; guest_id: string | null; guest_confirmed: boolean; questions: string[]; script: string; shoot_at: Date | null; publish_at: Date | null; estimated_cost: number | null; marketing: { notes?: string }; approval_status: string; publish_links: { platform: string; url: string }[] }>(
      `select id, number, title, topic, description, status, guest_id, guest_confirmed, questions, script, shoot_at, publish_at, estimated_cost::float8, marketing, approval_status, publish_links from ward.episodes where id = $1`, [id]))[0];
    if (!e) return null;
    const guests = await q.query<{ id: string; name: string; is_minor: boolean | null; guardian_consent: boolean }>('select id, name, is_minor, guardian_consent from ward.guests order by name');
    const sponsors = await q.query<{ id: string; name: string; status: string; placement: string | null; linked: boolean }>(
      `select s.id, s.name, s.status, es.placement, es.episode_id is not null as linked from ward.sponsors s left join ward.episode_sponsors es on es.sponsor_id = s.id and es.episode_id = $1 order by s.created_at`, [id]);
    const tasks = await q.query<{ id: string; title: string; status: string }>(`select id, title, status from ward.tasks where episode_id = $1 order by created_at`, [id]);
    const files = await q.query<{ id: string; name: string; size: number; created_at: Date }>(`select id, name, size, created_at from ward.stored_files where episode_id = $1 order by created_at desc`, [id]);
    const cost = (await q.query<{ spent: number }>(`select coalesce(sum(amount),0)::float8 as spent from ward.expenses where episode_id = $1 and status in ('approved','paid')`, [id]))[0]!.spent;
    const calendar = await q.query<{ id: string; title: string; platform: string; status: string; scheduled_at: Date | null }>(`select id, title, platform, status, scheduled_at from ward.content_calendar where episode_id = $1 order by scheduled_at nulls last`, [id]);
    const approvals = await q.query<{ id: string; title: string; status: string }>(`select id, title, status from ward.approvals where payload->>'episode_id' = $1 order by created_at desc`, [id]);
    return { e, guests, sponsors, tasks, files, cost, calendar, approvals };
  });
  if (!d) notFound();
  const { e } = d;
  const write = can(session.role, 'content.write');
  const founder = can(session.role, 'episodes.publish');
  const guest = d.guests.find((g) => g.id === e.guest_id);
  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <PageHeader title={`${e.number ? `#${e.number} · ` : ''}${e.title}`} subtitle={e.topic}
        actions={<><StatusBadge status={e.status} locale={locale} /><StatusBadge status={e.approval_status} locale={locale} /></>} />
      {!e.guest_confirmed && e.guest_id && <div className="notice">{tr(locale, 'الضيف مقترح وغير مؤكد. لا يُعلن الاسم أو الموعد قبل تأكيد المؤسس.', 'Guest is proposed, not confirmed. Do not announce name or date before the founder confirms.')}</div>}
      {guest?.is_minor && !guest.guardian_consent && <div className="notice bad">{tr(locale, 'الضيف قاصر: موافقة ولي الأمر مطلوبة قبل التسجيل والنشر.', 'Guest is a minor: guardian consent is required before recording and publishing.')}</div>}

      <Card title={tr(locale, 'بيانات الحلقة', 'Episode')}>
        <form action={`/api/os/episodes/${e.id}`} method="post" className="stack">
          <fieldset disabled={!write} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="grid">
              <label className="field">{tr(locale, 'العنوان', 'Title')}<input className="input" name="title" defaultValue={e.title} required maxLength={200} /></label>
              <label className="field">{tr(locale, 'الرقم', 'Number')}<input className="input ltr" name="number" type="number" min="1" defaultValue={e.number ?? ''} /></label>
              <label className="field">{tr(locale, 'الحالة', 'Status')}
                <select className="select" name="status" defaultValue={e.status}>
                  {EPISODE_STATUSES.filter((s) => s !== 'published' || founder).map((s) => <option key={s} value={s}>{label(locale, s)}</option>)}
                </select>
              </label>
              <label className="field">{tr(locale, 'الضيف', 'Guest')}
                <select className="select" name="guest_id" defaultValue={e.guest_id ?? ''}><option value="">—</option>{d.guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              </label>
              <label className="field">{tr(locale, 'موعد التصوير (الرياض)', 'Shoot (Riyadh)')}<input className="input ltr" type="datetime-local" name="shoot_at" defaultValue={toLocalInput(e.shoot_at)} /></label>
              <label className="field">{tr(locale, 'التكلفة التقديرية (SAR)', 'Estimated cost (SAR)')}<input className="input ltr" type="number" min="0" step="1" name="estimated_cost" defaultValue={e.estimated_cost ?? ''} /></label>
            </div>
            <label className="field">{tr(locale, 'الموضوع', 'Topic')}<input className="input" name="topic" defaultValue={e.topic} maxLength={500} /></label>
            <label className="field">{tr(locale, 'الوصف', 'Description')}<textarea className="textarea" name="description" defaultValue={e.description} /></label>
            <label className="field">{tr(locale, 'الأسئلة (سؤال في كل سطر)', 'Questions (one per line)')}<textarea className="textarea" name="questions" defaultValue={e.questions.join('\n')} style={{ minHeight: 160 }} /></label>
            <label className="field">{tr(locale, 'السيناريو', 'Script')}<textarea className="textarea" name="script" defaultValue={e.script} style={{ minHeight: 200 }} /></label>
            <label className="field">{tr(locale, 'المحتوى التسويقي', 'Marketing content')}<textarea className="textarea" name="marketing_notes" defaultValue={e.marketing.notes ?? ''} /></label>
            {write && <div><button className="btn btn-primary">{tr(locale, 'حفظ', 'Save')}</button></div>}
          </fieldset>
        </form>
      </Card>

      {founder && (
        <Card title={tr(locale, 'قرارات المؤسس', 'Founder decisions')}>
          <form action={`/api/os/episodes/${e.id}`} method="post" className="stack">
            <div className="grid">
              <label className="row"><input type="hidden" name="guest_confirmed" value="false" /><input type="checkbox" name="guest_confirmed" value="true" defaultChecked={e.guest_confirmed} disabled={!e.guest_id} />{tr(locale, 'أؤكد استضافة الضيف', 'I confirm the guest')}</label>
              <label className="field">{tr(locale, 'حالة الاعتماد', 'Approval')}
                <select className="select" name="approval_status" defaultValue={e.approval_status}>{['draft', 'pending', 'approved', 'rejected'].map((x) => <option key={x} value={x}>{label(locale, x)}</option>)}</select>
              </label>
            </div>
            <label className="field">{tr(locale, 'روابط النشر (منصة | رابط في كل سطر)', 'Publish links (platform | url per line)')}<textarea className="textarea ltr" name="publish_links" defaultValue={e.publish_links.map((l) => `${l.platform} | ${l.url}`).join('\n')} /></label>
            <div><button className="btn btn-sand">{tr(locale, 'حفظ قرارات المؤسس', 'Save founder decisions')}</button></div>
          </form>
        </Card>
      )}

      <div className="grid-2">
        <Card title={tr(locale, 'الرعاة', 'Sponsors')}>
          <div className="list">
            {d.sponsors.filter((s) => s.linked).map((s) => (
              <div key={s.id} className="spread"><span>{s.name} <span className="small faint">· {s.placement}</span></span>
                {can(session.role, 'sponsors.write') && <form action={`/api/os/episodes/${e.id}/sponsors`} method="post"><input type="hidden" name="sponsor_id" value={s.id} /><input type="hidden" name="_action" value="unlink" /><button className="btn btn-sm btn-ghost">✕</button></form>}
              </div>
            ))}
          </div>
          {can(session.role, 'sponsors.write') && (
            <form action={`/api/os/episodes/${e.id}/sponsors`} method="post" className="row" style={{ marginTop: 10 }}>
              <select className="select" style={{ flex: 1 }} name="sponsor_id" required>{d.sponsors.filter((s) => !s.linked).map((s) => <option key={s.id} value={s.id}>{s.name} ({label(locale, s.status)})</option>)}</select>
              <input className="input" style={{ flex: 1 }} name="placement" placeholder={tr(locale, 'نوع الظهور', 'Placement')} />
              <button className="btn btn-sm">{tr(locale, 'ربط', 'Link')}</button>
            </form>
          )}
        </Card>
        <Card title={tr(locale, 'التكلفة والمهام', 'Cost & tasks')}>
          <p className="small">{tr(locale, 'المصروف الفعلي', 'Actual spend')}: <strong>{money(d.cost)}</strong>{e.estimated_cost != null ? ` / ${money(e.estimated_cost)}` : ''}</p>
          {d.tasks.length ? <div className="list">{d.tasks.map((t) => <Link key={t.id} href={`/os/tasks/${t.id}`} className="spread small"><span>{t.title}</span><StatusBadge status={t.status} locale={locale} /></Link>)}</div> : <Empty>{tr(locale, 'لا مهام مرتبطة.', 'No linked tasks.')}</Empty>}
        </Card>
        <Card title={tr(locale, 'الملفات', 'Files')}>
          {d.files.length ? <div className="list">{d.files.map((f) => <a key={f.id} href={`/api/os/files/${f.id}`} className="spread small"><span>{f.name}</span><span className="faint">{Math.ceil(f.size / 1024)} KB · {formatDate(locale, f.created_at)}</span></a>)}</div> : <Empty>—</Empty>}
          {write && <form action={`/api/os/episodes/${e.id}/files`} method="post" encType="multipart/form-data" className="row" style={{ marginTop: 10 }}><input className="input" style={{ flex: 1 }} type="file" name="file" required /><button className="btn btn-sm">{tr(locale, 'رفع', 'Upload')}</button></form>}
        </Card>
        <Card title={tr(locale, 'المحتوى التسويقي المجدول والموافقات', 'Scheduled marketing & approvals')}>
          {d.calendar.map((c) => <div key={c.id} className="spread small"><span>{c.title} · {c.platform}</span><span className="row"><span className="faint">{formatDate(locale, c.scheduled_at)}</span><StatusBadge status={c.status} locale={locale} /></span></div>)}
          {d.approvals.map((a) => <Link key={a.id} href={`/os/approvals#${a.id}`} className="spread small"><span>{a.title}</span><StatusBadge status={a.status} locale={locale} /></Link>)}
          {!d.calendar.length && !d.approvals.length && <Empty>—</Empty>}
        </Card>
      </div>
    </div>
  );
}
