import { z } from 'zod';
import { adminDb } from '@/lib/supabase/admin';
import { confirmPayment } from '@/lib/orders/service';
import { simulatorAllowed } from '@/lib/env';
import { createSimulatedPaymentId } from '@/lib/payments/simulator';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({
  token: z.string().min(20).max(60),
  payment_row_id: z.string().uuid(),
  outcome: z.enum(['paid', 'authorized', 'failed']),
});

/** Local test gateway — returns 404 unless PAYMENT_PROVIDER=simulator outside production. */
export async function POST(req: Request) {
  try {
    if (!simulatorAllowed()) return new Response('Not found', { status: 404 });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new AppError('invalid_request');
    const { data: o } = await adminDb().from('orders').select('id, total').eq('tracking_token', parsed.data.token).maybeSingle();
    if (!o) throw new AppError('order_not_found', 404);
    const { data: row } = await adminDb().from('payments').select('id, amount').eq('id', parsed.data.payment_row_id).eq('order_id', o.id).maybeSingle();
    if (!row) throw new AppError('invalid_request');
    const id = createSimulatedPaymentId({ a: row.amount, s: parsed.data.outcome, o: o.id, r: row.id, t: Date.now() });
    return Response.json({ payment_id: id, ...(await confirmPayment(id, 'simulator', o.id)) });
  } catch (e) {
    return errorResponse(e);
  }
}
