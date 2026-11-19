import { timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/supabase/admin';
import { confirmPayment } from '@/lib/orders/service';
import { notifyCustomer } from '@/lib/notify';
import { gatewayFor } from '@/lib/payments';
import { env } from '@/lib/env';

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Moyasar webhook. Authenticated by the shared secret_token; deduplicated by event id; the payment
 * is always re-fetched from Moyasar's API — the webhook body itself is never trusted for amounts.
 */
export async function POST(req: Request) {
  const secret = env.moyasarWebhookSecret;
  if (!secret) return new Response('webhook not configured', { status: 503 });
  let body: { id?: string; type?: string; secret_token?: string; data?: { id?: string; metadata?: Record<string, string> } };
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  if (!body.secret_token || !safeEqual(body.secret_token, secret)) return new Response('unauthorized', { status: 401 });
  if (!body.id || !body.type) return new Response('bad event', { status: 400 });

  const db = adminDb();
  const { data: inserted } = await db.from('payment_events')
    .upsert({ provider: 'moyasar', event_id: body.id, event_type: body.type, provider_payment_id: body.data?.id ?? null,
              payload: { ...body, secret_token: undefined } }, { onConflict: 'provider,event_id', ignoreDuplicates: true })
    .select('id');
  if (!inserted?.length) return Response.json({ ok: true, duplicate: true });

  try {
    const paymentId = body.data?.id;
    if (paymentId && ['payment_paid', 'payment_authorized', 'payment_faild', 'payment_failed', 'payment_captured'].includes(body.type)) {
      await confirmPayment(paymentId, 'moyasar');
    } else if (paymentId && ['payment_refunded', 'payment_voided'].includes(body.type)) {
      const p = await gatewayFor('moyasar').fetchPayment(paymentId);
      const rowId = p.metadata.payment_row_id;
      if (rowId) {
        await db.rpc('record_payment_update', { p_payment_row: rowId, p: { status: p.status === 'voided' ? 'voided' : 'refunded', refunded_amount: p.refundedAmount } });
        const orderId = p.metadata.order_id;
        if (orderId && p.status === 'refunded') {
          // refunded after pickup (e.g. from the Moyasar dashboard): take back the points it earned
          await db.rpc('loyalty_reverse_for_order', { p_order: orderId });
          await notifyCustomer(orderId, 'refunded');
        }
      }
    }
    await db.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('id', inserted[0].id);
  } catch (e) {
    console.error('[webhook moyasar]', e);
    // allow Moyasar to retry: remove the dedupe row so the next delivery is processed
    await db.from('payment_events').delete().eq('id', inserted[0].id);
    return new Response('retry', { status: 500 });
  }
  return Response.json({ ok: true });
}
