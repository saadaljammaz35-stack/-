import { z } from 'zod';
import { adminDb } from '@/lib/supabase/admin';
import { confirmPayment } from '@/lib/orders/service';
import { activeProvider } from '@/lib/payments';
import { AppError, errorResponse } from '@/lib/errors';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const Body = z.object({ token: z.string().min(20).max(60), payment_id: z.string().min(4).max(600) });

/** Called by the payment form as soon as the gateway reports a result (before any redirect). */
export async function POST(req: Request) {
  try {
    await rateLimit('pay:confirm', await clientIp(), 40, 600);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new AppError('invalid_request');
    const { data: o } = await adminDb().from('orders').select('id').eq('tracking_token', parsed.data.token).maybeSingle();
    if (!o) throw new AppError('order_not_found', 404);
    return Response.json(await confirmPayment(parsed.data.payment_id, activeProvider(), o.id));
  } catch (e) {
    return errorResponse(e);
  }
}
