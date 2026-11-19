-- SAMAT | سماط — the Arabic Combo, added at the owner's request (price set by the owner: 18 SAR).
insert into public.products (category_id, slug, builder, name_ar, name_en, description_ar, description_en, image_url, base_price, is_active, is_featured, sort_order)
select c.id, 'arabi-combo', 'simple', 'كومبو عربي', 'Arabic Combo',
  'شاورما عربي مقطّعة مع بطاطس مقرمشة وثومية ومخلل', 'Arabic-style shawarma, cut into pieces, with crispy fries, garlic sauce and pickles',
  '/media/products/arabi-combo.webp', 1800, true, true, 0
from public.categories c where c.kind = 'shawarma'
on conflict (slug) do nothing;
