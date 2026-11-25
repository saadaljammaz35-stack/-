import { z } from 'zod';
import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { enforce, LIMITS } from '@/lib/security/rate-limit';
import { startMeeting } from '@/lib/meetings';
import { AGENTS, type AgentSlug } from '@/lib/agents/definitions';
import { scheduleQueue } from '@/lib/api';

const SLUGS = AGENTS.map((a) => a.slug) as [AgentSlug, ...AgentSlug[]];
const Body = z.object({
  topic: z.string().trim().min(3).max(2000),
  agents: z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.enum(SLUGS)).min(2).max(9)),
  rounds: z.coerce.number().int().min(1).max(3),
});

export const maxDuration = 300;

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'agents.run');
  await enforce(`ai:${s.userId}`, LIMITS.aiPerUser.limit, LIMITS.aiPerUser.windowSec);
  const body = Body.parse(await readBody(req));
  const id = await startMeeting(s, body);
  scheduleQueue();
  return respond(req, { id }, { redirect: `/os/meetings/${id}` });
});
