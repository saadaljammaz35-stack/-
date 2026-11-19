-- SAMAT | سماط — base data required in every environment (no prices, no products).

insert into public.permissions (key, description_ar, description_en) values
  ('dashboard.view',     'عرض لوحة المعلومات',                 'View the dashboard'),
  ('reports.view',       'عرض التقارير والمبيعات',              'View sales reports'),
  ('orders.view',        'عرض الطلبات',                         'View orders'),
  ('orders.manage',      'قبول الطلبات ورفضها وإلغاؤها',         'Accept, reject and cancel orders'),
  ('orders.view_pii',    'البحث برقم جوال العميل',               'Search by customer phone'),
  ('kitchen.view',       'عرض شاشة المطبخ',                      'View the kitchen display'),
  ('kitchen.update',     'تحديث حالة التحضير',                   'Update preparation status'),
  ('pickup.verify',      'التحقق من الاستلام وتسليم الطلبات',      'Verify pickup and hand over orders'),
  ('menu.manage',        'إدارة المنتجات والمكونات والصوصات',      'Manage products, ingredients and sauces'),
  ('inventory.manage',   'إدارة المخزون',                        'Manage inventory'),
  ('coupons.manage',     'إدارة الكوبونات والعروض',              'Manage coupons and offers'),
  ('loyalty.manage',     'إدارة نظام النقاط',                    'Manage the loyalty programme'),
  ('settings.manage',    'إعدادات المطعم والفرع',                'Restaurant and branch settings'),
  ('busy.manage',        'وضع الزحمة وإيقاف الطلبات',             'Busy mode and pausing orders'),
  ('staff.manage',       'إدارة الموظفين والصلاحيات',            'Manage staff and permissions'),
  ('invoices.print',     'طباعة الفواتير',                       'Print invoices'),
  ('invoices.reprint',   'إعادة طباعة الفواتير',                 'Reprint invoices'),
  ('audit.view',         'عرض سجل النشاط',                       'View the activity log'),
  ('notifications.view', 'عرض سجل الإشعارات',                    'View the notification log'),
  ('ai.use',             'استخدام مساعد SAMAT AI',               'Use SAMAT AI')
on conflict (key) do nothing;

insert into public.roles (key, name_ar, name_en, sort_order) values
  ('owner', 'المالك', 'Owner', 1),
  ('admin', 'مدير', 'Admin', 2),
  ('orders_manager', 'مدير الطلبات', 'Orders manager', 3),
  ('kitchen', 'المطبخ', 'Kitchen staff', 4)
on conflict (key) do nothing;

-- owner implicitly has every permission (see has_permission); admin gets all but staff management
insert into public.role_permissions (role_key, permission_key)
select 'admin', key from public.permissions where key <> 'staff.manage'
on conflict do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'orders_manager', unnest(array['dashboard.view', 'orders.view', 'orders.manage', 'orders.view_pii',
  'kitchen.view', 'pickup.verify', 'invoices.print', 'busy.manage', 'notifications.view'])
on conflict do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'kitchen', unnest(array['kitchen.view', 'kitchen.update', 'pickup.verify'])
on conflict do nothing;

insert into public.store_settings (id) values (1) on conflict (id) do nothing;

-- The three main categories. No other main category can be created (unique enum kind).
insert into public.categories (kind, slug, name_ar, name_en, tagline_ar, tagline_en, image_url, sort_order) values
  ('burger', 'burger', 'برغر', 'Burger', 'ركّب برغرك على كيفك', 'Build your burger your way', '/media/products/burger.webp', 1),
  ('shawarma', 'shawarma', 'شاورما', 'Shawarma', 'شاورما على مزاجك', 'Shawarma, made your way', '/media/products/shawarma.webp', 2),
  ('fries', 'fries', 'بطاطس', 'Fries', 'مقرمشة وذهبية', 'Crisp and golden', '/media/products/fries.webp', 3)
on conflict (kind) do nothing;

-- Builder ingredient library: names and transparent layer images only.
-- Prices are 0 until the restaurant sets them; nothing appears on the menu until a product uses it.
insert into public.ingredients (slug, kind, builder, name_ar, name_en, image_url, image_top_url, thumb_url, layer_height, sort_order) values
  ('brioche-bun',       'bread',     'burger',   'خبز بريوش',       'Brioche bun',        '/media/layers/burger/bun-bottom.webp', '/media/layers/burger/bun-top.webp', '/media/layers/burger/bun-top.webp', 0.25, 1),
  ('beef-patty',        'protein',   'burger',   'لحم بقري مشوي',    'Grilled beef patty', '/media/layers/burger/beef-patty.webp', null, '/media/layers/burger/beef-patty.webp', 0.20, 2),
  ('crispy-chicken',    'protein',   'burger',   'دجاج مقرمش',       'Crispy chicken',     '/media/layers/burger/crispy-chicken.webp', null, '/media/layers/burger/crispy-chicken.webp', 0.19, 3),
  ('cheddar',           'cheese',    'burger',   'جبن شيدر',         'Cheddar cheese',     '/media/layers/burger/cheddar.webp', null, '/media/layers/burger/cheddar.webp', 0.05, 4),
  ('lettuce',           'vegetable', 'burger',   'خس',               'Lettuce',            '/media/layers/burger/lettuce.webp', null, '/media/layers/burger/lettuce.webp', 0.07, 5),
  ('tomato',            'vegetable', 'burger',   'طماطم',            'Tomato',             '/media/layers/burger/tomato.webp', null, '/media/layers/burger/tomato.webp', 0.075, 6),
  ('red-onion',         'vegetable', 'burger',   'بصل أحمر',         'Red onion',          '/media/layers/burger/red-onion.webp', null, '/media/layers/burger/red-onion.webp', 0.05, 7),
  ('caramelized-onion', 'vegetable', 'burger',   'بصل مكرمل',        'Caramelized onion',  '/media/layers/burger/caramelized-onion.webp', null, '/media/layers/burger/caramelized-onion.webp', 0.055, 8),
  ('pickles',           'pickle',    'burger',   'مخلل',             'Pickles',            '/media/layers/burger/pickles.webp', null, '/media/layers/burger/pickles.webp', 0.06, 9),
  ('jalapeno',          'pickle',    'burger',   'هالبينو',          'Jalapeño',           '/media/layers/burger/jalapeno.webp', null, '/media/layers/burger/jalapeno.webp', 0.05, 10),
  ('mushrooms',         'vegetable', 'burger',   'فطر',              'Mushrooms',          '/media/layers/burger/mushrooms.webp', null, '/media/layers/burger/mushrooms.webp', 0.055, 11),
  ('regular-bread',     'bread',     'shawarma', 'خبز عادي',         'Regular bread',      '/media/layers/shawarma/bread-regular.webp', null, '/media/layers/shawarma/bread-regular.webp', 0.10, 20),
  ('white-bread',       'bread',     'shawarma', 'خبز أبيض',         'White bread',        '/media/layers/shawarma/bread-white.webp', null, '/media/layers/shawarma/bread-white.webp', 0.10, 21),
  ('chicken-shawarma',  'protein',   'shawarma', 'شاورما دجاج',      'Chicken shawarma',   '/media/layers/shawarma/chicken.webp', null, '/media/layers/shawarma/chicken.webp', 0.10, 22),
  ('beef-shawarma',     'protein',   'shawarma', 'شاورما لحم',       'Beef shawarma',      '/media/layers/shawarma/beef.webp', null, '/media/layers/shawarma/beef.webp', 0.10, 23),
  ('shawarma-pickles',  'pickle',    'shawarma', 'مخلل',             'Pickles',            '/media/layers/shawarma/pickles.webp', null, '/media/layers/shawarma/pickles.webp', 0.10, 24),
  ('shawarma-fries',    'extra',     'shawarma', 'بطاطس داخل الساندويتش', 'Fries inside',   '/media/layers/shawarma/fries.webp', null, '/media/layers/shawarma/fries.webp', 0.10, 25),
  ('shawarma-tomato',   'vegetable', 'shawarma', 'طماطم',            'Tomato',             '/media/layers/shawarma/tomato.webp', null, '/media/layers/shawarma/tomato.webp', 0.10, 26),
  ('shawarma-lettuce',  'vegetable', 'shawarma', 'خس',               'Lettuce',            '/media/layers/shawarma/lettuce.webp', null, '/media/layers/shawarma/lettuce.webp', 0.10, 27),
  ('onion-parsley',     'vegetable', 'shawarma', 'بصل وبقدونس',      'Onion & parsley',    '/media/layers/shawarma/onion-parsley.webp', null, '/media/layers/shawarma/onion-parsley.webp', 0.10, 28)
on conflict (slug) do nothing;

insert into public.sauces (slug, name_ar, name_en, color, image_url, layer_url, top_layer_url, sort_order) values
  ('garlic',  'ثومية',      'Garlic sauce',  '#F1EBDA', '/media/sauces/garlic.webp',  '/media/layers/burger/sauce-garlic.webp',  '/media/layers/shawarma/sauce-garlic.webp', 1),
  ('special', 'صوص خاص',    'Special sauce', '#E79A5C', '/media/sauces/special.webp', '/media/layers/burger/sauce-special.webp', '/media/layers/shawarma/sauce-special.webp', 2),
  ('bbq',     'باربكيو',     'BBQ',           '#5A2A18', '/media/sauces/bbq.webp',     '/media/layers/burger/sauce-bbq.webp',     '/media/layers/shawarma/sauce-bbq.webp', 3),
  ('spicy',   'حار',        'Hot sauce',     '#C3341F', '/media/sauces/spicy.webp',   '/media/layers/burger/sauce-spicy.webp',   '/media/layers/shawarma/sauce-spicy.webp', 4),
  ('tahini',  'طحينة',      'Tahini',        '#D6BF94', '/media/sauces/tahini.webp',  '/media/layers/burger/sauce-tahini.webp',  '/media/layers/shawarma/sauce-tahini.webp', 5)
on conflict (slug) do nothing;
