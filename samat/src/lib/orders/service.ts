import 'server-only';
import { z } from 'zod';
import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminDb } from '@/lib/supabase/admin';
import { AppError, fromDbError } from '@/lib/errors';
import { normalizeSaudiPhone } from '@/lib/phone';
import { activeProvider, gatewayFor, paymentsConfigured } from '@/lib/payments';
import { GatewayError, type GatewayPayment } from '@/lib/payments/types';
import { notifyCustomer, notifyStaffAlert, notifyStaffNewOrder } from '@/lib/notify';
import { env } from '@/lib/env';

// ------------------------------------------------------------------------------------ validation
const uuid = z.string().uuid();
const qtyMap = z.record(z.string().uuid(), z.number().int().min(0).max(10));

export const ItemSchema = z.object({
  product_id: uuid,
  quantity: z.number().int().min(1).max(20),
  bread_id: uuid.nullable().optional(),
  ingredients: qtyMap.optional(),
  sauces: qtyMap.optional(),
  options: z.array(uuid).max(20).optional(),
  notes: z.string().trim().max(200).optional(),
});

export const QuoteSchema = z.object({
  items: z.array(ItemSchema).min(1).max(30),
  coupon_code: z.string().trim().max(32).optional(),
  reward_id: uuid.optional(),
  redeem_points: z.number().int().min(0).max(1_000_000).optional(),
  phone: z.string().max(20).optional(),
});

export const CheckoutSchema = QuoteSchema.extend({
  idempotency_key: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().max(20),
    email: z.string().trim().email().max(120).optional().or(z.literal('')),
  }),
  notes: z.string().trim().max(300).optional(),
  locale: z.enum(['ar', 'en']).default('ar'),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new AppError('invalid_request', 400, { issues: r.error.issues.slice(0, 5).map((i) => i.path.join('.')) });
  return r.data;
}

// ---------------------------------------------------------------------------------- quote/create
export async function quote(input: unknown, customerId: string | null) {
  const q = parse(QuoteSchema, input);
  const phone = q.phone ? normalizeSaudiPhone(q.phone) : null;
  const db = adminDb();
  const [{ data, error }, { data: s }] = await Promise.all([
    db.rpc('place_order', {
      p: { items: q.items, coupon_code: q.coupon_code, reward_id: q.reward_id, redeem_points: q.redeem_points,
           customer: { phone, user_id: customerId } },
      p_dry_run: true,
    }),
    db.from('store_settings').select('loyalty_enabled, loyalty_points_per_sar').eq('id', 1).single(),
  ]);
  if (error) throw fromDbError(error);
  // Same rule as loyalty_earn_for_order: points on the amount paid, granted after pickup.
  const total = Number((data as { total?: number }).total ?? 0);
  const points_to_earn = s?.loyalty_enabled ? Math.floor((total / 100) * Number(s.loyalty_points_per_sar)) : 0;
  return { ...(data as object), points_to_earn };
}

export async function createOrder(input: unknown, customerId: string | null) {
  const c = parse(CheckoutSchema, input);
  const phone = normalizeSaudiPhone(c.customer.phone);
  if (!phone) throw new AppError('invalid_request', 400, { field: 'phone' });
  const { data, error } = await adminDb().rpc('place_order', {
    p: {
      idempotency_key: c.idempotency_key,
      customer: { name: c.customer.name, phone, email: c.customer.email || null, user_id: customerId, locale: c.locale },
      notes: c.notes,
      coupon_code: c.coupon_code,
      reward_id: c.reward_id,
      redeem_points: c.redeem_points,
      items: c.items,
    },
    p_dry_run: false,
  });
  if (error) throw fromDbError(error);
  const res = data as { order_id: string; tracking_token: string; status: string; replay: boolean; payment_required: boolean };
  if (!res.replay && res.status === 'awaiting_approval') {
    // fully covered by a discount/points: no payment step, goes straight to the restaurant
    after(() => Promise.all([notifyCustomer(res.order_id, 'order_received'), notifyStaffNewOrder(res.order_id)]));
  }
  return res;
}

// -------------------------------------------------------------------------------------- tracking
export async function getTrackedOrder(token: string) {
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) return null;
  const { data } = await adminDb()
    .from('orders')
    .select(`id, order_number, pickup_code, pickup_token, status, payment_status, customer_name, locale, subtotal, discount_total,
      coupon_discount, points_discount, vat_amount, vat_rate_bps, prices_include_vat, total, notes, reject_reason, cancel_reason,
      prep_minutes, estimated_ready_at, expires_at, created_at, accepted_at, preparing_at, ready_at, delivered_at, points_earned,
      points_redeemed, coupon_code, customer_id,
      invoices(invoice_number),
      items:order_items(id, product_id, product_name_ar, product_name_en, quantity, unit_price, line_total, bread_name_ar,
        bread_name_en, notes, selection, sort_order,
        customizations:order_customizations(kind, action, quantity, name_ar, name_en, total_price, sort_order))`)
    .eq('tracking_token', token)
    .maybeSingle();
  if (!data) return null;
  const d = data as Record<string, unknown> & { invoices: unknown; items: { sort_order: number }[] };
  const inv = Array.isArray(d.invoices) ? d.invoices[0] : d.invoices;
  d.items.sort((a, b) => a.sort_order - b.sort_order);
  return { ...d, invoice_number: (inv as { invoice_number?: string } | null)?.invoice_number ?? null, invoices: undefined };
}

// --------------------------------------------------------------------------------------- payment
export async function initPayment(token: string) {
  const db = adminDb();
  const { data: o } = await db.from('orders').select('id, status, total, order_number, expires_at').eq('tracking_token', token).maybeSingle();
  if (!o) throw new AppError('order_not_found', 404);
  if (o.status !== 'pending_payment') throw new AppError('invalid_transition', 409, { status: o.status });
  if (o.expires_at && new Date(o.expires_at).getTime() < Date.now()) throw new AppError('invalid_transition', 409, { status: 'expired' });
  if (!paymentsConfigured()) throw new AppError('payment_unavailable', 503);
  const provider = activeProvider();
  const { data: row, error } = await db.from('payments')
    .insert({ order_id: o.id, provider, amount: o.total, status: 'initiated' })
    .select('id').single();
  if (error) throw fromDbError(error);
  return { paymentRowId: row.id as string, orderId: o.id as string, amount: o.total as number, orderNumber: o.order_number as number, provider };
}

/**
 * Verify a payment with the gateway (never trusting the browser or the webhook body) and move the
 * order forward. Safe to call any number of times from the callback page, the form hook and the webhook.
 */
export async function confirmPayment(providerPaymentId: string, provider: 'moyasar' | 'simulator', expectedOrderId?: string) {
  const gateway = gatewayFor(provider);
  let p: GatewayPayment;
  try {
    p = await gateway.fetchPayment(providerPaymentId);
  } catch (e) {
    throw new AppError('payment_unavailable', 502, { message: e instanceof Error ? e.message : String(e) });
  }
  const orderId = p.metadata.order_id;
  const paymentRowId = p.metadata.payment_row_id;
  if (!orderId || !paymentRowId || (expectedOrderId && orderId !== expectedOrderId)) {
    throw new AppError('invalid_request', 400, { reason: 'payment does not belong to this order' });
  }
  const db = adminDb();
  const { data: row } = await db.from('payments').select('id, order_id, provider').eq('id', paymentRowId).maybeSingle();
  if (!row || row.order_id !== orderId || row.provider !== provider) throw new AppError('invalid_request', 400, { reason: 'unknown payment' });
  const { data: order } = await db.from('orders').select('id, total, status, tracking_token').eq('id', orderId).single();
  if (!order) throw new AppError('order_not_found', 404);

  if (p.status === 'failed') {
    await db.rpc('mark_payment_failed', { p_order: orderId, p_payment_row: paymentRowId, p_provider_payment_id: p.id, p_message: p.message ?? 'failed' });
    return { status: order.status as string, payment: 'failed' as const, token: order.tracking_token as string };
  }
  if (p.status !== 'paid' && p.status !== 'authorized') {
    return { status: order.status as string, payment: p.status, token: order.tracking_token as string };
  }
  if (p.currency !== 'SAR' || p.amount !== order.total) {
    // Paid the wrong amount (tampered form). Never accept it: refund and flag.
    await refundStray(gateway.name, p, 'amount mismatch');
    throw new AppError('payment_amount_mismatch', 400);
  }

  const { data, error } = await db.rpc('mark_order_paid', {
    p_order: orderId,
    p_payment: { provider, provider_payment_id: p.id, payment_row_id: paymentRowId, amount: p.amount, status: p.status,
                 method: p.method, card_scheme: p.scheme, card_last4: p.last4, live: p.live },
  });
  if (error) throw fromDbError(error);
  const r = data as { transitioned: boolean; status: string; needs_refund?: boolean; reason?: string };
  if (r.needs_refund) {
    // paid after the hold lapsed and the stock is gone: give the money back automatically
    await refundStray(gateway.name, p, r.reason ?? 'late payment', paymentRowId);
  }
  if (r.transitioned) {
    after(() => Promise.all([notifyCustomer(orderId, 'order_received'), notifyStaffNewOrder(orderId)]));
  }
  return { status: r.status, payment: p.status, token: order.tracking_token as string };
}

async function refundStray(provider: 'moyasar' | 'simulator', p: GatewayPayment, why: string, paymentRowId?: string) {
  const gateway = gatewayFor(provider);
  try {
    const r = p.status === 'authorized' ? await gateway.void(p.id) : await gateway.refund(p.id);
    if (paymentRowId) {
      await adminDb().rpc('record_payment_update', { p_payment_row: paymentRowId, p: { status: r.status === 'voided' ? 'voided' : 'refunded', refunded_amount: r.refundedAmount, message: why } });
    }
  } catch (e) {
    await notifyStaffAlert('payment_problem', `stray:${p.id}`, 'مشكلة في الدفع — يحتاج استرجاع يدوي',
      [`Payment ${p.id} (${p.amount / 100} SAR) could not be refunded automatically: ${why}`, e instanceof Error ? e.message : String(e)]);
  }
}

// --------------------------------------------------------------------------------- staff actions
async function latestPayment(orderId: string) {
  const { data } = await adminDb().from('payments').select('id, provider, provider_payment_id, status, amount')
    .eq('order_id', orderId).in('status', ['authorized', 'paid', 'refund_pending']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data as { id: string; provider: 'moyasar' | 'simulator' | 'bank_transfer'; provider_payment_id: string | null; status: string; amount: number } | null;
}

/** Accept: capture an authorised payment with the gateway first, then accept in the database. */
export async function acceptOrder(staffDb: SupabaseClient, orderId: string, transferConfirmed = false) {
  const claim = await staffDb.rpc('staff_claim_decision', { p_order: orderId });
  if (claim.error) throw fromDbError(claim.error);
  try {
    const payStatus = (claim.data as { payment_status: string }).payment_status;
    if (payStatus === 'pending_verification') {
      // bank transfer: staff must explicitly confirm the money arrived in the account
      if (!transferConfirmed) throw new AppError('transfer_not_confirmed', 409);
      const r = await staffDb.rpc('staff_review_transfer', { p_order: orderId, p_received: true, p_note: 'Confirmed on acceptance' });
      if (r.error) throw fromDbError(r.error);
    }
    if (payStatus === 'authorized') {
      const pay = await latestPayment(orderId);
      if (!pay?.provider_payment_id || pay.provider === 'bank_transfer') throw new AppError('payment_not_captured', 409);
      let captured: GatewayPayment;
      try {
        captured = await gatewayFor(pay.provider).capture(pay.provider_payment_id);
      } catch (e) {
        await notifyStaffAlert('payment_problem', `capture:${orderId}:${Date.now()}`, 'تعذّر تحصيل الدفع',
          [`Order ${orderId}`, e instanceof GatewayError ? e.message : String(e)], orderId);
        throw new AppError('payment_not_captured', 502, { message: e instanceof Error ? e.message : String(e) });
      }
      const rec = await adminDb().rpc('record_payment_update', { p_payment_row: pay.id, p: { status: 'paid', captured_amount: captured.capturedAmount || pay.amount } });
      if (rec.error) throw fromDbError(rec.error);
    }
    const { data, error } = await staffDb.rpc('staff_accept_order', { p_order: orderId });
    if (error) throw fromDbError(error);
    after(() => notifyCustomer(orderId, 'accepted'));
    after(() => checkLowStock());
    return data;
  } catch (e) {
    await staffDb.rpc('staff_release_decision', { p_order: orderId });
    throw e;
  }
}

/** Return money for a rejected/cancelled order. Status shows "refunded" only after the gateway confirms. */
export async function settleRefund(orderId: string): Promise<'voided' | 'refunded' | 'refund_pending' | 'none'> {
  const pay = await latestPayment(orderId);
  if (pay?.provider === 'bank_transfer') {
    // bank transfers are returned by the restaurant from its bank app; staff then mark it done
    await notifyStaffAlert('payment_problem', `manual-refund:${orderId}`, 'مطلوب استرجاع تحويل بنكي يدوياً',
      [`Order ${orderId}: ${(pay.amount / 100).toFixed(2)} SAR`, 'حوّل المبلغ للعميل من تطبيق البنك ثم اضغط "تم الاسترجاع يدوياً" في صفحة الطلب.'], orderId);
    return 'refund_pending';
  }
  if (!pay?.provider_payment_id) return 'none';
  const gateway = gatewayFor(pay.provider);
  try {
    const wasAuthorized = pay.status === 'authorized' ||
      (await gateway.fetchPayment(pay.provider_payment_id)).status === 'authorized';
    const r = wasAuthorized ? await gateway.void(pay.provider_payment_id) : await gateway.refund(pay.provider_payment_id);
    const status = r.status === 'voided' ? 'voided' : r.status === 'refunded' ? 'refunded' : 'refund_pending';
    await adminDb().rpc('record_payment_update', { p_payment_row: pay.id, p: { status, refunded_amount: status === 'refunded' ? r.refundedAmount || pay.amount : undefined } });
    if (status !== 'refund_pending') after(() => notifyCustomer(orderId, 'refunded'));
    return status;
  } catch (e) {
    await adminDb().rpc('record_payment_update', { p_payment_row: pay.id, p: { status: 'refund_pending', message: e instanceof Error ? e.message : String(e) } });
    await notifyStaffAlert('payment_problem', `refund:${orderId}`, 'تعذّر استرجاع المبلغ تلقائياً',
      [`Order ${orderId}`, e instanceof Error ? e.message : String(e), 'أعد المحاولة من صفحة الطلب في لوحة الإدارة.'], orderId);
    return 'refund_pending';
  }
}

export async function rejectOrder(staffDb: SupabaseClient, orderId: string, reason: string, transferReceived?: boolean) {
  const claim = await staffDb.rpc('staff_claim_decision', { p_order: orderId });
  if (claim.error) throw fromDbError(claim.error);
  if ((claim.data as { payment_status: string }).payment_status === 'pending_verification') {
    // did the transfer actually arrive? if yes the money must be returned, if not there is nothing to refund
    const r = await staffDb.rpc('staff_review_transfer', { p_order: orderId, p_received: Boolean(transferReceived), p_note: reason });
    if (r.error) {
      await staffDb.rpc('staff_release_decision', { p_order: orderId });
      throw fromDbError(r.error);
    }
  }
  const { data, error } = await staffDb.rpc('staff_reject_order', { p_order: orderId, p_reason: reason });
  if (error) {
    await staffDb.rpc('staff_release_decision', { p_order: orderId });
    throw fromDbError(error);
  }
  const refund = (data as { refund_needed: boolean }).refund_needed ? await settleRefund(orderId) : 'none';
  after(() => notifyCustomer(orderId, 'rejected'));
  return { ...(data as object), refund };
}

export async function markManualRefund(staffDb: SupabaseClient, orderId: string, note: string) {
  const { data, error } = await staffDb.rpc('staff_mark_manual_refund', { p_order: orderId, p_note: note });
  if (error) throw fromDbError(error);
  after(() => notifyCustomer(orderId, 'refunded'));
  return data;
}

export async function cancelOrder(staffDb: SupabaseClient, orderId: string, reason: string, restock: boolean) {
  const { data, error } = await staffDb.rpc('staff_cancel_order', { p_order: orderId, p_reason: reason, p_restock: restock });
  if (error) throw fromDbError(error);
  const refund = (data as { refund_needed: boolean }).refund_needed ? await settleRefund(orderId) : 'none';
  after(() => notifyCustomer(orderId, 'cancelled'));
  return { ...(data as object), refund };
}

export async function kitchenSetStatus(staffDb: SupabaseClient, orderId: string, status: 'preparing' | 'ready' | 'delivered') {
  const { data, error } = await staffDb.rpc('kitchen_set_status', { p_order: orderId, p_status: status });
  if (error) throw fromDbError(error);
  if (status === 'preparing') after(() => notifyCustomer(orderId, 'preparing'));
  if (status === 'ready') after(() => notifyCustomer(orderId, 'ready'));
  return data;
}

export async function pickupDeliver(staffDb: SupabaseClient, ref: string) {
  const { data, error } = await staffDb.rpc('pickup_deliver', { p_ref: ref });
  if (error) throw fromDbError(error);
  return data as { ok: boolean; reason?: string; order_id?: string; order_number?: number; delivered_at?: string; delivered_by_email?: string };
}

export async function checkLowStock() {
  const { data } = await adminDb().rpc('inventory_low_items', { p_mark: true });
  const items = (data ?? []) as { id: string; name_ar: string; available: number; threshold: number; unit: string }[];
  if (!items.length) return;
  const day = new Date().toISOString().slice(0, 13);
  await notifyStaffAlert('low_stock', `${day}:${items.map((i) => i.id).join(',')}`, 'تنبيه: مخزون منخفض',
    items.map((i) => `${i.name_ar}: المتبقي ${Number(i.available)} ${i.unit} (حد التنبيه ${Number(i.threshold)})`));
}

export const siteUrl = () => env.siteUrl;
