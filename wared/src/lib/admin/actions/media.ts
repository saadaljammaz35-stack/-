'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { staffFor } from '@/lib/admin/auth';
import { revalidateContent } from '@/lib/admin/revalidate';
import { storagePublicUrl } from '@/lib/env';
import { signatureMatches } from '@/lib/security/file-signature';
import { getServiceClient } from '@/lib/supabase/admin';
import { getSessionClient } from '@/lib/supabase/server';
import { dbErrorMessage, optText, uploadFinalizeSchema, uploadRequestSchema, type AdminResult } from '@/lib/validation/admin';

/** Allowed types and size limits per bucket (mirrored by the bucket settings in the storage migration). */
const RULES = {
  images: { kind: 'image', maxBytes: 10 * 1024 * 1024, types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' } },
  audio: {
    kind: 'audio',
    maxBytes: 500 * 1024 * 1024,
    types: { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/wav': 'wav' },
  },
  video: { kind: 'video', maxBytes: 300 * 1024 * 1024, types: { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' } },
} as const;

type Bucket = keyof typeof RULES;

export type UploadTicket = { ok: true; bucket: Bucket; path: string; token: string } | { ok: false; error: string };

/** Step 1: the server checks permission, type and size, then issues a short-lived signed upload URL. */
export async function createUpload(input: unknown): Promise<UploadTicket> {
  const staff = await staffFor('media.upload');
  if (!staff) return { ok: false, error: 'ليست لديك صلاحية رفع الملفات.' };
  const parsed = uploadRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'بيانات الملف غير صالحة.' };
  const { bucket, mimeType, size } = parsed.data;
  const rule = RULES[bucket];
  const ext = (rule.types as Record<string, string>)[mimeType];
  if (!ext) return { ok: false, error: 'نوع الملف غير مسموح.' };
  if (size > rule.maxBytes) return { ok: false, error: `حجم الملف أكبر من الحد المسموح (${Math.round(rule.maxBytes / 1024 / 1024)} ميغابايت).` };
  const service = getServiceClient();
  if (!service) return { ok: false, error: 'التخزين غير مهيأ. أضف مفتاح Supabase السري.' };
  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${ext}`;
  const { data, error } = await service.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[media] signed upload failed', error?.message);
    return { ok: false, error: 'تعذّر تجهيز الرفع.' };
  }
  return { ok: true, bucket, path, token: data.token };
}

async function readHead(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-63' }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok && response.status !== 206) return null;
    const buffer = new Uint8Array(await response.arrayBuffer());
    return buffer.subarray(0, 64);
  } catch {
    return null;
  }
}

/** Step 2: after the browser uploads, verify the stored object's real type from its first bytes and register it. */
export async function finalizeUpload(input: unknown): Promise<AdminResult & { asset?: { id: string; url: string; label: string } }> {
  const staff = await staffFor('media.upload');
  if (!staff) return { ok: false, error: 'ليست لديك صلاحية رفع الملفات.' };
  const parsed = uploadFinalizeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'بيانات الملف غير صالحة.' };
  const f = parsed.data;
  const service = getServiceClient();
  const db = await getSessionClient();
  if (!service || !db) return { ok: false, error: 'التخزين غير مهيأ.' };

  const url = storagePublicUrl(f.bucket, f.path);
  const head = url ? await readHead(url) : null;
  if (!head || !signatureMatches(f.mimeType, head)) {
    await service.storage.from(f.bucket).remove([f.path]);
    return { ok: false, error: 'محتوى الملف لا يطابق نوعه المعلن، فتم رفضه.' };
  }

  const { data, error } = await db
    .from('media_assets')
    .insert({
      bucket: f.bucket,
      path: f.path,
      kind: RULES[f.bucket].kind,
      mime_type: f.mimeType,
      bytes: f.size,
      width: f.width,
      height: f.height,
      duration_seconds: f.durationSeconds,
      alt: f.alt,
      original_name: f.originalName.slice(0, 255),
      uploaded_by: staff.id,
    })
    .select('id')
    .single();
  if (error) {
    await service.storage.from(f.bucket).remove([f.path]);
    return { ok: false, error: dbErrorMessage(error) };
  }
  return { ok: true, message: 'تم الرفع', asset: { id: data.id, url: url!, label: f.originalName } };
}

export async function updateMedia(input: unknown): Promise<AdminResult> {
  const staff = await staffFor('media.upload');
  const db = await getSessionClient();
  if (!staff || !db) return { ok: false, error: 'ليست لديك صلاحية.' };
  const parsed = z.object({ id: z.uuid(), alt: optText(300), alt_en: optText(300), credit: optText(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'بيانات غير صالحة.' };
  const { id, ...data } = parsed.data;
  const { error } = await db.from('media_assets').update(data).eq('id', id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateContent();
  return { ok: true, message: 'تم الحفظ' };
}

export async function deleteMedia(id: string): Promise<AdminResult> {
  const staff = await staffFor('media.delete');
  const db = await getSessionClient();
  const service = getServiceClient();
  if (!staff || !db || !service) return { ok: false, error: 'ليست لديك صلاحية حذف الملفات.' };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: 'طلب غير صالح' };
  const { data, error } = await db.from('media_assets').delete().eq('id', id).select('bucket, path');
  if (error) return { ok: false, error: dbErrorMessage(error) };
  const row = data?.[0];
  if (!row) return { ok: false, error: 'الملف غير موجود.' };
  await service.storage.from(row.bucket as string).remove([row.path as string]);
  revalidateContent();
  return { ok: true, message: 'تم حذف الملف' };
}
