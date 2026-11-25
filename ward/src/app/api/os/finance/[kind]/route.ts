import { badRequest, readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { createBudget, createExpense, createRevenue } from '@/lib/services/business';
import type { Params } from '@/lib/api';

export const POST = route<Params<'kind'>>(async (req, ctx) => {
  const s = await requireApi(req, 'finance.write');
  const { kind } = await ctx.params;
  const body = await readBody(req);
  if (kind === 'budgets') await createBudget(s, body);
  else if (kind === 'expenses') await createExpense(s, body);
  else if (kind === 'revenues') await createRevenue(s, body);
  else throw badRequest('unknown_kind');
  return respond(req, { ok: true }, { redirect: '/os/finance' });
});
