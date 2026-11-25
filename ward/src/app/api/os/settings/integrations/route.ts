import { respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { checkIntegrations } from '@/lib/services/admin';

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'settings.write');
  const result = await checkIntegrations(s);
  return respond(req, result, { redirect: '/os/settings?checked=1' });
});
