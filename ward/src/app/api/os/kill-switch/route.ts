import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { setAgentsPaused } from '@/lib/killswitch';

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'kill_switch');
  const b = await readBody(req);
  const result = await setAgentsPaused(s, b.paused === true || b.paused === 'true');
  return respond(req, result);
});
