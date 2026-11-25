import Link from 'next/link';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { dict, formatDate, label, tr } from '@/lib/i18n';
import { AGENTS } from '@/lib/agents/definitions';
import { PRIORITIES, TASK_STATUSES } from '@/lib/services/tasks';
import { Card, Empty, Flash, PageHeader, StatusBadge } from '@/components/os/ui';
import { Kanban, type KanbanTask } from '@/components/os/client';
import s from '../../os.module.css';

type View = 'kanban' | 'list' | 'calendar';

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay()); // weeks start on Sunday
  return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86_400_000));
}
const key = (d: Date) => d.toISOString().slice(0, 10);
const riyadhDay = (d: Date | string) => new Date(new Date(d).getTime() + 3 * 3600_000).toISOString().slice(0, 10);

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const sp = await searchParams;
  const view: View = sp.view === 'list' || sp.view === 'calendar' ? sp.view : 'kanban';
  const now = new Date();
  const [y, m] = (sp.month ?? `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`).split('-').map(Number) as [number, number];
  const d = await withOrg(session, async (q) => ({
    tasks: await q.query<{ id: string; title: string; status: string; priority: string; due_at: Date | null; agent: string | null; user_name: string | null; parent_id: string | null; episode: string | null; deps_open: number }>(
      `select t.id, t.title, t.status, t.priority, t.due_at, a.name as agent, u.name as user_name, t.parent_id, e.title as episode,
              (select count(*)::int from ward.task_dependencies dd join ward.tasks x on x.id = dd.depends_on_id where dd.task_id = t.id and x.status <> 'done') as deps_open
         from ward.tasks t left join ward.ai_agents a on a.id = t.assignee_agent_id left join ward.users u on u.id = t.assignee_user_id left join ward.episodes e on e.id = t.episode_id
        order by case t.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, t.due_at nulls last, t.created_at desc limit 500`),
    shoots: await q.query<{ id: string; title: string; shoot_at: Date }>(`select id, title, shoot_at from ward.episodes where shoot_at is not null`),
    calendar: await q.query<{ id: string; title: string; platform: string; scheduled_at: Date; status: string }>(`select id, title, platform, scheduled_at, status from ward.content_calendar where scheduled_at is not null`),
    members: await q.query<{ user_id: string; name: string }>(`select m.user_id, u.name from ward.organization_members m join ward.users u on u.id = m.user_id`),
    episodes: await q.query<{ id: string; title: string }>(`select id, title from ward.episodes order by created_at`),
  }));
  const write = can(session.role, 'content.write');
  const tabs: { v: View; label: string }[] = [
    { v: 'kanban', label: 'Kanban' },
    { v: 'list', label: tr(locale, 'قائمة', 'List') },
    { v: 'calendar', label: tr(locale, 'تقويم', 'Calendar') },
  ];
  const kanbanTasks: KanbanTask[] = d.tasks.filter((x) => !x.parent_id).map((x) => ({
    id: x.id, title: x.title, status: x.status, priority: x.priority, priorityLabel: label(locale, x.priority),
    due: x.due_at ? formatDate(locale, x.due_at) : null, assignee: x.agent ?? x.user_name, overdue: !!x.due_at && new Date(x.due_at) < now && x.status !== 'done',
  }));
  const days = monthGrid(y, m - 1);
  const items = new Map<string, { href: string; text: string; kind: string }[]>();
  const add = (k: string, v: { href: string; text: string; kind: string }) => items.set(k, [...(items.get(k) ?? []), v]);
  for (const x of d.tasks) if (x.due_at) add(riyadhDay(x.due_at), { href: `/os/tasks/${x.id}`, text: x.title, kind: 'task' });
  for (const x of d.shoots) add(riyadhDay(x.shoot_at), { href: `/os/episodes/${x.id}`, text: `🎬 ${x.title}`, kind: 'shoot' });
  for (const x of d.calendar) add(riyadhDay(x.scheduled_at), { href: '/os/tasks?view=calendar', text: `${x.platform}: ${x.title}`, kind: 'content' });
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${m - 1}`;
  const next = m === 12 ? `${y + 1}-1` : `${y}-${m + 1}`;
  const today = riyadhDay(now);

  return (
    <div className="stack">
      <Flash params={sp} />
      <PageHeader title={t.nav.tasks} actions={<div className="row">{tabs.map((x) => <Link key={x.v} href={`/os/tasks?view=${x.v}`} className={`btn btn-sm ${view === x.v ? 'btn-primary' : ''}`}>{x.label}</Link>)}</div>} />
      {write && (
        <details className="card disclosure">
          <summary>+ {tr(locale, 'مهمة جديدة', 'New task')}</summary>
          <form action="/api/os/tasks" method="post" className="stack">
            <input className="input" name="title" required maxLength={300} placeholder={tr(locale, 'العنوان', 'Title')} />
            <div className="grid">
              <select className="select" name="priority" defaultValue="medium">{PRIORITIES.map((p) => <option key={p} value={p}>{label(locale, p)}</option>)}</select>
              <select className="select" name="status" defaultValue="todo">{TASK_STATUSES.map((p) => <option key={p} value={p}>{label(locale, p)}</option>)}</select>
              <input className="input ltr" type="datetime-local" name="due_at" />
              <select className="select" name="assignee" defaultValue="">
                <option value="">{tr(locale, 'غير مسند', 'Unassigned')}</option>
                <optgroup label={tr(locale, 'الوكلاء', 'Agents')}>{AGENTS.map((a) => <option key={a.slug} value={`agent:${a.slug}`}>{a.name}</option>)}</optgroup>
                <optgroup label={tr(locale, 'الفريق', 'Team')}>{d.members.map((u) => <option key={u.user_id} value={`user:${u.user_id}`}>{u.name}</option>)}</optgroup>
              </select>
              <select className="select" name="episode_id" defaultValue=""><option value="">{tr(locale, 'بدون حلقة', 'No episode')}</option>{d.episodes.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
              <select className="select" name="parent_id" defaultValue=""><option value="">{tr(locale, 'مهمة رئيسية', 'Top-level')}</option>{d.tasks.filter((x) => !x.parent_id).map((x) => <option key={x.id} value={x.id}>↳ {x.title}</option>)}</select>
            </div>
            <textarea className="textarea" name="description" placeholder={tr(locale, 'الوصف', 'Description')} />
            <div><button className="btn btn-primary">{tr(locale, 'إنشاء', 'Create')}</button></div>
          </form>
        </details>
      )}

      {view === 'kanban' && <Kanban columns={TASK_STATUSES.map((k) => ({ key: k, label: label(locale, k) }))} tasks={kanbanTasks} />}

      {view === 'list' && (
        <Card>
          {d.tasks.length ? (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>{tr(locale, 'المهمة', 'Task')}</th><th>{t.common.priority}</th><th>{t.common.status}</th><th>{t.common.due}</th><th>{t.common.owner}</th></tr></thead>
              <tbody>{d.tasks.map((x) => (
                <tr key={x.id}>
                  <td><Link href={`/os/tasks/${x.id}`}>{x.parent_id ? '↳ ' : ''}{x.title}</Link>{x.episode && <span className="small faint"> · {x.episode}</span>}{x.deps_open > 0 && <span className="small" style={{ color: 'var(--bad)' }}> · ⛓ {x.deps_open}</span>}</td>
                  <td className="small">{label(locale, x.priority)}</td>
                  <td><StatusBadge status={x.status} locale={locale} /></td>
                  <td className="small">{formatDate(locale, x.due_at, true)}</td>
                  <td className="small">{x.agent ?? x.user_name ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <Empty>—</Empty>}
        </Card>
      )}

      {view === 'calendar' && (
        <div className="stack">
          <div className="spread">
            <Link className="btn btn-sm" href={`/os/tasks?view=calendar&month=${prev}`}>‹</Link>
            <strong>{new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))}</strong>
            <Link className="btn btn-sm" href={`/os/tasks?view=calendar&month=${next}`}>›</Link>
          </div>
          <div className={s.calendar}>
            {(locale === 'ar' ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map((n) => <div key={n} className={s.calHead}>{n}</div>)}
            {days.map((day) => (
              <div key={key(day)} className={s.calDay} data-out={day.getUTCMonth() !== m - 1} data-today={key(day) === today}>
                <span className={s.calNum}>{day.getUTCDate()}</span>
                {(items.get(key(day)) ?? []).slice(0, 4).map((it, i) => <Link key={i} href={it.href} className={s.calItem} data-kind={it.kind} title={it.text}>{it.text}</Link>)}
              </div>
            ))}
          </div>
          {write && (
            <Card title={tr(locale, 'إضافة إلى تقويم المحتوى', 'Add to content calendar')}>
              <form action="/api/os/calendar" method="post" className="row">
                <input className="input" style={{ flex: 2 }} name="title" required placeholder={tr(locale, 'العنوان', 'Title')} />
                <select className="select" style={{ flex: 1 }} name="platform">{['youtube', 'podcast', 'instagram', 'tiktok', 'x', 'website', 'other'].map((p) => <option key={p}>{p}</option>)}</select>
                <input className="input ltr" style={{ flex: 1 }} type="datetime-local" name="scheduled_at" />
                <button className="btn btn-sm">{tr(locale, 'إضافة', 'Add')}</button>
              </form>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
