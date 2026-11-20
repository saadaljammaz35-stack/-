import { z } from 'zod';
import { currentCustomer } from '@/lib/auth/customer';
import { adminDb } from '@/lib/supabase/admin';
import { AppError, errorResponse } from '@/lib/errors';

const Item = z.object({
  bread_id: z.string().uuid().nullable().optional(),
  ingredients: z.record(z.string().uuid(), z.number().int().min(0).max(10)).default({}),
  sauces: z.record(z.string().uuid(), z.number().int().min(0).max(10)).default({}),
  options: z.array(z.string().uuid()).max(20).default([]),
});
const Body = z.object({ product_id: z.string().uuid(), name: z.string().trim().min(1).max(40), item: Item });
const MAX = 20;

/** Saves the current build of a product as a named favourite (signed-in customers). */
export async function POST(req: Request) {
  try {
    const me = await currentCustomer();
    if (!me) throw new AppError('unauthorized', 401);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const db = adminDb();
    const { count } = await db.from('favorites').select('id', { count: 'exact', head: true }).eq('customer_id', me.id);
    if ((count ?? 0) >= MAX) throw new AppError('favorites_full', 409);
    const { data, error } = await db.from('favorites').insert({ customer_id: me.id, product_id: b.data.product_id, name: b.data.name, item: b.data.item }).select('id').single();
    if (error) throw error;
    return Response.json({ ok: true, id: data.id });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await currentCustomer();
    if (!me) throw new AppError('unauthorized', 401);
    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AppError('invalid_request');
    await adminDb().from('favorites').delete().eq('id', id).eq('customer_id', me.id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
