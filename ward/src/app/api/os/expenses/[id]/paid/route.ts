import { respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { markExpensePaid } from '@/lib/services/business';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'approvals.decide');
  await markExpensePaid(s, (await ctx.params).id);
  return respond(req, { ok: true }, { redirect: '/os/finance' });
});
