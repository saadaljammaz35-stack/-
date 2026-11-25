import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { saveGuest } from '@/lib/services/content';

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'content.write');
  const id = await saveGuest(s, null, await readBody(req));
  return respond(req, { id }, { redirect: '/os/episodes?tab=guests' });
});
