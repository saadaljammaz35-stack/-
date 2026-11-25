import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { saveCalendarItem } from '@/lib/services/content';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  await saveCalendarItem(s, (await ctx.params).id, await readBody(req));
  return respond(req, { ok: true });
});
