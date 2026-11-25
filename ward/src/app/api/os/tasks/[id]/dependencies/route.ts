import { z } from 'zod';
import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { addDependency, removeDependency } from '@/lib/services/tasks';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  const { id } = await ctx.params;
  const b = z.object({ depends_on_id: z.string().uuid(), _action: z.string().optional() }).parse(await readBody(req));
  if (b._action === 'remove') await removeDependency(s, id, b.depends_on_id);
  else await addDependency(s, id, b.depends_on_id);
  return respond(req, { ok: true }, { redirect: `/os/tasks/${id}` });
});
