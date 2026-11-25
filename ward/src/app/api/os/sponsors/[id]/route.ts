import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { saveSponsor } from '@/lib/services/business';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'sponsors.write');
  const { id } = await ctx.params;
  await saveSponsor(s, id, await readBody(req));
  return respond(req, { ok: true }, { redirect: `/os/sponsors/${id}?saved=1` });
});
