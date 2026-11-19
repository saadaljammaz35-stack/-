import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { adminDb } from '@/lib/supabase/admin';
import { AppError, errorResponse, fromDbError } from '@/lib/errors';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { MAX_RECEIPT_BYTES, sniffReceipt } from '@/lib/payments/receipt';
import { notifyCustomer, notifyStaffNewOrder } from '@/lib/notify';

/**
 * Bank transfer: the customer uploads the transfer receipt. The file goes to a PRIVATE bucket,
 * the order moves to "awaiting approval", and staff verify the money arrived before accepting.
 */
export async function POST(req: Request) {
  try {
    await rateLimit('pay:receipt', await clientIp(), 10, 600);
    const form = await req.formData();
    const token = String(form.get('token') ?? '');
    const file = form.get('receipt');
    if (!/^[A-Za-z0-9_-]{20,60}$/.test(token) || !(file instanceof File)) throw new AppError('invalid_request');
    if (file.size === 0 || file.size > MAX_RECEIPT_BYTES) throw new AppError('receipt_too_large', 413);

    const db = adminDb();
    const [{ data: o }, { data: s }] = await Promise.all([
      db.from('orders').select('id, status, payment_status, total').eq('tracking_token', token).maybeSingle(),
      db.from('store_settings').select('payment_methods, bank_iban').eq('id', 1).single(),
    ]);
    if (!o) throw new AppError('order_not_found', 404);
    if (!s?.payment_methods?.bank_transfer || !s.bank_iban) throw new AppError('payment_unavailable', 503);
    const replacing = o.status === 'awaiting_approval' && o.payment_status === 'pending_verification';
    if (o.status !== 'pending_payment' && !replacing) throw new AppError('invalid_transition', 409);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffReceipt(bytes);
    if (!kind) throw new AppError('receipt_type', 415);

    const path = `${o.id}/${randomUUID()}.${kind.ext}`;
    const up = await db.storage.from('receipts').upload(path, bytes, { contentType: kind.mime, upsert: false });
    if (up.error) throw new AppError('upload_failed', 502, { message: up.error.message });

    const { data: pay, error: payErr } = await db.from('payments')
      .insert({ order_id: o.id, provider: 'bank_transfer', amount: o.total, status: 'initiated', method: 'bank_transfer', receipt_path: path, receipt_mime: kind.mime })
      .select('id').single();
    if (payErr) throw fromDbError(payErr);
    const { data, error } = await db.rpc('submit_bank_transfer', { p_order: o.id, p_payment_row: pay.id });
    if (error) throw fromDbError(error);
    if ((data as { transitioned: boolean }).transitioned) {
      after(() => Promise.all([notifyCustomer(o.id, 'order_received'), notifyStaffNewOrder(o.id)]));
    }
    return Response.json({ ok: true, token });
  } catch (e) {
    return errorResponse(e);
  }
}
