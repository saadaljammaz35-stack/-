import { respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { enforce, LIMITS } from '@/lib/security/rate-limit';
import { storeFile } from '@/lib/services/admin';
import { readUpload, type Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  await enforce(`upload:${s.userId}`, LIMITS.uploadPerUser.limit, LIMITS.uploadPerUser.windowSec);
  const { id } = await ctx.params;
  const up = await readUpload(req);
  await storeFile(s, { name: up.name, mime: up.mime, data: up.data, purpose: 'attachment', taskId: id });
  return respond(req, { ok: true }, { redirect: `/os/tasks/${id}` });
});
