import { respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { forgetMemory } from '@/lib/services/admin';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'agents.configure');
  await forgetMemory(s, (await ctx.params).id);
  return respond(req, { ok: true });
});
