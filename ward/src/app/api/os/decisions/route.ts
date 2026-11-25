import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { createDecision } from '@/lib/services/content';

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'approvals.decide');
  const id = await createDecision(s, await readBody(req));
  return respond(req, { id }, { redirect: '/os/approvals#decisions' });
});
