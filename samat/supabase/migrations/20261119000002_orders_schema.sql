-- SAMAT | سماط — orders, payments, invoices, notifications, loyalty ledger, printing

create table public.order_counters (
  day date primary key,
  last_number int not null default 0
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null,           -- daily sequence, shown on the pickup screen
  business_day date not null,
  tracking_token text not null unique default public.random_token(18), -- customer's private link
  pickup_code text not null unique,    -- 6 chars, typed by staff at the counter
  pickup_token text not null unique default public.random_token(32),   -- encoded in the QR
  idempotency_key text not null unique,
  status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'unpaid',
  -- Customer (guest checkout allowed; customer_id set when signed in)
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  customer_phone text not null check (customer_phone ~ '^\+9665[0-9]{8}$'),
  customer_email extensions.citext,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  notes text check (notes is null or char_length(notes) <= 300),
  -- Money (halalas)
  subtotal int not null check (subtotal >= 0),
  discount_total int not null default 0 check (discount_total >= 0),
  coupon_discount int not null default 0 check (coupon_discount >= 0),
  points_discount int not null default 0 check (points_discount >= 0),
  vat_amount int not null default 0 check (vat_amount >= 0),
  total int not null check (total >= 0),
  currency text not null default 'SAR' check (currency = 'SAR'),
  vat_rate_bps int not null default 0,
  prices_include_vat boolean not null default true,
  coupon_id uuid references public.coupons(id) on delete set null,
  coupon_code text,
  loyalty_reward_id uuid references public.loyalty_rewards(id) on delete set null,
  points_redeemed int not null default 0 check (points_redeemed >= 0),
  points_earned int not null default 0 check (points_earned >= 0),
  -- Lifecycle
  prep_minutes int,
  estimated_ready_at timestamptz,
  expires_at timestamptz,               -- unpaid orders expire
  paid_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  preparing_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  delivered_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejected_by uuid references auth.users(id),
  reject_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_day, order_number),
  constraint orders_total_math check (total = subtotal - discount_total + case when prices_include_vat then 0 else vat_amount end),
  constraint orders_discount_sum check (discount_total = coupon_discount + points_discount),
  constraint orders_delivered_has_actor check (status <> 'delivered' or delivered_at is not null)
);
create index orders_status_created on public.orders (status, created_at);
create index orders_customer on public.orders (customer_id, created_at desc);
create index orders_phone on public.orders (customer_phone, created_at desc);
create index orders_created on public.orders (created_at desc);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_ar text not null,
  product_name_en text not null,
  category_kind public.category_kind not null,
  builder public.builder_type not null,
  quantity int not null check (quantity between 1 and 20),
  unit_base_price int not null check (unit_base_price >= 0),
  unit_extras_price int not null default 0 check (unit_extras_price >= 0),
  unit_price int not null check (unit_price >= 0),
  line_total int not null check (line_total >= 0),
  bread_name_ar text,
  bread_name_en text,
  notes text check (notes is null or char_length(notes) <= 200),
  selection jsonb not null default '{}'::jsonb, -- the customer's raw selection (used for "order again")
  sort_order int not null default 0,
  constraint order_items_math check (unit_price = unit_base_price + unit_extras_price and line_total = unit_price * quantity)
);
create index order_items_order on public.order_items (order_id, sort_order);
create index order_items_product on public.order_items (product_id);

create table public.order_customizations (
  id bigint generated always as identity primary key,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  kind text not null check (kind in ('ingredient', 'sauce', 'option', 'bread')),
  ref_id uuid,
  name_ar text not null,
  name_en text not null,
  action text not null check (action in ('included', 'removed', 'added', 'extra', 'selected')),
  quantity int not null default 1 check (quantity >= 0),
  unit_price int not null default 0 check (unit_price >= 0),
  total_price int not null default 0 check (total_price >= 0),
  sort_order int not null default 0
);
create index order_customizations_item on public.order_customizations (order_item_id, sort_order);

-- Status history for every order.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid,
  actor_type text not null check (actor_type in ('customer', 'staff', 'system', 'payment')),
  note text,
  created_at timestamptz not null default now()
);
create index order_events_order on public.order_events (order_id, created_at);

-- Public, PII-free projection of live orders. Pickup screen, tracking page and kitchen subscribe
-- to Realtime changes on this table only; details are fetched through authorised APIs.
create table public.order_board (
  order_id uuid primary key references public.orders(id) on delete cascade,
  order_number int not null,
  business_day date not null,
  status public.order_status not null,
  ready_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);
create index order_board_status on public.order_board (status, updated_at desc);

-- Stock held by an order between checkout and the restaurant's decision.
create table public.inventory_reservations (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  quantity numeric(12, 3) not null check (quantity > 0),
  status text not null default 'held' check (status in ('held', 'committed', 'released')),
  expires_at timestamptz, -- null = held until the restaurant accepts/rejects
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, inventory_id)
);
create index inventory_reservations_active on public.inventory_reservations (inventory_id) where status = 'held';

-- ---------------------------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(), -- also sent to Moyasar as given_id
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('moyasar', 'simulator', 'none')),
  provider_payment_id text unique,
  amount int not null check (amount >= 0),
  currency text not null default 'SAR',
  status public.payment_status not null default 'initiated',
  method text,          -- creditcard / applepay / stcpay
  card_scheme text,     -- mada / visa / mastercard (never the card number)
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  captured_amount int not null default 0,
  refunded_amount int not null default 0,
  failure_message text,
  live boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order on public.payments (order_id, created_at desc);
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- Webhook / callback events, deduplicated by the provider's event id.
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  event_type text not null,
  provider_payment_id text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------------------------
-- Invoices (simplified tax invoice, ZATCA phase-1 QR when a VAT number is configured)
-- ---------------------------------------------------------------------------------------------
create sequence public.invoice_seq;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  invoice_number text not null unique,
  issued_at timestamptz not null default now(),
  seller_name text not null,
  vat_number text,
  subtotal_ex_vat int not null,
  vat_amount int not null,
  total int not null,
  status text not null default 'issued' check (status in ('issued', 'credited')),
  credited_at timestamptz,
  print_count int not null default 0
);

-- ---------------------------------------------------------------------------------------------
-- Notifications (customer & staff), deduplicated per event/channel
-- ---------------------------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  order_id uuid references public.orders(id) on delete cascade,
  audience text not null check (audience in ('customer', 'staff')),
  channel public.notification_channel not null,
  template text not null,
  recipient text not null,
  locale text not null default 'ar',
  status public.notification_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  provider_message_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);
create index notifications_order on public.notifications (order_id, created_at);
create index notifications_status on public.notifications (status, created_at);
create trigger notifications_touch before update on public.notifications
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Coupons usage
-- ---------------------------------------------------------------------------------------------
create table public.coupon_redemptions (
  id bigint generated always as identity primary key,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_phone text not null,
  customer_id uuid,
  amount int not null check (amount >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'confirmed', 'released')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coupon_redemptions_coupon on public.coupon_redemptions (coupon_id, status);

-- ---------------------------------------------------------------------------------------------
-- Loyalty ledger (immutable). Earned points are tracked as lots for FIFO redemption/expiry.
-- ---------------------------------------------------------------------------------------------
create table public.loyalty_transactions (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.loyalty_accounts(customer_id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  type public.loyalty_txn_type not null,
  points int not null check (points <> 0), -- signed
  remaining int,                            -- earn lots only
  expires_at timestamptz,                   -- earn lots only
  note text,
  actor_id uuid,
  created_at timestamptz not null default now(),
  constraint loyalty_lot_shape check ((type = 'earn') = (remaining is not null))
);
create index loyalty_transactions_customer on public.loyalty_transactions (customer_id, created_at desc);
create index loyalty_transactions_lots on public.loyalty_transactions (customer_id, expires_at)
  where type = 'earn' and remaining > 0;
-- Each order can earn, redeem and be reversed at most once.
create unique index loyalty_once_per_order on public.loyalty_transactions (order_id, type)
  where order_id is not null and type in ('earn', 'redeem', 'refund_redeem', 'reverse_earn');

-- ---------------------------------------------------------------------------------------------
-- Printing
-- ---------------------------------------------------------------------------------------------
create table public.printer_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  kind text not null check (kind in ('customer_receipt', 'kitchen_ticket')),
  format text not null check (format in ('80mm', '58mm', 'a4', 'escpos')),
  target text not null default 'browser' check (target in ('browser', 'lan', 'usb', 'bluetooth', 'pdf')),
  printer_name text,
  status text not null default 'queued' check (status in ('queued', 'printing', 'done', 'failed')),
  is_reprint boolean not null default false,
  error text,
  requested_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index printer_jobs_queue on public.printer_jobs (status, created_at) where status in ('queued', 'printing');

-- ---------------------------------------------------------------------------------------------
-- SAMAT AI: write actions proposed by the assistant wait here for explicit confirmation.
-- ---------------------------------------------------------------------------------------------
create table public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete cascade,
  action text not null,
  params jsonb not null,
  summary_ar text not null,
  summary_en text not null,
  required_permission text not null references public.permissions(key),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'failed', 'expired')),
  result jsonb,
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
