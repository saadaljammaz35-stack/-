import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { PageHeader } from '@/components/admin/ui';
import { ProductEditor, type ProductDraft } from '@/components/admin/ProductEditor';

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ category?: string }> }) {
  const { id } = await params;
  const { category } = await searchParams;
  await requireStaffPage('menu.manage', `/admin/menu/${id}`);
  const locale = await getLocale();
  const a = adminDicts[locale];
  const db = await userDb();
  const [{ data: cats }, { data: ings }, { data: sauces }, { data: inv }] = await Promise.all([
    db.from('categories').select('id, kind, name_ar, name_en').order('sort_order'),
    db.from('ingredients').select('id, name_ar, name_en, kind, builder, thumb_url, image_url, extra_price').order('sort_order'),
    db.from('sauces').select('id, name_ar, name_en, color, price').order('sort_order'),
    db.from('inventory').select('id, name_ar, name_en').order('name_en'),
  ]);
  let draft: ProductDraft;
  if (id === 'new') {
    const cat = (cats ?? []).find((c) => c.id === category) ?? (cats ?? [])[0];
    draft = { category_id: cat?.id ?? '', slug: '', builder: cat?.kind === 'fries' ? 'simple' : cat?.kind === 'shawarma' ? 'shawarma' : 'burger',
      name_ar: '', name_en: '', description_ar: '', description_en: '', image_url: null, base_price: null, is_active: false, is_available: true,
      is_featured: false, inventory_id: null, inventory_qty: 1, sort_order: 0, ingredients: [], sauces: [], groups: [] };
  } else {
    const { data: p } = await db.from('products').select(`id, category_id, slug, builder, name_ar, name_en, description_ar, description_en, image_url, base_price,
      is_active, is_available, is_featured, inventory_id, inventory_qty, sort_order,
      product_ingredients(ingredient_id, role, default_qty, max_qty, price_override, is_free, layer_order),
      product_sauces(sauce_id, included_qty, is_default, max_qty, price_override, sort_order),
      option_groups(name_ar, name_en, selection, is_required, max_select, sort_order, product_options(name_ar, name_en, price_delta, is_default, is_active, inventory_id, sort_order))`)
      .eq('id', id).is('deleted_at', null).maybeSingle();
    if (!p) notFound();
    draft = {
      ...p, description_ar: p.description_ar ?? '', description_en: p.description_en ?? '', inventory_qty: Number(p.inventory_qty),
      ingredients: p.product_ingredients, sauces: p.product_sauces,
      groups: (p.option_groups ?? []).sort((x, y) => x.sort_order - y.sort_order).map((g) => ({ ...g, options: (g.product_options ?? []).sort((x, y) => x.sort_order - y.sort_order) })),
    } as ProductDraft;
  }
  return (
    <div>
      <PageHeader title={id === 'new' ? a.menu.newProduct : (locale === 'ar' ? draft.name_ar : draft.name_en)} />
      <ProductEditor initial={draft} categories={cats ?? []} ingredients={ings ?? []} sauces={sauces ?? []} inventory={inv ?? []} />
    </div>
  );
}
