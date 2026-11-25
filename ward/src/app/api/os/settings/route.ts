import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { updateSettings } from '@/lib/services/admin';

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'settings.write');
  const body = await readBody(req);
  // Form fields "model.<provider>.<tier>" → models map.
  const models: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) if (k.startsWith('model.') && typeof v === 'string') models[k.slice(6)] = v;
  if (Object.keys(models).length) body.models = models;
  for (const k of Object.keys(body)) if (k.startsWith('model.')) delete body[k];
  await updateSettings(s, body);
  return respond(req, { ok: true }, { redirect: '/os/settings?saved=1' });
});
