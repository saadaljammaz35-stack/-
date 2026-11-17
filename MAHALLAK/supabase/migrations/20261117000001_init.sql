-- ════════════════════════════════════════════════════════════════════════════
-- MAHALLAK — initial schema
-- Every user-owned row carries user_id and is protected by Row Level Security:
-- a user can only ever see and change their own data. Photos live in private
-- storage buckets under a folder named after the user's id.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── helpers ────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- clients may send their own updated_at (offline edits); never let it go backwards
  if tg_op = 'UPDATE' and new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- ── reference data ─────────────────────────────────────────────────────────
create table public.categories (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  icon text not null,
  sort_order smallint not null default 0
);

insert into public.categories (id, name_ar, name_en, icon, sort_order) values
  ('clothing',    'ملابس',          'Clothing',    'shirt',  1),
  ('shoes',       'أحذية',          'Shoes',       'shoe',   2),
  ('electronics', 'أجهزة',          'Devices',     'device', 3),
  ('tools',       'أدوات',          'Tools',       'wrench', 4),
  ('bags',        'حقائب',          'Bags',        'bag',    5),
  ('keys',        'مفاتيح',         'Keys',        'key',    6),
  ('toys',        'ألعاب',          'Toys',        'toy',    7),
  ('books',       'كتب',            'Books',       'book',   8),
  ('accessories', 'إكسسوارات',      'Accessories', 'watch',  9),
  ('documents',   'مستندات',        'Documents',   'doc',    10),
  ('household',   'أغراض منزلية',   'Household',   'home',   11),
  ('other',       'أخرى',           'Other',       'box',    12);

-- ── users (profile) ────────────────────────────────────────────────────────
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  language text not null default 'ar' check (language in ('ar', 'en')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  cloud_sync boolean not null default false,
  cloud_photos boolean not null default false,
  ai_consent boolean not null default false,
  ai_consent_at timestamptz,
  -- never assumed: only an explicit user action sets it
  ai_training_consent boolean not null default false,
  keep_search_history boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- New auth user -> profile + private settings row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (new.id, nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''))
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Remember when AI consent was given (audit trail for the user).
create or replace function public.stamp_ai_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ai_consent and (tg_op = 'INSERT' or not old.ai_consent) then
    new.ai_consent_at := now();
  elsif not new.ai_consent then
    new.ai_consent_at := null;
  end if;
  return new;
end;
$$;

create trigger user_settings_ai_consent before insert or update on public.user_settings
  for each row execute function public.stamp_ai_consent();

-- ── images ─────────────────────────────────────────────────────────────────
create table public.item_images (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('item_original', 'item_cutout')),
  storage_path text check (storage_path is null or storage_path like user_id::text || '/%'),
  width integer not null default 0 check (width >= 0),
  height integer not null default 0 check (height >= 0),
  created_at timestamptz not null default now()
);

create table public.location_images (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'location' check (kind = 'location'),
  storage_path text check (storage_path is null or storage_path like user_id::text || '/%'),
  width integer not null default 0 check (width >= 0),
  height integer not null default 0 check (height >= 0),
  created_at timestamptz not null default now()
);

-- ── locations ──────────────────────────────────────────────────────────────
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  room text not null check (room in ('bedroom','kids_room','majlis','living','kitchen','bathroom','office','storage','garage','roof','car','other')),
  room_label text check (char_length(room_label) <= 60),
  spot text not null check (char_length(spot) between 1 and 200),
  note text check (char_length(note) <= 300),
  image_id uuid references public.location_images (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ── items ──────────────────────────────────────────────────────────────────
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  name_en text check (char_length(name_en) <= 120),
  category_id text not null default 'other' references public.categories (id),
  color text check (color in ('white','black','gray','silver','gold','beige','brown','red','pink','orange','yellow','green','blue','navy','purple')),
  keywords text[] not null default '{}' check (cardinality(keywords) <= 20),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  notes text check (char_length(notes) <= 500),
  favorite boolean not null default false,
  original_image_id uuid references public.item_images (id) on delete set null,
  cutout_image_id uuid references public.item_images (id) on delete set null,
  current_location_id uuid references public.locations (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'ai_single', 'ai_room')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_moved_at timestamptz,
  deleted_at timestamptz
);

-- ── placement history (immutable snapshots) ────────────────────────────────
create table public.item_location_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  room text not null,
  room_label text,
  spot text not null check (char_length(spot) between 1 and 200),
  note text,
  image_id uuid references public.location_images (id) on delete set null,
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ── voice / text search history ────────────────────────────────────────────
create table public.voice_search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  transcript text not null check (char_length(transcript) <= 300),
  intent text not null,
  confidence real not null default 0 check (confidence between 0 and 1),
  dialect_hints text[] not null default '{}',
  result_count integer not null default 0,
  source text not null default 'voice' check (source in ('voice', 'text', 'image')),
  created_at timestamptz not null default now()
);

-- ── dialect lexicon (versioned, readable by the app, written by admins) ────
create table public.dialect_lexicons (
  version integer primary key,
  payload jsonb not null,
  notes text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── purchases / entitlements (written only by the server) ───────────────────
create table public.entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  entitlement text not null,
  product_id text,
  store text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, entitlement)
);

-- ── AI usage metering (quota enforcement in Edge Functions) ────────────────
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period date not null,
  kind text not null check (kind in ('recognize', 'detect', 'cutout', 'query')),
  count integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (user_id, period, kind)
);

-- ── indexes ────────────────────────────────────────────────────────────────
create index items_user_updated_idx on public.items (user_id, updated_at);
create index items_location_idx on public.items (current_location_id);
create index items_original_image_idx on public.items (original_image_id);
create index items_cutout_image_idx on public.items (cutout_image_id);
create index items_category_idx on public.items (category_id);
create index locations_user_updated_idx on public.locations (user_id, updated_at);
create index locations_image_idx on public.locations (image_id);
create index history_item_idx on public.item_location_history (item_id, placed_at desc);
create index history_user_created_idx on public.item_location_history (user_id, created_at);
create index history_location_idx on public.item_location_history (location_id);
create index history_image_idx on public.item_location_history (image_id);
create index item_images_user_created_idx on public.item_images (user_id, created_at);
create index location_images_user_created_idx on public.location_images (user_id, created_at);
create index voice_user_created_idx on public.voice_search_history (user_id, created_at);

-- ── updated_at triggers ────────────────────────────────────────────────────
create trigger users_touch before update on public.users for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.user_settings for each row execute function public.touch_updated_at();
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();
create trigger locations_touch before update on public.locations for each row execute function public.touch_updated_at();

-- ── ownership guard: user_id can never be reassigned ───────────────────────
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  return new;
end;
$$;

create trigger items_owner before update on public.items for each row execute function public.prevent_owner_change();
create trigger locations_owner before update on public.locations for each row execute function public.prevent_owner_change();
create trigger history_owner before update on public.item_location_history for each row execute function public.prevent_owner_change();
create trigger item_images_owner before update on public.item_images for each row execute function public.prevent_owner_change();
create trigger location_images_owner before update on public.location_images for each row execute function public.prevent_owner_change();

-- Cross-row references must point to the same user's rows (RLS alone checks the row, not its references).
create or replace function public.check_item_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.current_location_id is not null and not exists (
    select 1 from public.locations l where l.id = new.current_location_id and l.user_id = new.user_id) then
    raise exception 'location belongs to another user';
  end if;
  if new.original_image_id is not null and not exists (
    select 1 from public.item_images i where i.id = new.original_image_id and i.user_id = new.user_id) then
    raise exception 'image belongs to another user';
  end if;
  if new.cutout_image_id is not null and not exists (
    select 1 from public.item_images i where i.id = new.cutout_image_id and i.user_id = new.user_id) then
    raise exception 'image belongs to another user';
  end if;
  return new;
end;
$$;

create trigger items_refs before insert or update on public.items for each row execute function public.check_item_refs();

create or replace function public.check_history_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.items i where i.id = new.item_id and i.user_id = new.user_id) then
    raise exception 'item belongs to another user';
  end if;
  if new.location_id is not null and not exists (
    select 1 from public.locations l where l.id = new.location_id and l.user_id = new.user_id) then
    raise exception 'location belongs to another user';
  end if;
  return new;
end;
$$;

create trigger history_refs before insert or update on public.item_location_history for each row execute function public.check_history_refs();

create or replace function public.check_location_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.image_id is not null and not exists (
    select 1 from public.location_images i where i.id = new.image_id and i.user_id = new.user_id) then
    raise exception 'image belongs to another user';
  end if;
  return new;
end;
$$;

create trigger locations_refs before insert or update on public.locations for each row execute function public.check_location_refs();

-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.categories enable row level security;
alter table public.users enable row level security;
alter table public.user_settings enable row level security;
alter table public.item_images enable row level security;
alter table public.location_images enable row level security;
alter table public.locations enable row level security;
alter table public.items enable row level security;
alter table public.item_location_history enable row level security;
alter table public.voice_search_history enable row level security;
alter table public.dialect_lexicons enable row level security;
alter table public.entitlements enable row level security;
alter table public.ai_usage enable row level security;

-- reference data: readable by everyone signed in or not, writable by nobody (service role bypasses RLS)
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy lexicon_read on public.dialect_lexicons for select to anon, authenticated using (is_active);

-- profile + settings: owner only
create policy users_select on public.users for select to authenticated using ((select auth.uid()) = id);
create policy users_update on public.users for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy settings_select on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy settings_insert on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy settings_update on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- owner-only CRUD for every user-owned table
do $$
declare
  t text;
begin
  foreach t in array array['item_images', 'location_images', 'locations', 'items', 'item_location_history', 'voice_search_history'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete', t);
  end loop;
end;
$$;

-- server-written tables: the owner can read, only the service role writes
create policy entitlements_select on public.entitlements for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_usage_select on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);

-- Placement history is append-only for clients (no rewriting where things were).
revoke update on public.item_location_history from authenticated;

-- anonymous visitors get nothing beyond the reference data
revoke all on public.users, public.user_settings, public.item_images, public.location_images, public.locations,
  public.items, public.item_location_history, public.voice_search_history, public.entitlements, public.ai_usage from anon;

-- ════════════════════════════════════════════════════════════════════════════
-- Private storage: <bucket>/<user id>/<image id>.<ext>
-- ════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('item-images', 'item-images', false, 10485760, array['image/jpeg', 'image/png']),
  ('location-images', 'location-images', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "own photos: read" on storage.objects for select to authenticated
  using (bucket_id in ('item-images', 'location-images') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos: upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('item-images', 'location-images') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos: replace" on storage.objects for update to authenticated
  using (bucket_id in ('item-images', 'location-images') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('item-images', 'location-images') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos: delete" on storage.objects for delete to authenticated
  using (bucket_id in ('item-images', 'location-images') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ════════════════════════════════════════════════════════════════════════════
-- AI quota: atomically count one use and report whether the user is within the limit.
-- Called by Edge Functions with the service role (not exposed to clients).
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.consume_ai_quota(p_user uuid, p_kind text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  insert into public.ai_usage as u (user_id, period, kind, count)
  values (p_user, date_trunc('month', now())::date, p_kind, 1)
  on conflict (user_id, period, kind) do update set count = u.count + 1
  returning count into used;
  if used > p_limit then
    update public.ai_usage set count = count - 1
      where user_id = p_user and period = date_trunc('month', now())::date and kind = p_kind;
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.record_ai_tokens(p_user uuid, p_kind text, p_in bigint, p_out bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
     set input_tokens = input_tokens + p_in, output_tokens = output_tokens + p_out
   where user_id = p_user and period = date_trunc('month', now())::date and kind = p_kind;
$$;

revoke execute on function public.consume_ai_quota(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.record_ai_tokens(uuid, text, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
