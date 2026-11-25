import { z } from 'zod';
import { NextResponse } from 'next/server';
import { forbidden, notFound, readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { can } from '@/lib/auth/permissions';
import { withOrg } from '@/lib/db';
import { scheduleQueue, type Params } from '@/lib/api';
import { PlanEditSchema, planStats } from '@/lib/media/plan';
import { cancelProject, deleteProject, loadProject, reanalyze, replan, startRender, syncProject, updatePlan } from '@/lib/media/montage';

export const maxDuration = 120;

/** Status for the review page (also nudges the runner check, at most every few seconds). */
export const GET = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'read');
  const { id } = await ctx.params;
  const exists = await withOrg(s, (q) => loadProject(q, id));
  if (!exists) throw notFound();
  if (exists.status === 'analyzing' || exists.status === 'rendering') await syncProject(s.orgId, id).catch(() => 'idle');
  scheduleQueue();
  const p = (await withOrg(s, (q) => loadProject(q, id)))!;
  return NextResponse.json({ id: p.id, status: p.status, stage: p.stage, progress: p.progress, error: p.error, stats: p.plan ? planStats(p.plan) : null, updated_at: p.updated_at });
});

const Action = z.object({
  action: z.enum(['save', 'render', 'cancel', 'reanalyze', 'replan', 'delete']),
}).passthrough();

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  const { id } = await ctx.params;
  const raw = await readBody(req);
  const { action } = Action.parse(raw);
  const back = `/os/montage/${id}`;
  switch (action) {
    case 'save': {
      const plan = await updatePlan(s, id, PlanEditSchema.parse(raw));
      return respond(req, { ok: true, stats: planStats(plan), plan }, { redirect: back });
    }
    case 'render':
      await startRender(s, id);
      break;
    case 'cancel':
      await cancelProject(s, id);
      break;
    case 'reanalyze':
      await reanalyze(s, id);
      break;
    case 'replan':
      await replan(s, id);
      break;
    case 'delete': {
      if (!can(s.role, 'media.delete')) throw forbidden('missing_permission:media.delete');
      const episodeId = (await withOrg(s, (q) => loadProject(q, id)))?.episode_id;
      await deleteProject(s, id);
      return respond(req, { ok: true }, { redirect: episodeId ? `/os/episodes/${episodeId}` : '/os/episodes' });
    }
  }
  scheduleQueue();
  return respond(req, { ok: true }, { redirect: back });
});
