import { withOrg } from '@/lib/db';
import { notFound, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import type { Params } from '@/lib/api';

/** Private files are only served to signed-in members of the owning organization. */
export const GET = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'read');
  const { id } = await ctx.params;
  const file = (await withOrg(s, (q) => q.query<{ name: string; mime: string; data: Uint8Array }>('select name, mime, data from ward.stored_files where id = $1', [id])))[0];
  if (!file) throw notFound();
  const inline = file.mime.startsWith('image/') || file.mime === 'application/pdf';
  return new Response(new Uint8Array(file.data), {
    headers: {
      'content-type': file.mime,
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
