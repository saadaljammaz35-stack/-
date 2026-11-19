import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { AppError, errorResponse, fromDbError } from '@/lib/errors';

const money = z.number().int().min(0).max(1_000_000);
const url = z.string().max(500).refine((v) => v === '' || v.startsWith('/') || v.startsWith('https://') || v.startsWith('http://127.0.0.1'), 'url').nullable().optional();
const slug = z.string().regex(/^[a-z0-9-]{2,60}$/);

const Ingredient = z.object({
  id: z.string().uuid().optional(), slug, kind: z.enum(['bread', 'protein', 'cheese', 'vegetable', 'pickle', 'extra']),
  builder: z.enum(['burger', 'shawarma', 'any']), name_ar: z.string().min(1).max(60), name_en: z.string().min(1).max(60),
  image_url: url, image_top_url: url, thumb_url: url, layer_height: z.number().min(0.01).max(0.9), extra_price: money,
  is_active: z.boolean(), inventory_id: z.string().uuid().nullable().optional(), inventory_qty: z.number().positive().max(10000), sort_order: z.number().int(),
});
const Sauce = z.object({
  id: z.string().uuid().optional(), slug, name_ar: z.string().min(1).max(60), name_en: z.string().min(1).max(60),
  image_url: url, layer_url: url, top_layer_url: url, color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(), price: money,
  is_active: z.boolean(), inventory_id: z.string().uuid().nullable().optional(), inventory_qty: z.number().positive().max(10000), sort_order: z.number().int(),
});
const Product = z.object({
  id: z.string().uuid().optional(), category_id: z.string().uuid(), slug, builder: z.enum(['burger', 'shawarma', 'simple']),
  name_ar: z.string().min(1).max(80), name_en: z.string().min(1).max(80), description_ar: z.string().max(300).optional(), description_en: z.string().max(300).optional(),
  image_url: url, base_price: money.nullable(), is_active: z.boolean(), is_available: z.boolean(), is_featured: z.boolean(),
  inventory_id: z.string().uuid().nullable().optional(), inventory_qty: z.number().positive().max(10000), sort_order: z.number().int(),
  ingredients: z.array(z.object({ ingredient_id: z.string().uuid(), role: z.enum(['base', 'default', 'extra', 'bread_choice']),
    default_qty: z.number().int().min(0).max(10), max_qty: z.number().int().min(1).max(10), price_override: money.nullable(), is_free: z.boolean(), layer_order: z.number().int() })).max(40),
  sauces: z.array(z.object({ sauce_id: z.string().uuid(), included_qty: z.number().int().min(0).max(5), is_default: z.boolean(), max_qty: z.number().int().min(1).max(5), price_override: money.nullable(), sort_order: z.number().int() })).max(20),
  groups: z.array(z.object({ name_ar: z.string().min(1).max(60), name_en: z.string().min(1).max(60), selection: z.enum(['single', 'multiple']), is_required: z.boolean(),
    max_select: z.number().int().min(1).max(20), sort_order: z.number().int(),
    options: z.array(z.object({ name_ar: z.string().min(1).max(60), name_en: z.string().min(1).max(60), price_delta: money, is_default: z.boolean(), is_active: z.boolean(),
      inventory_id: z.string().uuid().nullable().optional(), sort_order: z.number().int() })).max(20) })).max(10),
});

export async function POST(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    await requireStaff('menu.manage');
    const { entity } = await params;
    const body = await req.json();
    const db = await userDb();
    if (body.action === 'delete') {
      const id = z.string().uuid().parse(body.id);
      const { error } = entity === 'products' ? await db.rpc('admin_delete_product', { p_id: id })
        : await db.from(entity === 'sauces' ? 'sauces' : 'ingredients').delete().eq('id', id);
      if (error) throw fromDbError(error);
      return Response.json({ ok: true });
    }
    if (entity === 'products') {
      const r = Product.safeParse(body.row);
      if (!r.success) throw new AppError('invalid_request', 400, { issues: r.error.issues.map((i) => i.path.join('.')).slice(0, 5) });
      const { data, error } = await db.rpc('admin_save_product', { p: r.data });
      if (error) throw fromDbError(error);
      return Response.json({ id: data });
    }
    const schema = entity === 'sauces' ? Sauce : entity === 'ingredients' ? Ingredient : null;
    if (!schema) throw new AppError('not_found', 404);
    const r = schema.safeParse(body.row);
    if (!r.success) throw new AppError('invalid_request', 400, { issues: r.error.issues.map((i) => i.path.join('.')).slice(0, 5) });
    const row = Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, v === '' ? null : v])) as Record<string, never>;
    const q = row.id ? db.from(entity).update(row).eq('id', row.id as string).select('id').single() : db.from(entity).insert(row).select('id').single();
    const { data, error } = await q;
    if (error) throw error.code === '23505' ? new AppError('invalid_request', 409, { field: 'slug' }) : fromDbError(error);
    return Response.json({ id: data.id });
  } catch (e) {
    return errorResponse(e);
  }
}
