import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { saveAgreement } from '@/lib/services/business';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'sponsors.write');
  const { id } = await ctx.params;
  const body = await readBody(req);
  const agreementId = typeof body.agreement_id === 'string' && body.agreement_id ? body.agreement_id : null;
  await saveAgreement(s, id, agreementId, body);
  return respond(req, { ok: true }, { redirect: `/os/sponsors/${id}` });
});
