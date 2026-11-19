import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { pickupDeliver } from '@/lib/orders/service';
import { AppError, errorResponse, fromDbError } from '@/lib/errors';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const Body = z.object({ ref: z.string().min(4).max(80), action: z.enum(['lookup', 'deliver']) });

export async function POST(req: Request) {
  try {
    await requireStaff('pickup.verify');
    await rateLimit('pickup', await clientIp(), 60, 60);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    // QR content is "SAMAT:<random token>"; a typed code is the 6-character pickup code
    const ref = b.data.ref.trim().replace(/^SAMAT:/i, '');
    const db = await userDb();
    if (b.data.action === 'deliver') return Response.json(await pickupDeliver(db, ref));
    const { data, error } = await db.rpc('pickup_lookup', { p_ref: ref });
    if (error) throw fromDbError(error);
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
