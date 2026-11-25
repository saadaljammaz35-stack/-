import { respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { cancelMeeting } from '@/lib/meetings';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'agents.run');
  const { id } = await ctx.params;
  await cancelMeeting(s, id);
  return respond(req, { ok: true }, { redirect: `/os/meetings/${id}` });
});
