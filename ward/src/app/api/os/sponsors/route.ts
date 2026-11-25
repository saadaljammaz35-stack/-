import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { saveSponsor } from '@/lib/services/business';

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'sponsors.write');
  const id = await saveSponsor(s, null, await readBody(req));
  return respond(req, { id }, { redirect: `/os/sponsors/${id}` });
});
