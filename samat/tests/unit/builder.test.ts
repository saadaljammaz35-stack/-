import { describe, expect, it } from 'vitest';
import { burgerLayers, defaultSelection, describeSelection, priceSelection, toOrderItem, validateSelection } from '@/lib/builder';
import type { Product } from '@/lib/catalog-types';

const ing = (id: string, kind: string, extra = 0, name = id) => ({ id, slug: id, kind, builder: 'burger' as const, name_ar: name, name_en: name, image_url: `/${id}.webp`, image_top_url: kind === 'bread' ? '/top.webp' : null, thumb_url: null, layer_height: 0.1, extra_price: extra, is_active: true, sort_order: 0 });
const burger: Product = {
  id: 'p1', slug: 'b', builder: 'burger', category_kind: 'burger', name_ar: 'برغر', name_en: 'Burger', description_ar: null, description_en: null, image_url: null,
  base_price: 2800, is_featured: false, sort_order: 0, available: true,
  ingredients: [
    { ingredient_id: 'bun', role: 'base', default_qty: 1, max_qty: 1, price_override: null, is_free: false, layer_order: 0, sort_order: 0, ingredient: ing('bun', 'bread') },
    { ingredient_id: 'patty', role: 'base', default_qty: 1, max_qty: 3, price_override: null, is_free: false, layer_order: 10, sort_order: 0, ingredient: ing('patty', 'protein', 700) },
    { ingredient_id: 'onion', role: 'default', default_qty: 1, max_qty: 2, price_override: null, is_free: false, layer_order: 20, sort_order: 0, ingredient: ing('onion', 'vegetable', 100, 'بصل') },
    { ingredient_id: 'mush', role: 'extra', default_qty: 0, max_qty: 2, price_override: 300, is_free: false, layer_order: 30, sort_order: 0, ingredient: ing('mush', 'vegetable', 999) },
  ],
  sauces: [{ sauce_id: 's1', included_qty: 1, is_default: true, max_qty: 2, price_override: null, sort_order: 0, sauce: { id: 's1', slug: 's1', name_ar: 'خاص', name_en: 'Special', image_url: null, layer_url: '/s1.webp', top_layer_url: null, color: '#ff0000', price: 200, is_active: true } }],
  option_groups: [],
};

describe('burger builder', () => {
  it('prices defaults at the base price', () => {
    const sel = defaultSelection(burger);
    expect(priceSelection(burger, sel, 1)).toEqual({ unitBase: 2800, unitExtras: 0, unit: 2800, line: 2800 });
  });
  it('charges extra patties, paid extras (price override) and extra sauce portions; removing is free', () => {
    const sel = { ...defaultSelection(burger), ingredients: { patty: 2, onion: 0, mush: 1 }, sauces: { s1: 2 } };
    const p = priceSelection(burger, sel, 2);
    expect(p.unitExtras).toBe(700 + 300 + 200);
    expect(p.line).toBe((2800 + 1200) * 2);
  });
  it('never allows removing the bun', () => {
    const sel = { ...defaultSelection(burger), ingredients: { bun: 0 } };
    expect(validateSelection(burger, sel)).toContain('base_required');
  });
  it('stacks layers bottom bun → fillings (by quantity) → sauce → top bun', () => {
    const sel = { ...defaultSelection(burger), ingredients: { patty: 2 } };
    const keys = burgerLayers(burger, sel, 'ar').map((l) => l.kind === 'ingredient' ? l.key.split('-')[0] : l.kind);
    expect(keys).toEqual(['bun-bottom', 'patty', 'patty', 'onion', 'sauce', 'bun-top']);
  });
  it('describes changes in Najdi Arabic', () => {
    const sel = { ...defaultSelection(burger), ingredients: { onion: 0, patty: 2 } };
    expect(describeSelection(burger, sel, 'ar')).toEqual(expect.arrayContaining(['بدون بصل', 'زيادة patty']));
  });
  it('sends explicit quantities for every component', () => {
    const item = toOrderItem(burger, defaultSelection(burger), 1);
    expect(item.ingredients).toEqual({ bun: 1, patty: 1, onion: 1, mush: 0 });
    expect(item.sauces).toEqual({ s1: 1 });
    expect(item.bread_id).toBeNull();
  });
});

describe('shawarma bread', () => {
  const shawarma: Product = {
    ...burger, id: 'p2', builder: 'shawarma', category_kind: 'shawarma',
    ingredients: [
      { ingredient_id: 'reg', role: 'bread_choice', default_qty: 1, max_qty: 1, price_override: null, is_free: true, layer_order: 0, sort_order: 0, ingredient: { ...ing('reg', 'bread'), sort_order: 1 } },
      { ingredient_id: 'white', role: 'bread_choice', default_qty: 1, max_qty: 1, price_override: null, is_free: true, layer_order: 0, sort_order: 0, ingredient: { ...ing('white', 'bread'), sort_order: 2 } },
    ],
    sauces: [],
  };
  it('defaults to the first bread and requires one', () => {
    expect(defaultSelection(shawarma).breadId).toBe('reg');
    expect(validateSelection(shawarma, { ...defaultSelection(shawarma), breadId: null })).toContain('bread_required');
  });
  it('skips an out-of-stock bread', () => {
    expect(defaultSelection(shawarma, { ingredients: { reg: false }, sauces: {}, options: {}, products: {} }).breadId).toBe('white');
  });
});
