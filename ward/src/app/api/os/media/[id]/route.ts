import { notFound, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { withOrg } from '@/lib/db';
import type { Params } from '@/lib/api';
import { getStorage, serveLocal, type StorageKind } from '@/lib/media/storage';

/**
 * Montage media for signed-in members of the owning organization only.
 * Vercel Blob: a redirect to a presigned URL that expires in 2 hours (the file streams from
 * storage, not through a function). Local storage: streamed here with Range support.
 */
export const GET = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'read');
  const { id } = await ctx.params;
  const a = (await withOrg(s, (q) =>
    q.query<{ storage: StorageKind; storage_key: string; mime: string; name: string }>('select storage, storage_key, mime, name from ward.media_assets where id = $1', [id]),
  ))[0];
  if (!a) throw notFound();
  const download = new URL(req.url).searchParams.has('download');
  const storage = getStorage(a.storage);
  const url = await storage.browserUrl(a.storage_key, 2 * 3600);
  if (url) return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'private, no-store' } });
  return serveLocal(a.storage_key, req, a.mime, download ? a.name : undefined);
});
