-- SAMAT | سماط — core schema
-- Money is stored as integer halalas (1 SAR = 100 halalas). Never floats.
-- Every table has RLS enabled (see the rls migration). Writes that touch money, stock,
-- loyalty or permissions go through SECURITY DEFINER functions in the functions migration.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------------------------
create type public.category_kind as enum ('burger', 'shawarma', 'fries');
create type public.builder_type as enum ('burger', 'shawarma', 'simple');
create type public.ingredient_role as enum ('base', 'default', 'extra', 'bread_choice');
create type public.order_status as enum (
  'pending_payment',   -- created, waiting for the customer to pay
  'payment_failed',    -- payment declined / abandoned (terminal)
  'expired',           -- unpaid order timed out (terminal)
  'awaiting_approval', -- paid or authorised; waiting for the restaurant to accept
  'accepted',          -- accepted by staff, visible to the kitchen
  'preparing',
  'ready',             -- ready for pickup
  'delivered',         -- handed over to the customer (terminal)
  'rejected',          -- rejected by staff (terminal, refund flow)
  'cancelled'          -- cancelled after acceptance (terminal, refund flow)
);
create type public.payment_status as enum (
  'unpaid', 'initiated', 'authorized', 'paid', 'failed', 'voided',
  'refund_pending', 'refunded', 'partially_refunded', 'not_required'
);
create type public.notification_status as enum ('pending', 'sent', 'failed', 'skipped');
create type public.notification_channel as enum ('email', 'sms', 'whatsapp');
create type public.inventory_movement_type as enum (
  'purchase', 'adjustment', 'sale', 'waste', 'cancel_return', 'correction'
);
create type public.loyalty_txn_type as enum (
  'earn', 'redeem', 'refund_redeem', 'reverse_earn', 'expire', 'adjust'
);

-- ---------------------------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- URL-safe random token (no padding). 18 bytes -> 24 chars, 32 bytes -> 43 chars.
create or replace function public.random_token(n_bytes int) returns text
language sql volatile as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(n_bytes), 'base64'), '+/', '-_'), '=')
$$;

-- Human-friendly code from an alphabet without look-alike characters (no 0/O, 1/I/L, 2/Z, 5/S, 8/B, 6/G).
create or replace function public.random_code(len int) returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ACDEFHJKMNPQRTUVWXY3479';
  bytes bytea := extensions.gen_random_bytes(len);
  out text := '';
begin
  for i in 0 .. len - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Roles, permissions, staff
-- ---------------------------------------------------------------------------------------------
create table public.permissions (
  key text primary key,
  description_ar text not null,
  description_en text not null
);

create table public.roles (
  key text primary key check (key in ('owner', 'admin', 'orders_manager', 'kitchen')),
  name_ar text not null,
  name_en text not null,
  sort_order int not null default 0
);

create table public.role_permissions (
  role_key text not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext not null unique,
  full_name text,
  role_key text not null references public.roles(key),
  is_active boolean not null default true,
  invited_by uuid references auth.users(id),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger staff_members_touch before update on public.staff_members
  for each row execute function public.touch_updated_at();

-- Per-staff overrides on top of the role defaults: allow=true grants, allow=false revokes.
create table public.staff_permission_overrides (
  user_id uuid not null references public.staff_members(user_id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  allow boolean not null,
  primary key (user_id, permission_key)
);

-- Pending invitations (the invitee proves the e-mail by signing in with an e-mail OTP).
create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  full_name text,
  role_key text not null references public.roles(key) check (role_key <> 'owner'),
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create unique index staff_invitations_open_email on public.staff_invitations (email)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  full_name text,
  email extensions.citext,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Store settings (single branch, single row)
-- ---------------------------------------------------------------------------------------------
create table public.store_settings (
  id int primary key default 1 check (id = 1),
  -- Branch
  branch_name_ar text not null default 'سماط',
  branch_name_en text not null default 'SAMAT',
  address_ar text,
  address_en text,
  maps_url text check (maps_url is null or maps_url ~* '^https://'),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  phone text,
  timezone text not null default 'Asia/Riyadh',
  -- {"sun":[{"open":"12:00","close":"02:00"}], ...}; a close earlier than open spans midnight.
  opening_hours jsonb not null default '{}'::jsonb,
  pickup_instructions_ar text,
  pickup_instructions_en text,
  -- Ordering controls / busy mode
  accepting_orders boolean not null default true,
  pause_message_ar text,
  pause_message_en text,
  busy_mode boolean not null default false,
  busy_extra_minutes int not null default 10 check (busy_extra_minutes between 0 and 240),
  busy_message_ar text,
  busy_message_en text,
  base_prep_minutes int not null default 15 check (base_prep_minutes between 1 and 240),
  max_active_orders int check (max_active_orders is null or max_active_orders > 0),
  kitchen_late_minutes int not null default 20 check (kitchen_late_minutes between 1 and 240),
  unpaid_order_ttl_minutes int not null default 20 check (unpaid_order_ttl_minutes between 5 and 120),
  pickup_screen_enabled boolean not null default true,
  demo_banner boolean not null default false, -- shows "sample data" banner on non-production environments
  -- Notifications
  admin_notification_emails text[] not null default '{}',
  low_stock_alerts boolean not null default true,
  -- Tax / invoice
  legal_name text,
  vat_number text check (vat_number is null or vat_number ~ '^3[0-9]{13}3$'),
  cr_number text,
  vat_enabled boolean not null default true,
  vat_rate_bps int not null default 1500 check (vat_rate_bps between 0 and 10000),
  prices_include_vat boolean not null default true,
  invoice_footer_ar text,
  invoice_footer_en text,
  -- Payments: only methods actually activated on the merchant account are switched on.
  payment_methods jsonb not null default '{"creditcard": false, "applepay": false, "stcpay": false}'::jsonb,
  card_networks text[] not null default '{mada,visa,mastercard}',
  manual_capture boolean not null default true,
  -- Loyalty (points)
  loyalty_enabled boolean not null default false,
  loyalty_points_per_sar numeric(8, 3) not null default 1 check (loyalty_points_per_sar >= 0),
  loyalty_point_value_halalas int not null default 5 check (loyalty_point_value_halalas >= 0),
  loyalty_min_redeem_points int not null default 100 check (loyalty_min_redeem_points >= 0),
  loyalty_expiry_days int check (loyalty_expiry_days is null or loyalty_expiry_days > 0),
  updated_at timestamptz not null default now()
);
create trigger store_settings_touch before update on public.store_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------------------------
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name_ar text not null,
  name_en text not null,
  group_key text not null default 'extra'
    check (group_key in ('meat', 'vegetable', 'cheese', 'bread', 'sauce', 'potato', 'extra', 'product', 'packaging')),
  unit text not null default 'portion' check (unit in ('portion', 'piece', 'g', 'kg', 'ml', 'l')),
  on_hand numeric(12, 3) not null default 0,
  low_threshold numeric(12, 3) not null default 0 check (low_threshold >= 0),
  is_active boolean not null default true,
  low_alert_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger inventory_touch before update on public.inventory
  for each row execute function public.touch_updated_at();

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  movement public.inventory_movement_type not null,
  quantity numeric(12, 3) not null check (quantity <> 0), -- signed: + adds stock, - removes stock
  balance_after numeric(12, 3) not null,
  order_id uuid,
  note text,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index inventory_movements_item on public.inventory_movements (inventory_id, created_at desc);
-- One sale movement per order per item: re-running acceptance can never double-deduct.
create unique index inventory_movements_sale_once on public.inventory_movements (order_id, inventory_id)
  where movement = 'sale';
create unique index inventory_movements_return_once on public.inventory_movements (order_id, inventory_id)
  where movement = 'cancel_return';

-- ---------------------------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  kind public.category_kind not null unique, -- exactly three main categories, no more
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_ar text not null,
  name_en text not null,
  tagline_ar text,
  tagline_en text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  builder public.builder_type not null default 'simple',
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  image_url text,
  base_price int check (base_price is null or base_price >= 0), -- halalas; NULL = not priced yet
  is_active boolean not null default false,   -- published on the menu
  is_available boolean not null default true, -- temporary pause ("إيقاف مؤقت")
  is_featured boolean not null default false,
  inventory_id uuid references public.inventory(id) on delete set null, -- stock-tracked simple products
  inventory_qty numeric(12, 3) not null default 1 check (inventory_qty > 0),
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A product can only be published once the restaurant has set a price for it.
  constraint products_priced_when_active check (not is_active or base_price is not null),
  constraint products_deleted_not_active check (deleted_at is null or not is_active)
);
create index products_category on public.products (category_id, sort_order) where deleted_at is null;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- Builder components (bread, protein, cheese, vegetables, extras). Sauces have their own table.
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  kind text not null default 'vegetable'
    check (kind in ('bread', 'protein', 'cheese', 'vegetable', 'pickle', 'extra')),
  builder text not null default 'any' check (builder in ('burger', 'shawarma', 'any')), -- which builder view the images suit
  name_ar text not null,
  name_en text not null,
  -- Burger (side view): image_url is the layer; image_top_url is the top bun for bread.
  -- Shawarma (top view): image_url is the scatter layer; for bread it is the open flatbread.
  image_url text,
  image_top_url text,
  thumb_url text,
  layer_height numeric(5, 3) not null default 0.10 check (layer_height > 0 and layer_height < 1),
  extra_price int not null default 0 check (extra_price >= 0), -- default price per extra portion
  is_active boolean not null default true,
  inventory_id uuid references public.inventory(id) on delete set null,
  inventory_qty numeric(12, 3) not null default 1 check (inventory_qty > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ingredients_touch before update on public.ingredients
  for each row execute function public.touch_updated_at();

create table public.sauces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_ar text not null,
  name_en text not null,
  image_url text,         -- thumbnail / product photo
  layer_url text,         -- burger side-view drip layer
  top_layer_url text,     -- shawarma top-view drizzle layer
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  price int not null default 0 check (price >= 0),
  is_active boolean not null default true,
  inventory_id uuid references public.inventory(id) on delete set null,
  inventory_qty numeric(12, 3) not null default 1 check (inventory_qty > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sauces_touch before update on public.sauces
  for each row execute function public.touch_updated_at();

-- Which ingredients appear in which product, and how.
create table public.product_ingredients (
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  role public.ingredient_role not null default 'default',
  default_qty int not null default 1 check (default_qty >= 0 and default_qty <= 10),
  max_qty int not null default 1 check (max_qty >= 1 and max_qty <= 10),
  price_override int check (price_override is null or price_override >= 0), -- per extra portion / bread surcharge
  is_free boolean not null default false,
  layer_order int not null default 0, -- bottom (low) to top (high)
  sort_order int not null default 0,
  primary key (product_id, ingredient_id),
  constraint product_ingredients_qty check (max_qty >= default_qty),
  -- Base ingredients (e.g. the burger bun) are always present.
  constraint product_ingredients_base_present check (role <> 'base' or default_qty >= 1)
);

create table public.product_sauces (
  product_id uuid not null references public.products(id) on delete cascade,
  sauce_id uuid not null references public.sauces(id) on delete cascade,
  included_qty int not null default 0 check (included_qty >= 0 and included_qty <= 5), -- free portions
  is_default boolean not null default false,
  max_qty int not null default 2 check (max_qty >= 1 and max_qty <= 5),
  price_override int check (price_override is null or price_override >= 0),
  sort_order int not null default 0,
  primary key (product_id, sauce_id)
);

-- Generic option groups (e.g. fries size). Nothing is assumed; the restaurant defines them.
create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name_ar text not null,
  name_en text not null,
  selection text not null default 'single' check (selection in ('single', 'multiple')),
  is_required boolean not null default false,
  max_select int not null default 1 check (max_select >= 1),
  sort_order int not null default 0
);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.option_groups(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name_ar text not null,
  name_en text not null,
  price_delta int not null default 0 check (price_delta >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  inventory_id uuid references public.inventory(id) on delete set null,
  inventory_qty numeric(12, 3) not null default 1 check (inventory_qty > 0),
  sort_order int not null default 0
);
create index product_options_group on public.product_options (group_id, sort_order);

-- ---------------------------------------------------------------------------------------------
-- Coupons & automatic offers
-- ---------------------------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext unique check (code is null or code ~ '^[A-Za-z0-9_-]{3,32}$'),
  is_automatic boolean not null default false, -- automatic offer (no code)
  title_ar text not null,
  title_en text not null,
  kind text not null check (kind in ('percent', 'fixed')),
  value int not null check (value > 0), -- percent: basis points (1000 = 10%); fixed: halalas
  max_discount int check (max_discount is null or max_discount > 0),
  min_order int not null default 0 check (min_order >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int check (usage_limit is null or usage_limit > 0),
  per_customer_limit int check (per_customer_limit is null or per_customer_limit > 0),
  audience text not null default 'all' check (audience in ('all', 'new_customers', 'loyalty_members', 'specific')),
  customer_phone text,
  product_ids uuid[],
  category_kinds public.category_kind[],
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_or_auto check ((code is null) = is_automatic),
  constraint coupons_percent_range check (kind <> 'percent' or value <= 10000),
  constraint coupons_window check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint coupons_specific_phone check (audience <> 'specific' or customer_phone is not null)
);
create trigger coupons_touch before update on public.coupons
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Loyalty
-- ---------------------------------------------------------------------------------------------
create table public.loyalty_accounts (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  lifetime_earned int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  points_cost int not null check (points_cost > 0),
  reward_type text not null check (reward_type in ('discount_fixed', 'free_product')),
  value int check (value is null or value > 0), -- discount_fixed: halalas
  product_id uuid references public.products(id) on delete set null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_rewards_shape check (
    (reward_type = 'discount_fixed' and value is not null) or
    (reward_type = 'free_product' and product_id is not null))
);
create trigger loyalty_rewards_touch before update on public.loyalty_rewards
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created on public.audit_logs (created_at desc);
create index audit_logs_entity on public.audit_logs (entity, entity_id);

-- ---------------------------------------------------------------------------------------------
-- Distributed rate limiting (fixed window, shared by every server instance)
-- ---------------------------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
