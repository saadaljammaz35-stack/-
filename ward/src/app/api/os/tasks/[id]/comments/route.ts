import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { addComment } from '@/lib/services/tasks';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  const { id } = await ctx.params;
  await addComment(s, id, String((await readBody(req)).body ?? ''));
  return respond(req, { ok: true }, { redirect: `/os/tasks/${id}` });
});
