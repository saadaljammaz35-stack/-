import { after } from 'next/server';
import { badRequest } from '@/lib/http';
import { kickQueue } from '@/lib/queue/worker';
import { MAX_UPLOAD_BYTES, sniff, type FileKind } from '@/lib/knowledge/extract';

export type Params<K extends string> = { params: Promise<Record<K, string>> };

/** Process newly queued jobs right after the response is sent (cron/worker remain the safety net). */
export function scheduleQueue(): void {
  try {
    after(async () => {
      await kickQueue();
    });
  } catch {
    void kickQueue(); // outside a request scope (tests, scripts)
  }
}

export interface Upload {
  name: string;
  data: Uint8Array;
  kind: FileKind;
  mime: string;
  fields: Record<string, string>;
}

export async function readUpload(req: Request, field = 'file'): Promise<Upload> {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.startsWith('multipart/form-data')) throw badRequest('multipart_required');
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw badRequest('file_too_large', `max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
  const form = await req.formData();
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) throw badRequest('file_required');
  if (file.size > MAX_UPLOAD_BYTES) throw badRequest('file_too_large', `max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
  const data = new Uint8Array(await file.arrayBuffer());
  const { kind, mime } = sniff(data, file.name);
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') fields[k] = v;
  return { name: file.name, data, kind, mime, fields };
}
