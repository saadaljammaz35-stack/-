import 'server-only';
import { adminDb } from '@/lib/supabase/admin';
import { getProductsByIds } from '@/lib/catalog';
import {
  breadChoices, defaultSelection, describeSelection, isIngredientAvailable, isSauceAvailable, layerIngredients, priceSelection, validateSelection,
} from '@/lib/builder';
import type { Availability, Selection } from '@/lib/catalog-types';

const FALLBACK = { burger: '/media/menu/burger.webp', shawarma: '/media/menu/shawarma.webp', fries: '/media/menu/fries.webp' } as const;

/**
 * "Order again": rebuild cart lines from a past order using TODAY's menu — current prices, only
 * ingredients/sauces/options that still exist and are in stock. Reports whether anything changed.
 */
export async function buildReorder(orderId: string) {
  const { data: items } = await adminDb().from('order_items').select('product_id, quantity, selection, sort_order').eq('order_id', orderId).order('sort_order');
  return linesFromItems(items ?? []);
}

/** Cart lines from saved items (a past order, a favourite or a suggestion), priced with today's menu. */
export async function linesFromItems(items: { product_id: string | null; quantity: number; selection: unknown }[]) {
  const db = adminDb();
  const ids = [...new Set((items ?? []).map((i) => i.product_id).filter(Boolean))] as string[];
  const [products, avail] = await Promise.all([getProductsByIds(ids), db.rpc('menu_availability')]);
  const av = avail.data as Availability;
  let changed = false;
  const lines = [];
  for (const item of items ?? []) {
    const p = products.find((x) => x.id === item.product_id);
    if (!p || !p.available) { changed = true; continue; }
    const old = (item.selection ?? {}) as { bread_id?: string | null; ingredients?: Record<string, number>; sauces?: Record<string, number>; options?: string[] };
    const base = defaultSelection(p, av);
    const sel: Selection = { ...base, notes: '' };
    const breads = breadChoices(p);
    if (breads.length) {
      const b = breads.find((x) => x.ingredient_id === old.bread_id && isIngredientAvailable(x, av));
      if (b) sel.breadId = b.ingredient_id; else if (old.bread_id) changed = true;
    }
    for (const pi of layerIngredients(p)) {
      const q = old.ingredients?.[pi.ingredient_id];
      if (q === undefined) continue;
      if (q > 0 && !isIngredientAvailable(pi, av)) { changed = true; sel.ingredients[pi.ingredient_id] = pi.role === 'base' ? 1 : 0; continue; }
      const clamped = Math.max(pi.role === 'base' ? 1 : 0, Math.min(pi.max_qty, q));
      if (clamped !== q) changed = true;
      sel.ingredients[pi.ingredient_id] = clamped;
    }
    for (const k of Object.keys(old.ingredients ?? {})) if (!p.ingredients.some((pi) => pi.ingredient_id === k)) changed = true;
    for (const ps of p.sauces) {
      const q = old.sauces?.[ps.sauce_id];
      if (q === undefined) continue;
      if (q > 0 && !isSauceAvailable(ps, av)) { changed = true; sel.sauces[ps.sauce_id] = 0; continue; }
      sel.sauces[ps.sauce_id] = Math.min(ps.max_qty, Math.max(0, q));
    }
    const validOpts = (old.options ?? []).filter((id) => p.option_groups.some((g) => g.options.some((o) => o.id === id && o.is_active && (av.options[id] ?? true))));
    if (validOpts.length !== (old.options ?? []).length) changed = true;
    if (validOpts.length) sel.options = validOpts;
    if (validateSelection(p, sel).length) { changed = true; continue; }
    const price = priceSelection(p, sel, item.quantity);
    lines.push({
      productId: p.id, slug: p.slug, quantity: item.quantity, selection: sel,
      nameAr: p.name_ar, nameEn: p.name_en, imageUrl: p.image_url ?? FALLBACK[p.category_kind],
      unitPrice: price.unit, summaryAr: describeSelection(p, sel, 'ar'), summaryEn: describeSelection(p, sel, 'en'),
    });
  }
  return { lines, changed };
}
