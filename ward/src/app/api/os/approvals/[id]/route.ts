import { z } from 'zod';
import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { decideApproval } from '@/lib/approvals';
import type { Params } from '@/lib/api';

/** Founder-only (enforced again inside decideApproval). */
export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'approvals.decide');
  const b = z.object({ decision: z.enum(['approve', 'reject']), note: z.string().max(2000).optional() }).parse(await readBody(req));
  const result = await decideApproval(s, (await ctx.params).id, b.decision, b.note?.trim() || null);
  return respond(req, result, { redirect: '/os/approvals' });
});
