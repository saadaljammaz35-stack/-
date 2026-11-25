import { z } from 'zod';
import { withOrg, type OrgContext, type Queryable } from '@/lib/db';
import { audit } from '@/lib/audit';
import { can } from '@/lib/auth/permissions';
import { badRequest, conflict, forbidden, notFound } from '@/lib/http';
import { optDate, optText, optUuid, reqText } from '@/lib/services/forms';

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked'] as const;
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

const assignee = z.preprocess((v) => (v === '' || v == null ? null : v), z.string().regex(/^(agent:[a-z]+|user:[0-9a-f-]{36})$/).nullable()).optional();

export const TaskInput = z.object({
  title: reqText(1, 300),
  description: optText(10_000),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  due_at: optDate,
  assignee,
  parent_id: optUuid,
  episode_id: optUuid,
});
export const TaskPatch = TaskInput.partial().extend({ position: z.coerce.number().optional() });

async function resolveAssignee(q: Queryable, value: string | null | undefined): Promise<{ agent: string | null; user: string | null } | undefined> {
  if (value === undefined) return undefined;
  if (value === null) return { agent: null, user: null };
  const [kind, id] = value.split(':') as [string, string];
  if (kind === 'agent') {
    const row = (await q.query<{ id: string }>('select id from ward.ai_agents where slug = $1', [id]))[0];
    if (!row) throw badRequest('unknown_agent');
    return { agent: row.id, user: null };
  }
  const member = (await q.query('select 1 from ward.organization_members where user_id = $1', [id]))[0];
  if (!member) throw badRequest('unknown_user');
  return { agent: null, user: id };
}

export async function createTask(ctx: OrgContext, raw: unknown): Promise<string> {
  if (!can(ctx.role, 'content.write')) throw forbidden();
  const input = TaskInput.parse(raw);
  return withOrg(ctx, async (q) => {
    const who = await resolveAssignee(q, input.assignee ?? null);
    const rows = await q.query<{ id: string }>(
      `insert into ward.tasks (org_id, title, description, status, priority, due_at, assignee_agent_id, assignee_user_id, parent_id, episode_id, created_by_user_id, position)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, extract(epoch from now())) returning id`,
      [ctx.orgId, input.title, input.description ?? '', input.status ?? 'todo', input.priority ?? 'medium', input.due_at ?? null, who?.agent ?? null, who?.user ?? null, input.parent_id ?? null, input.episode_id ?? null, ctx.userId],
    );
    const id = rows[0]!.id;
    await q.query(`insert into ward.task_events (org_id, task_id, actor, field, new_value) values ($1,$2,$3,'created',$4)`, [ctx.orgId, id, ctx.userId ?? 'system', input.title]);
    await audit(q, ctx, 'task.created', { type: 'task', id }, { title: input.title });
    return id;
  });
}

const FIELDS: Record<string, string> = {
  title: 'title', description: 'description', status: 'status', priority: 'priority', due_at: 'due_at', parent_id: 'parent_id', episode_id: 'episode_id', position: 'position',
};

export async function updateTask(ctx: OrgContext, id: string, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'content.write')) throw forbidden();
  const patch = TaskPatch.parse(raw);
  await withOrg(ctx, async (q) => {
    const current = (await q.query<Record<string, unknown>>('select * from ward.tasks where id = $1', [id]))[0];
    if (!current) throw notFound();
    if (patch.parent_id === id) throw badRequest('task_cannot_be_its_own_parent');
    if (patch.status === 'done' && current.status !== 'done') {
      const open = await q.query<{ title: string }>(
        `select t.title from ward.task_dependencies d join ward.tasks t on t.id = d.depends_on_id where d.task_id = $1 and t.status <> 'done'`,
        [id],
      );
      if (open.length) throw conflict('dependencies_open', `Blocked by: ${open.map((o) => o.title).join(', ')}`);
    }
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const [key, column] of Object.entries(FIELDS)) {
      const value = (patch as Record<string, unknown>)[key];
      if (value === undefined) continue;
      params.push(value);
      sets.push(`${column} = $${params.length}`);
      if (key !== 'position' && String(current[column] ?? '') !== String(value ?? '')) {
        await q.query(`insert into ward.task_events (org_id, task_id, actor, field, old_value, new_value) values ($1,$2,$3,$4,$5,$6)`, [
          ctx.orgId, id, ctx.userId ?? 'system', key, current[column] == null ? null : String(current[column]).slice(0, 500), value == null ? null : String(value).slice(0, 500),
        ]);
      }
    }
    const who = await resolveAssignee(q, patch.assignee);
    if (who) {
      params.push(who.agent, who.user);
      sets.push(`assignee_agent_id = $${params.length - 1}`, `assignee_user_id = $${params.length}`);
      await q.query(`insert into ward.task_events (org_id, task_id, actor, field, new_value) values ($1,$2,$3,'assignee',$4)`, [ctx.orgId, id, ctx.userId ?? 'system', patch.assignee ?? null]);
    }
    if (patch.status) sets.push(`completed_at = case when $${params.push(patch.status)} = 'done' then coalesce(completed_at, now()) else null end`);
    if (!sets.length) return;
    await q.query(`update ward.tasks set ${sets.join(', ')} where id = $1`, params);
    await audit(q, ctx, 'task.updated', { type: 'task', id }, { fields: Object.keys(patch) });
  });
}

export async function deleteTask(ctx: OrgContext, id: string): Promise<void> {
  if (!can(ctx.role, 'knowledge.delete')) throw forbidden();
  await withOrg(ctx, async (q) => {
    const rows = await q.query<{ title: string }>('delete from ward.tasks where id = $1 returning title', [id]);
    if (!rows.length) throw notFound();
    await audit(q, ctx, 'task.deleted', { type: 'task', id }, { title: rows[0]!.title });
  });
}

/** Adds "task depends on other"; refuses anything that would create a cycle. */
export async function addDependency(ctx: OrgContext, taskId: string, dependsOnId: string): Promise<void> {
  if (!can(ctx.role, 'content.write')) throw forbidden();
  if (taskId === dependsOnId) throw badRequest('self_dependency');
  await withOrg(ctx, async (q) => {
    const reach = await q.query(
      `with recursive chain(id) as (
         select depends_on_id from ward.task_dependencies where task_id = $1
         union select d.depends_on_id from ward.task_dependencies d join chain c on d.task_id = c.id)
       select 1 from chain where id = $2 limit 1`,
      [dependsOnId, taskId],
    );
    if (reach.length) throw conflict('dependency_cycle');
    await q.query(`insert into ward.task_dependencies (org_id, task_id, depends_on_id) values ($1,$2,$3) on conflict do nothing`, [ctx.orgId, taskId, dependsOnId]);
    await q.query(`insert into ward.task_events (org_id, task_id, actor, field, new_value) values ($1,$2,$3,'dependency_added',$4)`, [ctx.orgId, taskId, ctx.userId ?? 'system', dependsOnId]);
  });
}

export async function removeDependency(ctx: OrgContext, taskId: string, dependsOnId: string): Promise<void> {
  if (!can(ctx.role, 'content.write')) throw forbidden();
  await withOrg(ctx, (q) => q.query('delete from ward.task_dependencies where task_id = $1 and depends_on_id = $2', [taskId, dependsOnId]));
}

export async function addComment(ctx: OrgContext, taskId: string, body: string): Promise<void> {
  if (!can(ctx.role, 'content.write')) throw forbidden();
  const text = z.string().trim().min(1).max(5000).parse(body);
  await withOrg(ctx, (q) => q.query('insert into ward.task_comments (org_id, task_id, author_user_id, body) values ($1,$2,$3,$4)', [ctx.orgId, taskId, ctx.userId, text]));
}
