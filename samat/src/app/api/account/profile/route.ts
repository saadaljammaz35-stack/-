import { z } from 'zod';
import { currentCustomer } from '@/lib/auth/customer';
import { adminDb } from '@/lib/supabase/admin';
import { normalizeSaudiPhone } from '@/lib/phone';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({
  full_name: z.string().trim().min(2).max(60).optional(),
  phone: z.string().max(20).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** The signed-in customer updates their name (and a mobile, for Google accounts that have none). */
export async function POST(req: Request) {
  try {
    const me = await currentCustomer();
    if (!me) throw new AppError('unauthorized', 401);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const patch: { full_name?: string; phone?: string; birthday?: string } = {};
    if (b.data.full_name) patch.full_name = b.data.full_name;
    if (b.data.birthday) {
      const d = new Date(`${b.data.birthday}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d > new Date() || d.getUTCFullYear() < 1920) throw new AppError('invalid_request');
      // set once: changing it later would allow a second birthday gift
      const { data: cur } = await adminDb().from('profiles').select('birthday').eq('id', me.id).single();
      if (!cur?.birthday) patch.birthday = b.data.birthday;
    }
    if (b.data.phone && !me.phone) {
      const phone = normalizeSaudiPhone(b.data.phone);
      if (!phone) throw new AppError('invalid_phone');
      patch.phone = phone;
    }
    if (!Object.keys(patch).length) return Response.json({ ok: true });
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
