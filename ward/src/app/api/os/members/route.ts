import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { addMember } from '@/lib/services/admin';

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'members.manage');
  await addMember(s, await readBody(req));
  return respond(req, { ok: true }, { redirect: '/os/settings#team' });
});
