import { createWriteStream, promises as fs } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeWebStream } from 'node:stream/web';
import { env } from '@/lib/env';

/**
 * Where montage media lives. Video never touches Postgres.
 *   local        a folder on the server (development, single-server deployments)
 *   vercel-blob  a PRIVATE Vercel Blob store: the browser uploads straight to it, the media
 *                runner reads and writes it through short-lived signed URLs/tokens, and the
 *                founder downloads through presigned links that expire.
 */
export type StorageKind = 'local' | 'vercel-blob';

export type RunnerTarget =
  | { kind: 'file'; path: string }
  | { kind: 'blob'; pathname: string; clientToken: string; contentType: string };

export interface MediaStorage {
  kind: StorageKind;
  /** Where the runner reads an object from: a local path or a presigned GET URL. */
  runnerInput(key: string, ttlSec: number): Promise<string>;
  /** Where the runner writes an object to. */
  runnerOutput(key: string, contentType: string, maxBytes: number, ttlSec: number): Promise<RunnerTarget>;
  head(key: string): Promise<{ size: number; contentType?: string } | null>;
  /** A URL the browser can fetch directly, or null when the app streams the file itself. */
  browserUrl(key: string, ttlSec: number): Promise<string | null>;
  delete(keys: string[]): Promise<void>;
}

const KEY_RE = /^ward\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/;

/** ward/<org>/<episode>/<uuid>/<safe-name> */
export function mediaKey(orgId: string, episodeId: string, id: string, name: string): string {
  const ext = (path.extname(name).toLowerCase().match(/^\.[a-z0-9]{1,6}$/)?.[0]) ?? '';
  const base = path.basename(name, path.extname(name)).normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'media';
  return `ward/${orgId}/${episodeId}/${id}/${base}${ext}`;
}

export function assertKey(key: string, orgId: string): void {
  if (!KEY_RE.test(key) || !key.startsWith(`ward/${orgId}/`) || key.includes('..')) throw new Error('invalid_media_key');
}

export function storageKind(): StorageKind | null {
  const e = env();
  if (e.WARD_MEDIA_STORAGE) return e.WARD_MEDIA_STORAGE;
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'vercel-blob';
  if (process.env.VERCEL) return null; // serverless disk is ephemeral: no local storage in hosted mode
  return 'local';
}

export function maxUploadBytes(): number {
  return env().WARD_MEDIA_MAX_MB * 1024 * 1024;
}

// ─────────────────────────── local folder ───────────────────────────

export function localRoot(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().WARD_MEDIA_DIR);
}

export function localPath(key: string): string {
  const root = localRoot();
  const p = path.resolve(root, key);
  if (!p.startsWith(root + path.sep)) throw new Error('invalid_media_key');
  return p;
}

const local: MediaStorage = {
  kind: 'local',
  async runnerInput(key) {
    return localPath(key);
  },
  async runnerOutput(key) {
    return { kind: 'file', path: localPath(key) };
  },
  async head(key) {
    try {
      const st = await fs.stat(localPath(key));
      return st.isFile() ? { size: st.size } : null;
    } catch {
      return null;
    }
  },
  async browserUrl() {
    return null;
  },
  async delete(keys) {
    for (const k of keys) await fs.rm(localPath(k), { force: true }).catch(() => {});
  },
};

/** Stream an upload body to the local store, refusing anything larger than maxBytes. */
export async function writeLocal(key: string, body: ReadableStream<Uint8Array>, maxBytes: number): Promise<number> {
  const file = localPath(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  let size = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      size += chunk.byteLength;
      if (size > maxBytes) ctrl.error(new Error('file_too_large'));
      else ctrl.enqueue(chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(body.pipeThrough(counter) as unknown as NodeWebStream), createWriteStream(file, { flags: 'wx' }));
  } catch (err) {
    await fs.rm(file, { force: true }).catch(() => {});
    throw err;
  }
  return size;
}

/** Serve a local file with HTTP Range support (video seeking). */
export async function serveLocal(key: string, req: Request, contentType: string, downloadName?: string): Promise<Response> {
  const file = localPath(key);
  const st = await fs.stat(file);
  const headers: Record<string, string> = {
    'content-type': contentType,
    'accept-ranges': 'bytes',
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
  };
  if (downloadName) headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    let end = range[1] && range[2] ? Number(range[2]) : st.size - 1;
    end = Math.min(end, st.size - 1);
    start = Math.min(start, end);
    if (start >= st.size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${st.size}` } });
    headers['content-range'] = `bytes ${start}-${end}/${st.size}`;
    headers['content-length'] = String(end - start + 1);
    return new Response(fileStream(file, start, end), { status: 206, headers });
  }
  headers['content-length'] = String(st.size);
  return new Response(fileStream(file, 0, st.size - 1), { status: 200, headers });
}

/**
 * A pull-based stream over a byte range. Video players cancel range requests constantly;
 * reading only on demand (and closing the file on cancel) avoids writing to a closed stream.
 */
function fileStream(file: string, start: number, end: number): ReadableStream<Uint8Array> {
  let handle: FileHandle | null = null;
  let pos = start;
  const close = async () => {
    const h = handle;
    handle = null;
    await h?.close().catch(() => {});
  };
  return new ReadableStream<Uint8Array>({
    async start() {
      handle = await fs.open(file, 'r');
    },
    async pull(ctrl) {
      if (!handle) return;
      const size = Math.min(256 * 1024, end - pos + 1);
      if (size <= 0) {
        await close();
        ctrl.close();
        return;
      }
      const buf = new Uint8Array(size);
      const { bytesRead } = await handle.read(buf, 0, size, pos);
      if (bytesRead === 0) {
        await close();
        ctrl.close();
        return;
      }
      pos += bytesRead;
      ctrl.enqueue(buf.subarray(0, bytesRead));
    },
    async cancel() {
      await close();
    },
  });
}

// ─────────────────────────── Vercel Blob (private) ───────────────────────────

async function signed(key: string, operation: 'get', ttlSec: number): Promise<string> {
  const { issueSignedToken, presignUrl } = await import('@vercel/blob');
  const validUntil = Date.now() + ttlSec * 1000;
  const token = await issueSignedToken({ pathname: key, operations: [operation], validUntil });
  const { presignedUrl } = await presignUrl(token, { operation, pathname: key, access: 'private', validUntil });
  return presignedUrl;
}

const blob: MediaStorage = {
  kind: 'vercel-blob',
  async runnerInput(key, ttlSec) {
    return signed(key, 'get', ttlSec);
  },
  async runnerOutput(key, contentType, maxBytes, ttlSec) {
    const { generateClientTokenFromReadWriteToken } = await import('@vercel/blob/client');
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname: key,
      maximumSizeInBytes: maxBytes,
      validUntil: Date.now() + ttlSec * 1000,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { kind: 'blob', pathname: key, clientToken, contentType };
  },
  async head(key) {
    const { head, BlobNotFoundError } = await import('@vercel/blob');
    try {
      const h = await head(key);
      return { size: h.size, contentType: h.contentType };
    } catch (err) {
      if (err instanceof BlobNotFoundError) return null;
      throw err;
    }
  },
  async browserUrl(key, ttlSec) {
    return signed(key, 'get', ttlSec);
  },
  async delete(keys) {
    if (!keys.length) return;
    const { del } = await import('@vercel/blob');
    await del(keys).catch((err) => console.error('[ward] blob delete failed', err));
  },
};

export function getStorage(kind?: StorageKind | null): MediaStorage {
  const k = kind ?? storageKind();
  if (k === 'vercel-blob') return blob;
  if (k === 'local') return local;
  throw new Error('media_storage_not_configured');
}
