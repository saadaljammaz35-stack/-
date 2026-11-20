import { z } from 'zod';
import { currentCustomer } from '@/lib/auth/customer';
import { adminDb } from '@/lib/supabase/admin';
import { normalizeSaudiPhone } from '@/lib/phone';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({ full_name: z.string().trim().min(2).max(60), phone: z.string().max(20).optional() });

/** The signed-in customer updates their name (and a mobile, for Google accounts that have none). */
export async function POST(req: Request) {
  try {
    const me = await currentCustomer();
    if (!me) throw new AppError('unauthorized', 401);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const patch: { full_name: string; phone?: string } = { full_name: b.data.full_name };
    if (b.data.phone && !me.phone) {
      const phone = normalizeSaudiPhone(b.data.phone);
      if (!phone) throw new AppError('invalid_phone');
      patch.phone = phone;
    }
    const { error } = await adminDb().from('profiles').update(patch).eq('id', me.id);
    if (error) {
      if (error.code === '23505') throw new AppError('phone_taken', 409);
      throw error;
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
