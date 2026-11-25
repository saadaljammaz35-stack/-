import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { setDeliverableStatus } from '@/lib/services/business';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'sponsors.write');
  const b = await readBody(req);
  await setDeliverableStatus(s, (await ctx.params).id, String(b.status ?? ''), typeof b.proof_url === 'string' && b.proof_url ? b.proof_url : null);
  return respond(req, { ok: true });
});
