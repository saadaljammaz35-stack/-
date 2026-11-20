import { z } from 'zod';
import { adminDb } from '@/lib/supabase/admin';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() });

/** One rating per picked-up order, from its tracking link. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await rateLimit('rate', await clientIp(), 20, 600);
    const { token } = await params;
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const db = adminDb();
    const { data: o } = await db.from('orders').select('id, status').eq('tracking_token', token).maybeSingle();
    if (!o) throw new AppError('order_not_found', 404);
    if (o.status !== 'delivered') throw new AppError('invalid_transition', 409);
    const { error } = await db.from('order_ratings').insert({ order_id: o.id, rating: b.data.rating, comment: b.data.comment || null });
    if (error?.code === '23505') throw new AppError('already_rated', 409);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
