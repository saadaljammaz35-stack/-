import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { AppError, errorResponse, fromDbError } from '@/lib/errors';

const Body = z.object({ id: z.string().uuid(), decision: z.enum(['confirm', 'cancel']) });

/** Executes (or cancels) an action SAMAT AI proposed — with the confirming user's own permissions. */
export async function POST(req: Request) {
  try {
    const staff = await requireStaff('ai.use');
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const admin = adminDb();
    const { data: act } = await admin.from('ai_pending_actions').select('*').eq('id', b.data.id).eq('requested_by', staff.userId).maybeSingle();
    if (!act || act.status !== 'pending') throw new AppError('not_found', 404);
    if (new Date(act.expires_at).getTime() < Date.now()) {
      await admin.from('ai_pending_actions').update({ status: 'expired', decided_at: new Date().toISOString() }).eq('id', act.id);
      throw new AppError('invalid_transition', 409, { reason: 'expired' });
    }
    if (b.data.decision === 'cancel') {
      await admin.from('ai_pending_actions').update({ status: 'cancelled', decided_at: new Date().toISOString() }).eq('id', act.id);
      return Response.json({ status: 'cancelled' });
    }
    if (!staff.permissions.has(act.required_permission)) throw new AppError('forbidden', 403);
    const db = await userDb(); // RLS + SQL permission checks apply to the confirming user
    const p = act.params as Record<string, never>;
    let error = null;
    switch (act.action) {
      case 'set_product_availability':
        ({ error } = await db.from('products').update({ is_available: p.available }).eq('id', p.product_id));
        break;
      case 'set_product_price':
        ({ error } = await db.from('products').update({ base_price: p.price_halalas }).eq('id', p.product_id));
        break;
      case 'stock_movement':
        ({ error } = p.movement === 'count'
          ? await db.rpc('inventory_set_count', { p_inventory: p.inventory_id, p_count: p.quantity, p_note: 'SAMAT AI (confirmed)' })
          : await db.rpc('inventory_move', { p_inventory: p.inventory_id, p_movement: p.movement, p_quantity: p.quantity, p_note: 'SAMAT AI (confirmed)' }));
        break;
      case 'ordering_status':
        ({ error } = await db.rpc('staff_set_ordering', { p }));
        break;
      case 'create_offer': {
        const now = new Date();
        ({ error } = await db.from('coupons').insert({
          is_automatic: !p.code, code: p.code ? String(p.code).toUpperCase() : null, title_ar: p.title_ar, title_en: p.title_en, kind: 'percent',
          value: Math.round(Number(p.percent) * 100), starts_at: now.toISOString(), ends_at: new Date(now.getTime() + Number(p.days) * 86400_000).toISOString(),
          category_kinds: p.category ? [p.category] : null, audience: 'all', is_active: true, created_by: staff.userId,
        }));
        break;
      }
      default:
        throw new AppError('invalid_request');
    }
    if (error) {
      await admin.from('ai_pending_actions').update({ status: 'failed', result: { error: error.message }, decided_at: new Date().toISOString() }).eq('id', act.id);
      throw fromDbError(error);
    }
    await admin.from('ai_pending_actions').update({ status: 'confirmed', decided_at: new Date().toISOString() }).eq('id', act.id);
    return Response.json({ status: 'confirmed' });
  } catch (e) {
    return errorResponse(e);
  }
}
