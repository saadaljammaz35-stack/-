import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { createTask } from '@/lib/services/tasks';

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'content.write');
  const id = await createTask(s, await readBody(req));
  return respond(req, { id });
});
