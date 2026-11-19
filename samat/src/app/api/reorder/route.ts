import { z } from 'zod';
import { adminDb } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { buildReorder } from '@/lib/orders/reorder';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({ token: z.string().min(20).max(60).optional(), order_id: z.string().uuid().optional() });

export async function POST(req: Request) {
  try {
    const b = Body.safeParse(await req.json());
    if (!b.success || (!b.data.token && !b.data.order_id)) throw new AppError('invalid_request');
    const db = adminDb();
    let orderId: string | null = null;
    if (b.data.token) {
      const { data } = await db.from('orders').select('id').eq('tracking_token', b.data.token).maybeSingle();
      orderId = data?.id ?? null;
    } else {
      // by id: only the signed-in customer who owns it
      const user = await currentUser();
      if (!user) throw new AppError('unauthorized', 401);
      const { data } = await db.from('orders').select('id').eq('id', b.data.order_id!).eq('customer_id', user.id).maybeSingle();
      orderId = data?.id ?? null;
    }
    if (!orderId) throw new AppError('order_not_found', 404);
    return Response.json(await buildReorder(orderId));
  } catch (e) {
    return errorResponse(e);
  }
}
