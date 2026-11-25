import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { changeMemberRole } from '@/lib/services/admin';
import type { Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'members.manage');
  await changeMemberRole(s, (await ctx.params).id, String((await readBody(req)).role ?? ''));
  return respond(req, { ok: true }, { redirect: '/os/settings#team' });
});
