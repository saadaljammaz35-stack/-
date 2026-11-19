// Pure builder logic shared by the browser (live preview) and the server (payload building).
// The authoritative price always comes from the database (place_order); this mirrors its rules so
// the number the customer watches while building matches what they are charged.
import type { Locale } from './money';
import type { Availability, Product, ProductIngredient, ProductSauce, Selection } from './catalog-types';

export function ingredientUnitPrice(pi: ProductIngredient): number {
  return pi.is_free ? 0 : (pi.price_override ?? pi.ingredient.extra_price);
}

export function sauceUnitPrice(ps: ProductSauce): number {
  return ps.price_override ?? ps.sauce.price;
}

export function breadChoices(p: Product): ProductIngredient[] {
  return p.ingredients.filter((i) => i.role === 'bread_choice')
    .sort((a, b) => a.sort_order - b.sort_order || a.ingredient.sort_order - b.ingredient.sort_order);
}

export function layerIngredients(p: Product): ProductIngredient[] {
  return p.ingredients
    .filter((i) => i.role !== 'bread_choice')
    .sort((a, b) => a.layer_order - b.layer_order || a.sort_order - b.sort_order);
}

export function ingredientQty(pi: ProductIngredient, sel: Selection): number {
  const v = sel.ingredients[pi.ingredient_id];
  return v === undefined ? pi.default_qty : v;
}

export function defaultSauceQty(ps: ProductSauce): number {
  return ps.is_default ? Math.max(ps.included_qty, 1) : 0;
}

export function sauceQty(ps: ProductSauce, sel: Selection): number {
  const v = sel.sauces[ps.sauce_id];
  return v === undefined ? defaultSauceQty(ps) : v;
}

export function isIngredientAvailable(pi: ProductIngredient, av?: Availability): boolean {
  return pi.ingredient.is_active && (av?.ingredients[pi.ingredient_id] ?? true);
}

export function isSauceAvailable(ps: ProductSauce, av?: Availability): boolean {
  return ps.sauce.is_active && (av?.sauces[ps.sauce_id] ?? true);
}

/** Starting selection: defaults, with sold-out optional ingredients switched off. */
export function defaultSelection(p: Product, av?: Availability): Selection {
  const sel: Selection = { breadId: null, ingredients: {}, sauces: {}, options: [], notes: '' };
  const breads = breadChoices(p).filter((b) => isIngredientAvailable(b, av));
  if (breads.length) sel.breadId = breads[0].ingredient_id;
  for (const pi of layerIngredients(p)) {
    if (pi.role !== 'base' && pi.default_qty > 0 && !isIngredientAvailable(pi, av)) sel.ingredients[pi.ingredient_id] = 0;
  }
  for (const ps of p.sauces) {
    if (ps.is_default && !isSauceAvailable(ps, av)) sel.sauces[ps.sauce_id] = 0;
  }
  for (const g of p.option_groups) {
    const usable = g.options.filter((o) => o.is_active && (av?.options[o.id] ?? true));
    const def = usable.find((o) => o.is_default) ?? (g.is_required ? usable[0] : undefined);
    if (def) sel.options.push(def.id);
  }
  return sel;
}

export interface PriceBreakdown {
  unitBase: number;
  unitExtras: number;
  unit: number;
  line: number;
}

export function priceSelection(p: Product, sel: Selection, quantity: number): PriceBreakdown {
  let extras = 0;
  const bread = breadChoices(p).find((b) => b.ingredient_id === sel.breadId);
  if (bread) extras += ingredientUnitPrice(bread);
  for (const pi of layerIngredients(p)) {
    const q = ingredientQty(pi, sel);
    const charged = pi.role === 'extra' ? q : Math.max(q - pi.default_qty, 0);
    extras += charged * ingredientUnitPrice(pi);
  }
  for (const ps of p.sauces) {
    extras += Math.max(sauceQty(ps, sel) - ps.included_qty, 0) * sauceUnitPrice(ps);
  }
  for (const g of p.option_groups) {
    for (const o of g.options) if (sel.options.includes(o.id)) extras += o.price_delta;
  }
  const unit = p.base_price + extras;
  return { unitBase: p.base_price, unitExtras: extras, unit, line: unit * quantity };
}

/** Problems that would make the server refuse the line. */
export function validateSelection(p: Product, sel: Selection): string[] {
  const errors: string[] = [];
  if (breadChoices(p).length && !breadChoices(p).some((b) => b.ingredient_id === sel.breadId)) errors.push('bread_required');
  for (const pi of layerIngredients(p)) {
    const q = ingredientQty(pi, sel);
    if (pi.role === 'base' && q < 1) errors.push('base_required');
    if (q < 0 || q > pi.max_qty) errors.push('invalid_quantity');
  }
  for (const g of p.option_groups) {
    const n = g.options.filter((o) => sel.options.includes(o.id)).length;
    if (g.is_required && n === 0) errors.push('option_required');
    if ((g.selection === 'single' && n > 1) || n > g.max_select) errors.push('too_many_options');
  }
  return errors;
}

/** The JSON item the API / place_order expects. Quantities are sent explicitly for every component. */
export function toOrderItem(p: Product, sel: Selection, quantity: number) {
  const ingredients: Record<string, number> = {};
  for (const pi of layerIngredients(p)) ingredients[pi.ingredient_id] = ingredientQty(pi, sel);
  const sauces: Record<string, number> = {};
  for (const ps of p.sauces) sauces[ps.sauce_id] = sauceQty(ps, sel);
  return {
    product_id: p.id,
    quantity,
    bread_id: breadChoices(p).length ? sel.breadId : null,
    ingredients,
    sauces,
    options: sel.options,
    notes: sel.notes.trim() || undefined,
  };
}

export interface Layer {
  key: string;
  src: string;
  kind: 'bun-bottom' | 'bun-top' | 'ingredient' | 'sauce' | 'bread';
  height: number; // fraction of the stage width the layer occupies vertically (burger)
  label: string;
}

/** Burger side view: bottom bun → ingredients (repeated by quantity) → sauces → top bun. */
export function burgerLayers(p: Product, sel: Selection, locale: Locale): Layer[] {
  const name = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  const layers: Layer[] = [];
  const all = layerIngredients(p);
  const bun = all.find((pi) => pi.role === 'base' && pi.ingredient.kind === 'bread');
  if (bun?.ingredient.image_url) {
    layers.push({ key: 'bun-bottom', src: bun.ingredient.image_url, kind: 'bun-bottom', height: bun.ingredient.layer_height, label: name(bun.ingredient) });
  }
  for (const pi of all) {
    if (pi === bun || !pi.ingredient.image_url) continue;
    const q = ingredientQty(pi, sel);
    for (let i = 0; i < q; i++) {
      layers.push({ key: `${pi.ingredient_id}-${i}`, src: pi.ingredient.image_url, kind: 'ingredient', height: pi.ingredient.layer_height, label: name(pi.ingredient) });
    }
  }
  for (const ps of p.sauces) {
    const q = sauceQty(ps, sel);
    if (q > 0 && ps.sauce.layer_url) {
      layers.push({ key: `sauce-${ps.sauce_id}`, src: ps.sauce.layer_url, kind: 'sauce', height: 0.03, label: name(ps.sauce) });
    }
  }
  const top = bun?.ingredient.image_top_url;
  if (bun && top) layers.push({ key: 'bun-top', src: top, kind: 'bun-top', height: bun.ingredient.layer_height * 1.35, label: name(bun.ingredient) });
  return layers;
}

/** Shawarma top view: chosen bread, then fillings scattered along the middle, sauces drizzled last. */
export function shawarmaLayers(p: Product, sel: Selection, locale: Locale): Layer[] {
  const name = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  const layers: Layer[] = [];
  const bread = breadChoices(p).find((b) => b.ingredient_id === sel.breadId)
    ?? layerIngredients(p).find((pi) => pi.ingredient.kind === 'bread');
  if (bread?.ingredient.image_url) layers.push({ key: 'bread', src: bread.ingredient.image_url, kind: 'bread', height: 1, label: name(bread.ingredient) });
  for (const pi of layerIngredients(p)) {
    if (pi === bread || !pi.ingredient.image_url) continue;
    const q = ingredientQty(pi, sel);
    for (let i = 0; i < q; i++) layers.push({ key: `${pi.ingredient_id}-${i}`, src: pi.ingredient.image_url, kind: 'ingredient', height: 0, label: name(pi.ingredient) });
  }
  for (const ps of p.sauces) {
    if (sauceQty(ps, sel) > 0 && ps.sauce.top_layer_url) {
      layers.push({ key: `sauce-${ps.sauce_id}`, src: ps.sauce.top_layer_url, kind: 'sauce', height: 0, label: name(ps.sauce) });
    }
  }
  return layers;
}

/** Short human description of the changes: "بدون بصل · زيادة لحم · + فطر". */
export function describeSelection(p: Product, sel: Selection, locale: Locale): string[] {
  const out: string[] = [];
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  const bread = breadChoices(p).find((b) => b.ingredient_id === sel.breadId);
  if (bread) out.push(n(bread.ingredient));
  for (const pi of layerIngredients(p)) {
    const q = ingredientQty(pi, sel);
    if (pi.role === 'extra' && q > 0) out.push(`+ ${n(pi.ingredient)}${q > 1 ? ` ×${q}` : ''}`);
    else if (pi.role !== 'extra' && q === 0) out.push(`${locale === 'ar' ? 'بدون' : 'No'} ${n(pi.ingredient)}`);
    else if (pi.role !== 'extra' && q > pi.default_qty) out.push(`${locale === 'ar' ? 'زيادة' : 'Extra'} ${n(pi.ingredient)}${q - pi.default_qty > 1 ? ` ×${q - pi.default_qty}` : ''}`);
  }
  for (const ps of p.sauces) {
    const q = sauceQty(ps, sel);
    const d = defaultSauceQty(ps);
    if (q === 0 && d > 0) out.push(`${locale === 'ar' ? 'بدون' : 'No'} ${n(ps.sauce)}`);
    else if (q > d) out.push(`+ ${n(ps.sauce)}${q > 1 ? ` ×${q}` : ''}`);
  }
  for (const g of p.option_groups) for (const o of g.options) if (sel.options.includes(o.id)) out.push(n(o));
  return out;
}
