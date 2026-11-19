import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { AppError, errorResponse, fromDbError } from '@/lib/errors';
import { normalizeSaudiPhone } from '@/lib/phone';

const Coupon = z.object({
  id: z.string().uuid().optional(), is_automatic: z.boolean(), code: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/).nullable(),
  title_ar: z.string().min(1).max(80), title_en: z.string().min(1).max(80), kind: z.enum(['percent', 'fixed']), value: z.number().int().positive(),
  max_discount: z.number().int().positive().nullable(), min_order: z.number().int().min(0), starts_at: z.string().datetime({ offset: true }).nullable(),
  ends_at: z.string().datetime({ offset: true }).nullable(), usage_limit: z.number().int().positive().nullable(), per_customer_limit: z.number().int().positive().nullable(),
  audience: z.enum(['all', 'new_customers', 'loyalty_members', 'specific']), customer_phone: z.string().nullable(),
  product_ids: z.array(z.string().uuid()).nullable(), category_kinds: z.array(z.enum(['burger', 'shawarma', 'fries'])).nullable(), is_active: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const me = await requireStaff('coupons.manage');
    const body = await req.json();
    const db = await userDb();
    if (body.action === 'delete') {
      const { error } = await db.from('coupons').update({ is_active: false }).eq('id', z.string().uuid().parse(body.id));
      if (error) throw fromDbError(error);
      return Response.json({ ok: true });
    }
    const r = Coupon.safeParse(body.row);
    if (!r.success) throw new AppError('invalid_request', 400, { issues: r.error.issues.map((i) => i.path.join('.')) });
    const row = { ...r.data, code: r.data.is_automatic ? null : r.data.code?.toUpperCase() ?? null,
      customer_phone: r.data.customer_phone ? normalizeSaudiPhone(r.data.customer_phone) : null,
      product_ids: r.data.product_ids?.length ? r.data.product_ids : null, category_kinds: r.data.category_kinds?.length ? r.data.category_kinds : null };
    if (row.audience === 'specific' && !row.customer_phone) throw new AppError('invalid_request', 400, { issues: ['customer_phone'] });
    const { id, ...rest } = row;
    const { error } = id ? await db.from('coupons').update(rest).eq('id', id) : await db.from('coupons').insert({ ...rest, created_by: me.userId });
    if (error) throw error.code === '23505' ? new AppError('invalid_request', 409, { issues: ['code'] }) : fromDbError(error);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
