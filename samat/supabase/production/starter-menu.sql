-- SAMAT | سماط — starter menu for a fresh PRODUCTION database (run once, after the migrations).
--
-- Creates the three products (burger, shawarma, fries) with their builder compositions and sauces,
-- as DRAFTS: no prices and not published. The owner sets the prices in /admin/menu and publishes
-- each product; the database refuses to publish a product without a price.
-- No prices, stock counts, coupons or rewards are invented here. Safe to re-run (skips existing rows).

begin;

with c as (select id, kind from public.categories)
insert into public.products (category_id, slug, builder, name_ar, name_en, description_ar, description_en, image_url, base_price, is_active, is_featured, sort_order)
values
  ((select id from c where kind = 'burger'), 'samat-burger', 'burger', 'برغر سماط', 'SAMAT Burger',
   'لحم بقري مشوي مع شيدر ذايب وخضار طازجة، ركّبه على كيفك', 'Grilled beef, melted cheddar and fresh greens — built your way', '/media/products/burger.webp', null, false, true, 1),
  ((select id from c where kind = 'shawarma'), 'samat-shawarma', 'shawarma', 'شاورما سماط', 'SAMAT Shawarma',
   'شاورما دجاج على أصولها، اختر خبزك وركّبها على مزاجك', 'Classic chicken shawarma — pick your bread and build it your way', '/media/products/shawarma.webp', null, false, true, 1),
  ((select id from c where kind = 'fries'), 'samat-fries', 'simple', 'بطاطس سماط', 'SAMAT Fries',
   'بطاطس ذهبية مقرمشة', 'Golden, crispy fries', '/media/products/fries.webp', null, false, true, 1)
on conflict (slug) do nothing;

-- compositions (layer_order bottom -> top; the bun's top half is drawn last automatically)
insert into public.product_ingredients (product_id, ingredient_id, role, default_qty, max_qty, layer_order, sort_order)
select p.id, g.id, x.role::public.ingredient_role, x.dq, x.mq, x.lo, x.lo
from (values
  ('samat-burger', 'brioche-bun', 'base', 1, 1, 0),
  ('samat-burger', 'beef-patty', 'base', 1, 3, 10),
  ('samat-burger', 'cheddar', 'default', 1, 3, 20),
  ('samat-burger', 'caramelized-onion', 'extra', 0, 2, 25),
  ('samat-burger', 'mushrooms', 'extra', 0, 2, 27),
  ('samat-burger', 'pickles', 'default', 1, 2, 30),
  ('samat-burger', 'red-onion', 'default', 1, 2, 35),
  ('samat-burger', 'tomato', 'default', 1, 2, 40),
  ('samat-burger', 'jalapeno', 'extra', 0, 2, 45),
  ('samat-burger', 'lettuce', 'default', 1, 2, 50),
  ('samat-shawarma', 'regular-bread', 'bread_choice', 1, 1, 0),
  ('samat-shawarma', 'white-bread', 'bread_choice', 1, 1, 0),
  ('samat-shawarma', 'chicken-shawarma', 'base', 1, 2, 10),
  ('samat-shawarma', 'shawarma-fries', 'default', 1, 2, 20),
  ('samat-shawarma', 'shawarma-pickles', 'default', 1, 2, 30),
  ('samat-shawarma', 'shawarma-tomato', 'extra', 0, 1, 35),
  ('samat-shawarma', 'shawarma-lettuce', 'extra', 0, 1, 40),
  ('samat-shawarma', 'onion-parsley', 'extra', 0, 1, 45)
) as x(prod, ing, role, dq, mq, lo)
join public.products p on p.slug = x.prod
join public.ingredients g on g.slug = x.ing
where not exists (select 1 from public.product_ingredients pi where pi.product_id = p.id and pi.ingredient_id = g.id);

insert into public.product_sauces (product_id, sauce_id, included_qty, is_default, max_qty, sort_order)
select p.id, s.id, x.inc, x.def, x.mx, x.so
from (values
  ('samat-burger', 'special', 1, true, 2, 1), ('samat-burger', 'garlic', 0, false, 2, 2),
  ('samat-burger', 'bbq', 0, false, 2, 3), ('samat-burger', 'spicy', 0, false, 2, 4),
  ('samat-shawarma', 'garlic', 1, true, 2, 1), ('samat-shawarma', 'spicy', 0, false, 2, 2),
  ('samat-shawarma', 'tahini', 0, false, 2, 3),
  ('samat-fries', 'garlic', 0, false, 2, 1), ('samat-fries', 'special', 0, false, 2, 2), ('samat-fries', 'bbq', 0, false, 2, 3)
) as x(prod, sauce, inc, def, mx, so)
join public.products p on p.slug = x.prod
join public.sauces s on s.slug = x.sauce
where not exists (select 1 from public.product_sauces ps where ps.product_id = p.id and ps.sauce_id = s.id);

-- Production starts with the sample-data banner off.
update public.store_settings set demo_banner = false where id = 1;

commit;
