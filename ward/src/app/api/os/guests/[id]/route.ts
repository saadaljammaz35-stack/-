import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { saveGuest } from '@/lib/services/content';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  await saveGuest(s, (await ctx.params).id, await readBody(req));
  return respond(req, { ok: true });
});
