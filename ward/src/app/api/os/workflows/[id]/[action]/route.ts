import { z } from 'zod';
import { badRequest, readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { cancelWorkflow, resumeWorkflow } from '@/lib/orchestrator';
import { scheduleQueue, type Params } from '@/lib/api';

export const maxDuration = 300;

export const POST = route<Params<'id' | 'action'>>(async (req, ctx) => {
  const s = await requireApi(req, 'agents.run');
  const { id, action } = await ctx.params;
  const body = z.object({ cost_limit_usd: z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().positive().max(100).optional()) }).parse(await readBody(req));
  if (action === 'cancel') await cancelWorkflow(s, id);
  else if (action === 'retry' || action === 'resume') {
    await resumeWorkflow(s, id, { mode: action, costLimitUsd: body.cost_limit_usd });
    scheduleQueue();
  } else throw badRequest('unknown_action');
  return respond(req, { ok: true }, { redirect: `/os/runs/${id}` });
});
