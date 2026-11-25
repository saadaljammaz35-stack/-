import { NextResponse } from 'next/server';
import { badRequest, HttpError, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { assertKey, getStorage, maxUploadBytes, storageKind, writeLocal } from '@/lib/media/storage';

export const maxDuration = 300;

/**
 * Vercel Blob: issues a short-lived client token so the browser uploads the video straight
 * into the PRIVATE store (multipart, resumable parts) — the file never passes through a function.
 * Only signed-in editors get a token, only for a path inside their own organization.
 */
export const POST = route(async (req) => {
  const s = await requireApi(req, 'content.write');
  if (storageKind() !== 'vercel-blob') throw badRequest('wrong_storage');
  const { handleUpload } = await import('@vercel/blob/client');
  const body = (await req.json()) as Parameters<typeof handleUpload>[0]['body'];
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      assertKey(pathname, s.orgId);
      return {
        allowedContentTypes: ['video/*', 'audio/*', 'application/octet-stream'],
        maximumSizeInBytes: maxUploadBytes(),
        validUntil: Date.now() + 6 * 3600_000,
        addRandomSuffix: false,
        allowOverwrite: false,
      };
    },
  });
  return NextResponse.json(result);
});

/** Local storage (development / single server): the browser PUTs the file body here. */
export const PUT = route(async (req) => {
  const s = await requireApi(req, 'content.write');
  if (storageKind() !== 'local') throw badRequest('wrong_storage');
  const key = new URL(req.url).searchParams.get('key') ?? '';
  try {
    assertKey(key, s.orgId);
  } catch {
    throw badRequest('invalid_media_key');
  }
  if (!req.body) throw badRequest('file_required');
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxUploadBytes()) throw badRequest('file_too_large');
  try {
    const size = await writeLocal(key, req.body, maxUploadBytes());
    if (declared && size !== declared) {
      await getStorage('local').delete([key]);
      throw badRequest('upload_incomplete', `received ${size} of ${declared} bytes`);
    }
    return NextResponse.json({ ok: true, size });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('EEXIST')) throw badRequest('already_uploaded');
    if (msg.includes('file_too_large')) throw badRequest('file_too_large');
    throw err;
  }
});
