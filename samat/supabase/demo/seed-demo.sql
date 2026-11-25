-- SAMAT demo data — FOR LOCAL / STAGING TESTING ONLY.
-- Prices below are placeholders so flows can be tested end to end. They are NOT the restaurant's
-- prices. The storefront shows a "sample data" banner while store_settings.demo_banner is true.
-- Never run this against production.

begin;

update public.store_settings set
  demo_banner = true,
  payment_methods = '{"creditcard": true, "applepay": false, "stcpay": false, "bank_transfer": true}',
  branch_name_ar = 'سماط — فرع تجريبي', branch_name_en = 'SAMAT — Demo branch',
  address_ar = 'عنوان تجريبي — حدّث بيانات الفرع من الإعدادات', address_en = 'Demo address — set the branch details in Settings',
  loyalty_enabled = true, loyalty_points_per_sar = 1, loyalty_point_value_halalas = 5, loyalty_min_redeem_points = 50,
  loyalty_expiry_days = 365, admin_notification_emails = '{orders-demo@samat.local}',
  vat_enabled = true, vat_rate_bps = 1500, prices_include_vat = true
where id = 1;

insert into public.inventory (sku, name_ar, name_en, group_key, unit, on_hand, low_threshold) values
  ('INV-BUN', 'خبز بريوش', 'Brioche buns', 'bread', 'piece', 60, 10),
  ('INV-BEEF', 'لحم برغر', 'Beef patties', 'meat', 'piece', 50, 10),
  ('INV-CHK', 'دجاج مقرمش', 'Crispy chicken fillets', 'meat', 'piece', 40, 8),
  ('INV-CHEDDAR', 'جبن شيدر', 'Cheddar slices', 'cheese', 'piece', 80, 15),
  ('INV-PITA', 'خبز عادي', 'Regular bread', 'bread', 'piece', 80, 15),
  ('INV-SAJ', 'خبز أبيض', 'White bread', 'bread', 'piece', 50, 10),
  ('INV-SHW-CHK', 'شاورما دجاج', 'Chicken shawarma', 'meat', 'portion', 120, 20),
  ('INV-SHW-BEEF', 'شاورما لحم', 'Beef shawarma', 'meat', 'portion', 80, 15),
  ('INV-GARLIC', 'ثومية', 'Garlic sauce', 'sauce', 'portion', 150, 20),
  ('INV-POTATO', 'بطاطس', 'Potatoes', 'potato', 'portion', 100, 20);

update public.ingredients set inventory_id = (select id from public.inventory where sku = 'INV-BUN') where slug = 'brioche-bun';
update public.ingredients set inventory_id = (select id from public.inventory where sku = 'INV-BEEF') where slug = 'beef-patty';
update public.ingredients set inventory_id = (select id from public.inventory where sku = 'INV-CHK') where slug = 'crispy-chicken';
update public.ingredients set inventory_id = (select id from public.inventory where sku = 'INV-CHEDDAR') where slug = 'cheddar';
update public.ingredients set inventory_id = (select id from public.inventory where sku = 'INV-PITA') where slug = 'regular-bread';
update public.ingredients set inventory_id = (select id from public.inventory where sku = 'INV-SAJ') where slug = 'white-bread';
update public.ingredients set inventory_id = (select id from public.inventory where sku = 'INV-SHW-CHK') where slug = 'chicken-shawarma';
update public.ingredients set inventory_id = (select id from public.inventory where sku = 'INV-SHW-BEEF') where slug = 'beef-shawarma';
update public.ingredients set inventory_id = (select id from public.inventory where sku = 'INV-POTATO'), inventory_qty = 0.25 where slug = 'shawarma-fries';
update public.sauces set inventory_id = (select id from public.inventory where sku = 'INV-GARLIC') where slug = 'garlic';

-- demo extra prices (halalas)
update public.ingredients set extra_price = 700 where slug in ('beef-patty', 'crispy-chicken');
update public.ingredients set extra_price = 300 where slug in ('cheddar', 'mushrooms', 'caramelized-onion');
update public.ingredients set extra_price = 200 where slug in ('jalapeno', 'shawarma-fries');
update public.ingredients set extra_price = 100 where extra_price = 0 and kind in ('vegetable', 'pickle');
update public.sauces set price = 200;

with c as (select id, kind from public.categories)
insert into public.products (category_id, slug, builder, name_ar, name_en, description_ar, description_en, image_url, base_price, is_active, is_featured, sort_order)
values
  ((select id from c where kind = 'burger'), 'samat-burger', 'burger', 'برغر سماط', 'SAMAT Burger',
   'لحم بقري مشوي مع شيدر ذايب وخضار طازجة، ركّبه على كيفك', 'Grilled beef, melted cheddar and fresh greens — built your way', '/media/menu/burger.webp', 2800, true, true, 1),
  ((select id from c where kind = 'shawarma'), 'samat-shawarma', 'shawarma', 'شاورما سماط', 'SAMAT Shawarma',
   'شاورما دجاج على أصولها، اختر خبزك وركّبها على مزاجك', 'Classic chicken shawarma — pick your bread and build it your way', '/media/menu/shawarma.webp', 1200, true, true, 1),
  ((select id from c where kind = 'fries'), 'samat-fries', 'simple', 'بطاطس سماط', 'SAMAT Fries',
   'بطاطس ذهبية مقرمشة', 'Golden, crispy fries', '/media/menu/fries.webp', 900, true, true, 1);

update public.products set inventory_id = (select id from public.inventory where sku = 'INV-POTATO') where slug = 'samat-fries';

-- burger compositions (layer_order bottom -> top; the bun's top half is drawn last automatically)
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
join public.ingredients g on g.slug = x.ing;

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
join public.sauces s on s.slug = x.sauce;

with g as (
  insert into public.option_groups (product_id, name_ar, name_en, selection, is_required, max_select, sort_order)
  select id, 'الحجم (تجريبي)', 'Size (demo)', 'single', true, 1, 1 from public.products where slug = 'samat-fries'
  returning id, product_id)
insert into public.product_options (group_id, product_id, name_ar, name_en, price_delta, is_default, sort_order)
select g.id, g.product_id, x.ar, x.en, x.delta, x.def, x.so from g,
  (values ('عادي', 'Regular', 0, true, 1), ('كبير', 'Large', 400, false, 2)) as x(ar, en, delta, def, so);

insert into public.loyalty_rewards (name_ar, name_en, description_ar, description_en, points_cost, reward_type, value, sort_order)
values ('خصم ١٠ ريال', '10 SAR off', 'استبدل نقاطك بخصم على طلبك', 'Redeem points for a discount', 200, 'discount_fixed', 1000, 1);

insert into public.coupons (code, title_ar, title_en, kind, value, max_discount, min_order, usage_limit, per_customer_limit)
values ('SAMAT10', 'خصم ١٠٪ (تجريبي)', '10% off (demo)', 'percent', 1000, 1500, 2000, 100, 1);

commit;
