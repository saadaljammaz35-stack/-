import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { AppError, errorResponse, fromDbError } from '@/lib/errors';
import { normalizeSaudiPhone } from '@/lib/phone';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('settings'), loyalty_enabled: z.boolean(), loyalty_points_per_sar: z.number().min(0).max(1000),
    loyalty_point_value_halalas: z.number().int().min(0).max(100000), loyalty_min_redeem_points: z.number().int().min(0), loyalty_expiry_days: z.number().int().min(0).max(3650),
    loyalty_welcome_points: z.number().int().min(0).max(100000).optional(), loyalty_birthday_points: z.number().int().min(0).max(100000).optional(),
    loyalty_stamp_target: z.number().int().min(0).max(100).optional(), loyalty_stamp_reward_points: z.number().int().min(0).max(100000).optional() }),
  z.object({ action: z.literal('reward'), row: z.object({ id: z.string().uuid().optional(), name_ar: z.string().min(1).max(80), name_en: z.string().min(1).max(80),
    description_ar: z.string().max(200).nullable().optional(), description_en: z.string().max(200).nullable().optional(), points_cost: z.number().int().positive(),
    reward_type: z.enum(['discount_fixed', 'free_product']), value: z.number().int().positive().nullable(), product_id: z.string().uuid().nullable(), is_active: z.boolean(), sort_order: z.number().int() }) }),
  z.object({ action: z.literal('adjust'), phone: z.string(), points: z.number().int().refine((v) => v !== 0), note: z.string().max(200) }),
  z.object({ action: z.literal('adjust_customer'), customer_id: z.string().uuid(), points: z.number().int().min(-100000).max(100000).refine((v) => v !== 0), note: z.string().max(200) }),
]);

export async function POST(req: Request) {
  try {
    await requireStaff('loyalty.manage');
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const db = await userDb();
    const d = b.data;
    if (d.action === 'settings') {
      const { action: _a, ...p } = d; void _a;
      const { error } = await db.rpc('admin_save_loyalty_settings', { p });
      if (error) throw fromDbError(error);
    } else if (d.action === 'reward') {
      const { id, ...rest } = d.row;
      const { error } = id ? await db.from('loyalty_rewards').update(rest).eq('id', id) : await db.from('loyalty_rewards').insert(rest);
      if (error) throw fromDbError(error);
    } else if (d.action === 'adjust_customer') {
      const { data, error } = await db.rpc('loyalty_adjust', { p_customer: d.customer_id, p_points: d.points, p_note: d.note || null });
      if (error) throw fromDbError(error);
      return Response.json({ balance: data });
    } else {
      const phone = normalizeSaudiPhone(d.phone);
      if (!phone) throw new AppError('invalid_request', 400, { issues: ['phone'] });
      const { data: prof } = await adminDb().from('profiles').select('id').eq('phone', phone).maybeSingle();
      if (!prof) throw new AppError('not_found', 404);
      const { data, error } = await db.rpc('loyalty_adjust', { p_customer: prof.id, p_points: d.points, p_note: d.note });
      if (error) throw fromDbError(error);
      return Response.json({ balance: data });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
