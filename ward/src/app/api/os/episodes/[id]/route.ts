import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { updateEpisode } from '@/lib/services/content';
import type { Params } from '@/lib/api';

const handler = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  const { id } = await ctx.params;
  await updateEpisode(s, id, await readBody(req));
  return respond(req, { ok: true }, { redirect: `/os/episodes/${id}?saved=1` });
});
export const POST = handler;
export const PATCH = handler;
