import { z } from 'zod';
import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { enforce, LIMITS } from '@/lib/security/rate-limit';
import { startWorkflow } from '@/lib/orchestrator';
import { scheduleQueue } from '@/lib/api';

const Body = z.object({
  command: z.string().trim().min(3).max(4000),
  cost_limit_usd: z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().positive().max(100).optional()),
});

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'agents.run');
  await enforce(`ai:${s.userId}`, LIMITS.aiPerUser.limit, LIMITS.aiPerUser.windowSec);
  const body = Body.parse(await readBody(req));
  const id = await startWorkflow(s, { command: body.command, costLimitUsd: body.cost_limit_usd });
  scheduleQueue();
  return respond(req, { id }, { redirect: `/os/runs/${id}` });
});
