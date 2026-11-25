import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { formatDate, label, tr } from '@/lib/i18n';
import { AGENTS } from '@/lib/agents/definitions';
import { PRIORITIES, TASK_STATUSES } from '@/lib/services/tasks';
import { Card, Empty, Flash, PageHeader, StatusBadge } from '@/components/os/ui';
import { ConfirmSubmit } from '@/components/os/client';

const toLocalInput = (d: Date | null) => (d ? new Date(new Date(d).getTime() + 3 * 3600_000).toISOString().slice(0, 16) : '');

export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const { id } = await params;
  const d = await withOrg(session, async (q) => {
    const task = (await q.query<{ id: string; title: string; description: string; status: string; priority: string; due_at: Date | null; agent_slug: string | null; assignee_user_id: string | null; parent_id: string | null; parent_title: string | null; episode_id: string | null; workflow_id: string | null; meeting_id: string | null; created_at: Date }>(
      `select t.id, t.title, t.description, t.status, t.priority, t.due_at, a.slug as agent_slug, t.assignee_user_id, t.parent_id, p.title as parent_title, t.episode_id, t.workflow_id, t.meeting_id, t.created_at
         from ward.tasks t left join ward.ai_agents a on a.id = t.assignee_agent_id left join ward.tasks p on p.id = t.parent_id where t.id = $1`, [id]))[0];
    if (!task) return null;
    const subtasks = await q.query<{ id: string; title: string; status: string }>('select id, title, status from ward.tasks where parent_id = $1 order by created_at', [id]);
    const deps = await q.query<{ id: string; title: string; status: string }>(`select t.id, t.title, t.status from ward.task_dependencies d join ward.tasks t on t.id = d.depends_on_id where d.task_id = $1`, [id]);
    const others = await q.query<{ id: string; title: string }>(`select id, title from ward.tasks where id <> $1 order by created_at desc limit 200`, [id]);
    const comments = await q.query<{ id: string; body: string; created_at: Date; author: string | null }>(
      `select c.id, c.body, c.created_at, coalesce(u.name, a.name) as author from ward.task_comments c left join ward.users u on u.id = c.author_user_id left join ward.ai_agents a on a.id = c.author_agent_id where c.task_id = $1 order by c.created_at`, [id]);
    const events = await q.query<{ id: number; actor: string; field: string; old_value: string | null; new_value: string | null; created_at: Date }>(`select id, actor, field, old_value, new_value, created_at from ward.task_events where task_id = $1 order by id desc`, [id]);
    const files = await q.query<{ id: string; name: string }>('select id, name from ward.stored_files where task_id = $1 order by created_at desc', [id]);
    const members = await q.query<{ user_id: string; name: string }>(`select m.user_id, u.name from ward.organization_members m join ward.users u on u.id = m.user_id`);
    return { task, subtasks, deps, others, comments, events, files, members };
  });
  if (!d) notFound();
  const { task } = d;
  const write = can(session.role, 'content.write');
  const assignee = task.agent_slug ? `agent:${task.agent_slug}` : task.assignee_user_id ? `user:${task.assignee_user_id}` : '';
  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <PageHeader title={task.title} subtitle={task.parent_title ? `↳ ${task.parent_title}` : undefined} actions={<StatusBadge status={task.status} locale={locale} />} />
      <div className="row small">
        {task.episode_id && <Link className="badge plain" href={`/os/episodes/${task.episode_id}`}>{tr(locale, 'الحلقة', 'Episode')}</Link>}
        {task.workflow_id && <Link className="badge plain" href={`/os/runs/${task.workflow_id}`}>{tr(locale, 'من أمر تشغيل', 'From a run')}</Link>}
        {task.meeting_id && <Link className="badge plain" href={`/os/meetings/${task.meeting_id}`}>{tr(locale, 'من اجتماع', 'From a meeting')}</Link>}
      </div>
      <Card>
        <form action={`/api/os/tasks/${task.id}`} method="post" className="stack">
          <fieldset disabled={!write} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <input className="input" name="title" defaultValue={task.title} required maxLength={300} />
            <div className="grid">
              <select className="select" name="status" defaultValue={task.status}>{TASK_STATUSES.map((x) => <option key={x} value={x}>{label(locale, x)}</option>)}</select>
              <select className="select" name="priority" defaultValue={task.priority}>{PRIORITIES.map((x) => <option key={x} value={x}>{label(locale, x)}</option>)}</select>
              <input className="input ltr" type="datetime-local" name="due_at" defaultValue={toLocalInput(task.due_at)} />
              <select className="select" name="assignee" defaultValue={assignee}>
                <option value="">{tr(locale, 'غير مسند', 'Unassigned')}</option>
                <optgroup label={tr(locale, 'الوكلاء', 'Agents')}>{AGENTS.map((a) => <option key={a.slug} value={`agent:${a.slug}`}>{a.name}</option>)}</optgroup>
                <optgroup label={tr(locale, 'الفريق', 'Team')}>{d.members.map((u) => <option key={u.user_id} value={`user:${u.user_id}`}>{u.name}</option>)}</optgroup>
              </select>
            </div>
            <textarea className="textarea" name="description" defaultValue={task.description} />
            {write && <div><button className="btn btn-primary">{tr(locale, 'حفظ', 'Save')}</button></div>}
          </fieldset>
        </form>
      </Card>
      <div className="grid-2">
        <Card title={tr(locale, 'المهام الفرعية', 'Subtasks')}>
          {d.subtasks.length ? <div className="list">{d.subtasks.map((x) => <Link key={x.id} href={`/os/tasks/${x.id}`} className="spread small"><span>{x.title}</span><StatusBadge status={x.status} locale={locale} /></Link>)}</div> : <Empty>—</Empty>}
          {write && <form action="/api/os/tasks" method="post" className="row" style={{ marginTop: 10 }}><input type="hidden" name="parent_id" value={task.id} />{task.episode_id && <input type="hidden" name="episode_id" value={task.episode_id} />}<input className="input" style={{ flex: 1 }} name="title" required placeholder={tr(locale, 'مهمة فرعية', 'Subtask')} /><button className="btn btn-sm">+</button></form>}
        </Card>
        <Card title={tr(locale, 'تعتمد على', 'Depends on')}>
          {d.deps.length ? <div className="list">{d.deps.map((x) => (
            <div key={x.id} className="spread small"><Link href={`/os/tasks/${x.id}`}>{x.title}</Link>
              <span className="row"><StatusBadge status={x.status} locale={locale} />{write && <form action={`/api/os/tasks/${task.id}/dependencies`} method="post"><input type="hidden" name="depends_on_id" value={x.id} /><input type="hidden" name="_action" value="remove" /><button className="btn btn-sm btn-ghost">✕</button></form>}</span>
            </div>
          ))}</div> : <Empty>—</Empty>}
          {write && <form action={`/api/os/tasks/${task.id}/dependencies`} method="post" className="row" style={{ marginTop: 10 }}><select className="select" style={{ flex: 1 }} name="depends_on_id" required>{d.others.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select><button className="btn btn-sm">+</button></form>}
        </Card>
        <Card title={tr(locale, 'التعليقات', 'Comments')}>
          {d.comments.length ? <div className="list">{d.comments.map((c) => <div key={c.id} className="small"><strong style={{ fontWeight: 500 }}>{c.author ?? '—'}</strong> <span className="faint">{formatDate(locale, c.created_at, true)}</span><div className="prose">{c.body}</div></div>)}</div> : <Empty>—</Empty>}
          {write && <form action={`/api/os/tasks/${task.id}/comments`} method="post" className="stack" style={{ marginTop: 10 }}><textarea className="textarea" name="body" required maxLength={5000} /><div><button className="btn btn-sm">{tr(locale, 'تعليق', 'Comment')}</button></div></form>}
        </Card>
        <Card title={tr(locale, 'المرفقات', 'Attachments')}>
          {d.files.length ? d.files.map((f) => <a key={f.id} href={`/api/os/files/${f.id}`} className="small" style={{ display: 'block' }}>{f.name}</a>) : <Empty>—</Empty>}
          {write && <form action={`/api/os/tasks/${task.id}/attachments`} method="post" encType="multipart/form-data" className="row" style={{ marginTop: 10 }}><input className="input" style={{ flex: 1 }} type="file" name="file" required /><button className="btn btn-sm">{tr(locale, 'رفع', 'Upload')}</button></form>}
        </Card>
      </div>
      <Card title={tr(locale, 'سجل التغييرات', 'Change log')}>
        {d.events.length ? <div className="list">{d.events.map((e) => <div key={e.id} className="small"><span className="mono">{e.field}</span> {e.old_value ? <span className="faint">{e.old_value.slice(0, 60)} → </span> : null}{e.new_value?.slice(0, 80)} <span className="faint">· {formatDate(locale, e.created_at, true)}</span></div>)}</div> : <Empty>—</Empty>}
      </Card>
      {can(session.role, 'knowledge.delete') && (
        <form action={`/api/os/tasks/${task.id}`} method="post"><input type="hidden" name="_action" value="delete" /><ConfirmSubmit className="btn btn-sm btn-danger" message={tr(locale, 'حذف المهمة؟', 'Delete task?')}>{tr(locale, 'حذف المهمة', 'Delete task')}</ConfirmSubmit></form>
      )}
    </div>
  );
}
