import { respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { runAutomationNow } from '@/lib/services/admin';
import { scheduleQueue, type Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'settings.write');
  await runAutomationNow(s, (await ctx.params).id);
  scheduleQueue();
  return respond(req, { ok: true }, { redirect: '/os/automations?queued=1' });
});
