import Link from 'next/link';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { dict, formatDate, label, tr } from '@/lib/i18n';
import { EPISODE_STATUSES } from '@/lib/services/content';
import { Card, Empty, Flash, PageHeader, StatusBadge } from '@/components/os/ui';
import s from '../../os.module.css';

export default async function EpisodesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const sp = await searchParams;
  const d = await withOrg(session, async (q) => ({
    episodes: await q.query<{ id: string; number: number | null; title: string; status: string; guest: string | null; guest_confirmed: boolean; shoot_at: Date | null; approval_status: string }>(
      `select e.id, e.number, e.title, e.status, g.name as guest, e.guest_confirmed, e.shoot_at, e.approval_status from ward.episodes e left join ward.guests g on g.id = e.guest_id order by e.number nulls last, e.created_at`),
    guests: await q.query<{ id: string; name: string; channel: string | null; status: string; topics: string[]; is_minor: boolean | null; guardian_consent: boolean; notes: string }>(
      `select id, name, channel, status, topics, is_minor, guardian_consent, notes from ward.guests order by created_at desc`),
  }));
  const write = can(session.role, 'content.write');
  return (
    <div className="stack">
      <Flash params={sp} />
      <PageHeader title={t.nav.episodes} subtitle={tr(locale, 'فكرة ← بحث ← إعداد ← تأكيد الضيف ← جاهزة للتصوير ← تصوير ← مونتاج ← مراجعة ← جاهزة للنشر ← منشورة. لا تعتبر الاستضافة مؤكدة إلا بموافقة المؤسس.', 'Idea → research → preparation → guest confirmation → ready to shoot → shooting → editing → review → ready to publish → published. A guest is confirmed only by the founder.')} />
      <div className={s.kanban}>
        {EPISODE_STATUSES.map((st) => {
          const list = d.episodes.filter((e) => e.status === st);
          return (
            <section key={st} className={s.column} style={{ minHeight: 140 }}>
              <header className={s.columnHead}><span>{label(locale, st)}</span><span>{list.length}</span></header>
              {list.map((e) => (
                <Link key={e.id} href={`/os/episodes/${e.id}`} className={s.taskCard} style={{ cursor: 'pointer' }}>
                  <strong style={{ fontWeight: 600 }}>{e.number ? `#${e.number} · ` : ''}{e.title}</strong>
                  <span className="small muted">{e.guest ?? tr(locale, 'بدون ضيف', 'No guest')} · {e.guest_confirmed ? tr(locale, 'مؤكد ✓', 'confirmed ✓') : tr(locale, 'غير مؤكد', 'unconfirmed')}</span>
                  {e.shoot_at && <span className="small faint">{tr(locale, 'تصوير', 'Shoot')}: {formatDate(locale, e.shoot_at)}</span>}
                </Link>
              ))}
            </section>
          );
        })}
      </div>
      <div className="grid-2">
        {write && (
          <Card title={tr(locale, 'حلقة جديدة', 'New episode')}>
            <form action="/api/os/episodes" method="post" className="stack">
              <input className="input" name="title" required maxLength={200} placeholder={tr(locale, 'العنوان', 'Title')} />
              <input className="input" name="topic" maxLength={500} placeholder={tr(locale, 'الموضوع', 'Topic')} />
              <select className="select" name="guest_id" defaultValue=""><option value="">{tr(locale, 'بدون ضيف', 'No guest')}</option>{d.guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <button className="btn btn-primary">{tr(locale, 'إنشاء', 'Create')}</button>
            </form>
          </Card>
        )}
        <Card id="guests" title={tr(locale, 'الضيوف', 'Guests')}>
          {d.guests.length ? <div className="list">{d.guests.map((g) => (
            <details key={g.id} className="disclosure">
              <summary className="spread"><span style={{ color: 'var(--ink)' }}>{g.name}{g.channel ? <span className="small faint"> · {g.channel}</span> : null}</span><StatusBadge status={g.status} locale={locale} /></summary>
              <form action={`/api/os/guests/${g.id}`} method="post" className="stack">
                <div className="grid">
                  <select className="select" name="status" defaultValue={g.status}>
                    {['proposed', 'contacted', 'interested', 'declined', ...(can(session.role, 'episodes.confirm_guest') ? ['confirmed'] : [])].map((x) => <option key={x} value={x}>{label(locale, x)}</option>)}
                  </select>
                  <select className="select" name="is_minor" defaultValue={g.is_minor === null ? '' : g.is_minor ? 'yes' : 'no'}>
                    <option value="">{tr(locale, 'العمر غير معروف', 'Age unknown')}</option><option value="yes">{tr(locale, 'قاصر', 'Minor')}</option><option value="no">{tr(locale, 'بالغ', 'Adult')}</option>
                  </select>
                  <label className="row small"><input type="checkbox" name="guardian_consent" defaultChecked={g.guardian_consent} />{tr(locale, 'موافقة ولي الأمر موثقة', 'Guardian consent on file')}</label>
                </div>
                <textarea className="textarea" name="notes" defaultValue={g.notes} />
                {write && <div><button className="btn btn-sm">{tr(locale, 'حفظ', 'Save')}</button></div>}
              </form>
            </details>
          ))}</div> : <Empty>—</Empty>}
          {write && (
            <form action="/api/os/guests" method="post" className="row" style={{ marginTop: 14 }}>
              <input className="input" style={{ flex: 1 }} name="name" required maxLength={200} placeholder={tr(locale, 'اسم ضيف مقترح', 'Proposed guest name')} />
              <input className="input" style={{ flex: 1 }} name="channel" maxLength={200} placeholder={tr(locale, 'القناة/الحساب', 'Channel')} />
              <button className="btn btn-sm">{tr(locale, 'إضافة', 'Add')}</button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
