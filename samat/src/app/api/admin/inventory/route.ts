import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { AppError, errorResponse, fromDbError } from '@/lib/errors';
import { checkLowStock } from '@/lib/orders/service';

const Item = z.object({
  id: z.string().uuid().optional(), sku: z.string().max(40).nullable().optional(), name_ar: z.string().min(1).max(60), name_en: z.string().min(1).max(60),
  group_key: z.enum(['meat', 'vegetable', 'cheese', 'bread', 'sauce', 'potato', 'extra', 'product', 'packaging']),
  unit: z.enum(['portion', 'piece', 'g', 'kg', 'ml', 'l']), low_threshold: z.number().min(0).max(1e7), is_active: z.boolean(),
});
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), item: Item }),
  z.object({ action: z.literal('move'), id: z.string().uuid(), movement: z.enum(['purchase', 'waste', 'adjustment']), quantity: z.number().refine((v) => v !== 0).refine((v) => Math.abs(v) < 1e7), note: z.string().max(200).optional() }),
  z.object({ action: z.literal('count'), id: z.string().uuid(), count: z.number().min(0).max(1e7), note: z.string().max(200).optional() }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
]);

export async function POST(req: Request) {
  try {
    await requireStaff('inventory.manage');
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const db = await userDb();
    const d = b.data;
    if (d.action === 'save') {
      const { id, ...rest } = d.item;
      const { error } = id ? await db.from('inventory').update(rest).eq('id', id) : await db.from('inventory').insert({ ...rest, on_hand: 0 });
      if (error) throw fromDbError(error);
    } else if (d.action === 'move') {
      const { error } = await db.rpc('inventory_move', { p_inventory: d.id, p_movement: d.movement, p_quantity: d.quantity, p_note: d.note ?? null });
      if (error) throw fromDbError(error);
    } else if (d.action === 'count') {
      const { error } = await db.rpc('inventory_set_count', { p_inventory: d.id, p_count: d.count, p_note: d.note ?? null });
      if (error) throw fromDbError(error);
    } else {
      const { error } = await db.from('inventory').delete().eq('id', d.id);
      if (error) throw fromDbError(error);
    }
    await checkLowStock();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
