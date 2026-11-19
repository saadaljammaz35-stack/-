import { randomUUID } from 'node:crypto';
import { requireStaff } from '@/lib/auth/staff';
import { adminDb } from '@/lib/supabase/admin';
import { AppError, errorResponse } from '@/lib/errors';
import { sniffReceipt } from '@/lib/payments/receipt';

const MAX = 5 * 1024 * 1024;

/** Image upload for menu imagery (menu.manage) and site assets such as the bank QR (settings.manage). */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const bucket = form.get('bucket') === 'assets' ? 'assets' : 'menu';
    await requireStaff(bucket === 'assets' ? 'settings.manage' : 'menu.manage');
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) throw new AppError('invalid_request');
    if (file.size > MAX) throw new AppError('receipt_too_large', 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffReceipt(bytes);
    if (!kind || !['image/png', 'image/jpeg', 'image/webp'].includes(kind.mime)) throw new AppError('receipt_type', 415);
    const folder = String(form.get('folder') ?? 'misc').replace(/[^a-z0-9-]/gi, '').slice(0, 30) || 'misc';
    const path = `${folder}/${randomUUID()}.${kind.ext}`;
    const db = adminDb();
    const { error } = await db.storage.from(bucket).upload(path, bytes, { contentType: kind.mime, cacheControl: '31536000', upsert: false });
    if (error) throw new AppError('upload_failed', 502, { message: error.message });
    return Response.json({ url: db.storage.from(bucket).getPublicUrl(path).data.publicUrl });
  } catch (e) {
    return errorResponse(e);
  }
}
