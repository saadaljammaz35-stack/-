import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { decideDecision } from '@/lib/services/content';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'approvals.decide');
  const b = await readBody(req);
  await decideDecision(s, (await ctx.params).id, b.decision === 'approve');
  return respond(req, { ok: true });
});
