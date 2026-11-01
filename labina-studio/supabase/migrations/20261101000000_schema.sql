-- =============================================================================
-- لَبِنة · Labina Kids Studio — core schema
-- Tables, constraints, indexes and updated_at triggers.
-- Row Level Security and functions live in the following migrations.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Admin users (linked to Supabase Auth). Roles:
--   admin : full access (content, services, settings, bookings)
--   staff : bookings, customers and messages only
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         text not null default 'admin' check (role in ('admin', 'staff')),
  display_name text check (char_length(display_name) <= 80),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Services offered by the studio
-- ---------------------------------------------------------------------------
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name             text not null check (char_length(name) between 2 and 80),
  tagline          text check (char_length(tagline) <= 160),
  description      text check (char_length(description) <= 4000),
  features         text[] not null default '{}',
  price            numeric(10, 2) check (price is null or price >= 0),
  price_note       text check (char_length(price_note) <= 80),
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 600),
  image_url        text check (char_length(image_url) <= 1000),
  color            text not null default 'coral' check (color in ('coral', 'sun', 'plum', 'lavender', 'teal')),
  icon             text not null default 'camera' check (char_length(icon) <= 40),
  is_active        boolean not null default true,
  is_bookable      boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index services_active_sort_idx on public.services (is_active, sort_order);

-- ---------------------------------------------------------------------------
-- Portfolio gallery
-- ---------------------------------------------------------------------------
create table public.gallery_items (
  id           uuid primary key default gen_random_uuid(),
  image_url    text not null check (char_length(image_url) <= 1000),
  storage_path text check (char_length(storage_path) <= 500),
  title        text check (char_length(title) <= 120),
  alt          text check (char_length(alt) <= 200),
  category     text not null check (category in ('newborn', 'kids', 'family', 'birthday', 'events')),
  shape        text not null default 'portrait' check (shape in ('square', 'portrait', 'tall', 'landscape')),
  width        integer check (width > 0),
  height       integer check (height > 0),
  is_featured  boolean not null default false,
  is_published boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index gallery_items_public_idx on public.gallery_items (is_published, category, sort_order);

-- ---------------------------------------------------------------------------
-- Client testimonials (entered by the studio from real feedback)
-- ---------------------------------------------------------------------------
create table public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  author_name  text not null check (char_length(author_name) between 2 and 80),
  author_label text check (char_length(author_label) <= 80),
  content      text not null check (char_length(content) between 5 and 1000),
  rating       smallint not null default 5 check (rating between 1 and 5),
  service_id   uuid references public.services (id) on delete set null,
  is_published boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FAQ
-- ---------------------------------------------------------------------------
create table public.faqs (
  id           uuid primary key default gen_random_uuid(),
  question     text not null check (char_length(question) between 5 and 200),
  answer       text not null check (char_length(answer) between 2 and 2000),
  is_published boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Opening hours. weekday follows Postgres extract(dow): 0 = Sunday … 6 = Saturday
-- ---------------------------------------------------------------------------
create table public.working_hours (
  weekday    smallint primary key check (weekday between 0 and 6),
  is_open    boolean not null default true,
  open_time  time not null default '10:00',
  close_time time not null default '20:00',
  constraint working_hours_order check (close_time > open_time)
);

create table public.blocked_dates (
  day        date primary key,
  reason     text check (char_length(reason) <= 120),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Site settings (key/value). Public keys are readable by visitors.
-- ---------------------------------------------------------------------------
create table public.site_settings (
  key        text primary key check (key ~ '^[a-z_]{2,40}$'),
  value      jsonb not null default '{}'::jsonb,
  is_public  boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers (one row per phone number)
-- ---------------------------------------------------------------------------
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (char_length(full_name) between 2 and 80),
  phone      text not null unique check (phone ~ '^\+?[0-9]{8,15}$'),
  email      text check (char_length(email) <= 160),
  notes      text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bookings
-- Times are studio wall-clock times (see site_settings.booking.timezone).
-- The exclusion constraint makes double-booking impossible at the database
-- level: two active bookings can never overlap, even under concurrent requests.
-- ---------------------------------------------------------------------------
create table public.bookings (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique check (reference ~ '^LB-[A-Z0-9]{6}$'),
  manage_token     uuid not null unique default gen_random_uuid(),
  customer_id      uuid not null references public.customers (id) on delete restrict,
  service_id       uuid references public.services (id) on delete set null,
  service_name     text not null,
  price_snapshot   numeric(10, 2),
  booking_date     date not null,
  start_time       time not null,
  end_time         time not null,
  children_count   smallint not null check (children_count between 1 and 20),
  customer_name    text not null check (char_length(customer_name) between 2 and 80),
  customer_phone   text not null,
  customer_email   text,
  notes            text check (char_length(notes) <= 1000),
  admin_notes      text check (char_length(admin_notes) <= 2000),
  status           text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  cancelled_reason text check (char_length(cancelled_reason) <= 500),
  source           text not null default 'website' check (source in ('website', 'admin')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint bookings_time_order check (end_time > start_time),
  constraint bookings_no_overlap exclude using gist (
    tsrange(booking_date + start_time, booking_date + end_time, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);
create index bookings_date_idx on public.bookings (booking_date, start_time);
create index bookings_status_idx on public.bookings (status, booking_date);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_phone_idx on public.bookings (customer_phone);

-- Full history of every booking (created, status changes, reschedules, notes)
create table public.booking_events (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  event       text not null check (event in ('created', 'status_changed', 'rescheduled', 'note', 'cancelled_by_customer')),
  from_status text,
  to_status   text,
  note        text check (char_length(note) <= 1000),
  actor_id    uuid references auth.users (id) on delete set null,
  actor_label text not null default 'system',
  created_at  timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- ---------------------------------------------------------------------------
-- Contact form messages
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (char_length(full_name) between 2 and 80),
  phone      text check (char_length(phone) <= 20),
  email      text check (char_length(email) <= 160),
  subject    text check (char_length(subject) <= 120),
  message    text not null check (char_length(message) between 5 and 2000),
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index contact_messages_created_idx on public.contact_messages (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();
