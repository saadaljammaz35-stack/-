import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { deleteTask, updateTask } from '@/lib/services/tasks';
import type { Params } from '@/lib/api';

const update = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  const { id } = await ctx.params;
  const body = await readBody(req);
  if (body._action === 'delete') {
    await deleteTask(s, id);
    return respond(req, { ok: true }, { redirect: '/os/tasks' });
  }
  await updateTask(s, id, body);
  return respond(req, { ok: true });
});
export const POST = update;
export const PATCH = update;
export const DELETE = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  await deleteTask(s, (await ctx.params).id);
  return respond(req, { ok: true });
});
