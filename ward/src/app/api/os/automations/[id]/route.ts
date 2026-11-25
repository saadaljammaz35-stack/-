import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { updateAutomation } from '@/lib/services/admin';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'settings.write');
  const body = await readBody(req);
  if (body.enabled_form === '1' && body.enabled === undefined) body.enabled = false; // unchecked checkbox
  if (body.enabled_form === '1' && body.uses_ai === undefined) body.uses_ai = false;
  await updateAutomation(s, (await ctx.params).id, body);
  return respond(req, { ok: true }, { redirect: '/os/automations?saved=1' });
});
