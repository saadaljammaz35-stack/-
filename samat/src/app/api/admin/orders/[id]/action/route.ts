import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { acceptOrder, cancelOrder, kitchenSetStatus, markManualRefund, rejectOrder, settleRefund } from '@/lib/orders/service';
import { AppError, errorResponse } from '@/lib/errors';
import { adminDb } from '@/lib/supabase/admin';

const Body = z.object({
  action: z.enum(['accept', 'reject', 'cancel', 'preparing', 'ready', 'delivered', 'retry_refund', 'manual_refund']),
  transfer_received: z.boolean().optional(),
  reason: z.string().max(300).optional(),
  restock: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new AppError('invalid_request');
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const { action, reason, restock, transfer_received } = b.data;
    // server-side permission check (the database checks again inside each function)
    const perm = ['accept', 'reject', 'cancel', 'retry_refund', 'manual_refund'].includes(action) ? 'orders.manage'
      : action === 'delivered' ? (['kitchen.update', 'pickup.verify'] as const) : 'kitchen.update';
    await requireStaff(perm as never);
    const db = await userDb();
    switch (action) {
      case 'accept': return Response.json(await acceptOrder(db, id, transfer_received === true));
      case 'manual_refund': return Response.json(await markManualRefund(db, id, reason ?? ''));
      case 'reject': return Response.json(await rejectOrder(db, id, reason ?? '', transfer_received));
      case 'cancel': return Response.json(await cancelOrder(db, id, reason ?? '', restock ?? true));
      case 'retry_refund': {
        const { data: o } = await adminDb().from('orders').select('status, payment_status').eq('id', id).single();
        if (!o || !['rejected', 'cancelled'].includes(o.status) || o.payment_status !== 'refund_pending') throw new AppError('invalid_transition');
        return Response.json({ refund: await settleRefund(id) });
      }
      default: return Response.json(await kitchenSetStatus(db, id, action));
    }
  } catch (e) {
    return errorResponse(e);
  }
}
