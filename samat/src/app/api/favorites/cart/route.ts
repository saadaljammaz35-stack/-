import { z } from 'zod';
import { currentCustomer } from '@/lib/auth/customer';
import { adminDb } from '@/lib/supabase/admin';
import { linesFromItems } from '@/lib/orders/reorder';
import { AppError, errorResponse } from '@/lib/errors';

/** A favourite as a cart line, priced with today's menu. */
export async function POST(req: Request) {
  try {
    const me = await currentCustomer();
    if (!me) throw new AppError('unauthorized', 401);
    const b = z.object({ id: z.string().uuid() }).safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const { data: f } = await adminDb().from('favorites').select('product_id, item').eq('id', b.data.id).eq('customer_id', me.id).maybeSingle();
    if (!f) throw new AppError('not_found', 404);
    return Response.json(await linesFromItems([{ product_id: f.product_id, quantity: 1, selection: f.item }]));
  } catch (e) {
    return errorResponse(e);
  }
}
