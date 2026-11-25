import { withOrg } from '@/lib/db';
import { badRequest, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { enforce, LIMITS } from '@/lib/security/rate-limit';
import { storeFile } from '@/lib/services/admin';
import { readUpload, type Params } from '@/lib/api';

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'sponsors.write');
  await enforce(`upload:${s.userId}`, LIMITS.uploadPerUser.limit, LIMITS.uploadPerUser.windowSec);
  const { id } = await ctx.params;
  const up = await readUpload(req);
  if (up.kind !== 'image') throw badRequest('logo_must_be_an_image');
  const fileId = await storeFile(s, { name: up.name, mime: up.mime, data: up.data, purpose: 'logo', sponsorId: id });
  await withOrg(s, (q) => q.query('update ward.sponsors set logo_file_id = $2 where id = $1', [id, fileId]));
  return respond(req, { fileId }, { redirect: `/os/sponsors/${id}` });
});
