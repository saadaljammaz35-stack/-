import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { enforce, LIMITS } from '@/lib/security/rate-limit';
import { changePassword } from '@/lib/services/admin';

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'read');
  await enforce(`pwchange:${s.userId}`, LIMITS.loginPerEmail.limit, LIMITS.loginPerEmail.windowSec);
  await changePassword(s, await readBody(req));
  return respond(req, { ok: true }, { redirect: '/os/settings?saved=1#account' });
});
