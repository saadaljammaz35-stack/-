import { z } from 'zod';
import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { linkSponsor } from '@/lib/services/content';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'sponsors.write');
  const { id } = await ctx.params;
  const b = z.object({ sponsor_id: z.string().uuid(), placement: z.string().max(300).default(''), _action: z.string().optional() }).parse(await readBody(req));
  await linkSponsor(s, id, b.sponsor_id, b.placement, b._action === 'unlink');
  return respond(req, { ok: true }, { redirect: `/os/episodes/${id}` });
});
