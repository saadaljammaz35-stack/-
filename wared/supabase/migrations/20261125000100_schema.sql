-- وارد — core schema.
-- Tables, types, helper functions, indexes and triggers. Row Level Security lives in the next migration.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.content_status as enum ('draft', 'review', 'scheduled', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_kind as enum ('general', 'careers', 'press', 'guest_suggestion', 'feedback');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inbox_status as enum ('new', 'in_progress', 'resolved', 'archived', 'spam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sponsorship_status as enum ('new', 'contacted', 'negotiating', 'won', 'lost', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscriber_status as enum ('pending', 'active', 'unsubscribed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_kind as enum ('image', 'audio', 'video');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

-- Arabic-aware normalisation for search: strips diacritics and tatweel and
-- folds common spelling variants (أ/إ/آ/ٱ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي).
create or replace function public.normalize_ar(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(
    translate(
      regexp_replace(coalesce(input, ''), '[ً-ْٰـ]', '', 'g'),
      'أإآٱةىؤئ',
      'ااااهيوي'
    )
  );
$$;

-- Builds a prefix tsquery ("word:* & word:*") from free text. Returns null for empty input.
create or replace function public.build_prefix_tsquery(input text)
returns tsquery
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when count(*) = 0 then null
              else to_tsquery('simple', string_agg(w || ':*', ' & '))
         end
  from (
    select regexp_replace(t, '[^a-z0-9ء-ي٠-٩ٱ-ۓ۰-۹]', '', 'g') as w
    from regexp_split_to_table(public.normalize_ar(input), '\s+') as t
  ) words
  where length(w) > 0;
$$;

create or replace function public.is_live(p_status public.content_status, p_published_at timestamptz)
returns boolean
language sql
stable
parallel safe
set search_path = ''
as $$
  select p_status in ('published', 'scheduled')
     and p_published_at is not null
     and p_published_at <= now();
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: roles and profiles
-- ---------------------------------------------------------------------------

create table if not exists public.roles (
  key text primary key check (key in ('owner', 'admin', 'editor', 'writer')),
  name_ar text not null,
  name_en text not null,
  rank smallint not null unique,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.roles (key, name_ar, name_en, rank, permissions) values
  ('owner', 'المالك', 'Owner', 100, array[
    'content.read_all', 'content.create', 'content.edit_any', 'content.publish', 'content.delete',
    'media.upload', 'media.delete', 'inbox.manage', 'subscribers.manage', 'analytics.read',
    'users.manage', 'settings.manage', 'audit.read']),
  ('admin', 'المدير', 'Admin', 80, array[
    'content.read_all', 'content.create', 'content.edit_any', 'content.publish', 'content.delete',
    'media.upload', 'media.delete', 'inbox.manage', 'subscribers.manage', 'analytics.read',
    'users.manage', 'settings.manage', 'audit.read']),
  ('editor', 'المحرر', 'Editor', 60, array[
    'content.read_all', 'content.create', 'content.edit_any', 'content.publish', 'content.delete',
    'media.upload', 'media.delete', 'analytics.read']),
  ('writer', 'الكاتب', 'Writer', 40, array[
    'content.read_all', 'content.create', 'media.upload'])
on conflict (key) do update
  set name_ar = excluded.name_ar,
      name_en = excluded.name_en,
      rank = excluded.rank,
      permissions = excluded.permissions;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null unique,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  role text references public.roles (key) on update cascade,
  is_active boolean not null default true,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active and p.role is not null;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role is not null
  );
$$;

create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.key = p.role
    where p.id = auth.uid() and p.is_active and perm = any (r.permissions)
  );
$$;

create or replace function public.role_rank(p_role text)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select r.rank from public.roles r where r.key = p_role), 0)::smallint;
$$;

-- New auth users get a profile without any role. An owner or admin grants a role from the dashboard.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guards role and activation changes. SQL run as the service role (auth.uid() is null) is trusted.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  actor_rank smallint;
  owners_left int;
begin
  if new.id <> old.id or new.email <> old.email then
    if actor is not null then
      raise exception 'profile id and email are managed by auth' using errcode = '42501';
    end if;
  end if;

  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    if actor is not null then
      if not public.has_permission('users.manage') then
        raise exception 'not allowed to change roles' using errcode = '42501';
      end if;
      if actor = old.id then
        raise exception 'you cannot change your own role or status' using errcode = '42501';
      end if;
      actor_role := public.current_staff_role();
      actor_rank := public.role_rank(actor_role);
      if actor_role <> 'owner' then
        if public.role_rank(old.role) >= actor_rank or public.role_rank(new.role) >= actor_rank then
          raise exception 'you can only manage roles below your own' using errcode = '42501';
        end if;
      end if;
    end if;

    if old.role = 'owner' and (new.role is distinct from 'owner' or not new.is_active) then
      select count(*) into owners_left
      from public.profiles
      where role = 'owner' and is_active and id <> old.id;
      if owners_left = 0 then
        raise exception 'the last active owner cannot be removed' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('images', 'audio', 'video')),
  path text not null check (path ~ '^[a-z0-9][a-z0-9/_.-]{2,250}$'),
  kind public.media_kind not null,
  mime_type text not null,
  bytes bigint not null check (bytes > 0),
  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  alt text check (alt is null or char_length(alt) <= 300),
  alt_en text check (alt_en is null or char_length(alt_en) <= 300),
  credit text check (credit is null or char_length(credit) <= 200),
  original_name text check (original_name is null or char_length(original_name) <= 255),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create index if not exists media_assets_kind_created_idx on public.media_assets (kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Content: programs (podcasts), episodes, guests, articles, clips
-- ---------------------------------------------------------------------------

create table if not exists public.podcasts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  kind text not null default 'podcast' check (kind in ('podcast', 'series', 'show')),
  title text not null check (char_length(title) between 1 and 160),
  title_en text check (title_en is null or char_length(title_en) <= 160),
  tagline text check (tagline is null or char_length(tagline) <= 240),
  tagline_en text check (tagline_en is null or char_length(tagline_en) <= 240),
  description text check (description is null or char_length(description) <= 4000),
  description_en text check (description_en is null or char_length(description_en) <= 4000),
  hosts text check (hosts is null or char_length(hosts) <= 240),
  cover_image_id uuid references public.media_assets (id) on delete set null,
  language text not null default 'ar' check (language in ('ar', 'en')),
  explicit boolean not null default false,
  itunes_category text not null default 'Society & Culture',
  apple_podcasts_url text check (apple_podcasts_url is null or apple_podcasts_url ~ '^https://podcasts\.apple\.com/'),
  spotify_url text check (spotify_url is null or spotify_url ~ '^https://open\.spotify\.com/'),
  youtube_playlist_url text check (youtube_playlist_url is null or youtube_playlist_url ~ '^https://(www\.)?youtube\.com/'),
  anghami_url text check (anghami_url is null or anghami_url ~ '^https://(play\.)?anghami\.com/'),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  sort_order int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', public.normalize_ar(coalesce(title, '') || ' ' || coalesce(title_en, ''))), 'A') ||
    setweight(to_tsvector('simple', public.normalize_ar(coalesce(tagline, '') || ' ' || coalesce(description, '') || ' ' || coalesce(hosts, ''))), 'B')
  ) stored
);

create index if not exists podcasts_live_idx on public.podcasts (status, published_at desc);
create index if not exists podcasts_search_idx on public.podcasts using gin (search_vector);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  podcast_id uuid not null references public.podcasts (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  number int check (number is null or number > 0),
  season int check (season is null or season > 0),
  episode_type text not null default 'full' check (episode_type in ('full', 'trailer', 'bonus')),
  title text not null check (char_length(title) between 1 and 200),
  title_en text check (title_en is null or char_length(title_en) <= 200),
  summary text check (summary is null or char_length(summary) <= 600),
  summary_en text check (summary_en is null or char_length(summary_en) <= 600),
  show_notes text check (show_notes is null or char_length(show_notes) <= 20000),
  show_notes_en text check (show_notes_en is null or char_length(show_notes_en) <= 20000),
  cover_image_id uuid references public.media_assets (id) on delete set null,
  audio_asset_id uuid references public.media_assets (id) on delete set null,
  audio_url text check (audio_url is null or audio_url ~ '^https://'),
  audio_mime text check (audio_mime is null or audio_mime in ('audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav')),
  audio_bytes bigint check (audio_bytes is null or audio_bytes > 0),
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  youtube_video_id text check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  spotify_episode_id text check (spotify_episode_id is null or spotify_episode_id ~ '^[A-Za-z0-9]{22}$'),
  apple_episode_url text check (apple_episode_url is null or apple_episode_url ~ '^https://podcasts\.apple\.com/'),
  is_featured boolean not null default false,
  explicit boolean not null default false,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', public.normalize_ar(coalesce(title, '') || ' ' || coalesce(title_en, ''))), 'A') ||
    setweight(to_tsvector('simple', public.normalize_ar(coalesce(summary, '') || ' ' || coalesce(summary_en, ''))), 'B') ||
    setweight(to_tsvector('simple', public.normalize_ar(left(coalesce(show_notes, ''), 8000))), 'C')
  ) stored,
  constraint episodes_scheduled_needs_date check (status not in ('scheduled', 'published') or published_at is not null)
);

create index if not exists episodes_podcast_idx on public.episodes (podcast_id, published_at desc);
create index if not exists episodes_live_idx on public.episodes (status, published_at desc);
create index if not exists episodes_featured_idx on public.episodes (published_at desc) where is_featured;
create index if not exists episodes_search_idx on public.episodes using gin (search_vector);
create index if not exists episodes_title_trgm_idx on public.episodes using gin (title extensions.gin_trgm_ops);

create table if not exists public.episode_chapters (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  start_seconds int not null check (start_seconds >= 0),
  title text not null check (char_length(title) between 1 and 200),
  title_en text check (title_en is null or char_length(title_en) <= 200),
  position int not null default 0,
  unique (episode_id, start_seconds)
);

create index if not exists episode_chapters_episode_idx on public.episode_chapters (episode_id, start_seconds);

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  source_format text not null default 'plain' check (source_format in ('plain', 'vtt', 'srt')),
  segments jsonb not null default '[]'::jsonb check (jsonb_typeof(segments) = 'array'),
  plain_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (to_tsvector('simple', public.normalize_ar(left(plain_text, 200000)))) stored,
  unique (episode_id, locale)
);

create index if not exists transcripts_search_idx on public.transcripts using gin (search_vector);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 1 and 120),
  name_en text check (name_en is null or char_length(name_en) <= 120),
  headline text check (headline is null or char_length(headline) <= 200),
  headline_en text check (headline_en is null or char_length(headline_en) <= 200),
  bio text check (bio is null or char_length(bio) <= 4000),
  bio_en text check (bio_en is null or char_length(bio_en) <= 4000),
  photo_id uuid references public.media_assets (id) on delete set null,
  website_url text check (website_url is null or website_url ~ '^https://'),
  x_handle text check (x_handle is null or x_handle ~ '^[A-Za-z0-9_]{1,15}$'),
  instagram_handle text check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9_.]{1,30}$'),
  linkedin_url text check (linkedin_url is null or linkedin_url ~ '^https://(www\.)?linkedin\.com/'),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', public.normalize_ar(coalesce(name, '') || ' ' || coalesce(name_en, ''))), 'A') ||
    setweight(to_tsvector('simple', public.normalize_ar(coalesce(headline, '') || ' ' || coalesce(bio, ''))), 'B')
  ) stored
);

create index if not exists guests_live_idx on public.guests (status, published_at desc);
create index if not exists guests_search_idx on public.guests using gin (search_vector);

create table if not exists public.episode_guests (
  episode_id uuid not null references public.episodes (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete cascade,
  role text not null default 'guest' check (role in ('guest', 'host', 'co_host')),
  position int not null default 0,
  primary key (episode_id, guest_id)
);

create index if not exists episode_guests_guest_idx on public.episode_guests (guest_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 1 and 80),
  name_en text check (name_en is null or char_length(name_en) <= 80),
  description text check (description is null or char_length(description) <= 500),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  kind text not null default 'article' check (kind in ('story', 'article', 'essay', 'interview')),
  category_id uuid references public.categories (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  title_en text check (title_en is null or char_length(title_en) <= 200),
  dek text check (dek is null or char_length(dek) <= 400),
  dek_en text check (dek_en is null or char_length(dek_en) <= 400),
  body text not null default '' check (char_length(body) <= 100000),
  body_en text check (body_en is null or char_length(body_en) <= 100000),
  cover_image_id uuid references public.media_assets (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text check (author_name is null or char_length(author_name) <= 120),
  reading_minutes int check (reading_minutes is null or reading_minutes between 1 and 240),
  related_episode_id uuid references public.episodes (id) on delete set null,
  is_featured boolean not null default false,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', public.normalize_ar(coalesce(title, '') || ' ' || coalesce(title_en, ''))), 'A') ||
    setweight(to_tsvector('simple', public.normalize_ar(coalesce(dek, '') || ' ' || coalesce(author_name, ''))), 'B') ||
    setweight(to_tsvector('simple', public.normalize_ar(left(body, 20000))), 'C')
  ) stored,
  constraint articles_scheduled_needs_date check (status not in ('scheduled', 'published') or published_at is not null)
);

create index if not exists articles_live_idx on public.articles (status, published_at desc);
create index if not exists articles_category_idx on public.articles (category_id, published_at desc);
create index if not exists articles_author_idx on public.articles (created_by);
create index if not exists articles_search_idx on public.articles using gin (search_vector);

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  title text not null check (char_length(title) between 1 and 200),
  title_en text check (title_en is null or char_length(title_en) <= 200),
  description text check (description is null or char_length(description) <= 1000),
  episode_id uuid references public.episodes (id) on delete set null,
  video_asset_id uuid references public.media_assets (id) on delete set null,
  thumbnail_id uuid references public.media_assets (id) on delete set null,
  youtube_video_id text check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  external_url text check (external_url is null or external_url ~ '^https://(www\.)?(tiktok\.com|instagram\.com|x\.com|youtube\.com)/'),
  orientation text not null default 'vertical' check (orientation in ('vertical', 'horizontal')),
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', public.normalize_ar(coalesce(title, '') || ' ' || coalesce(title_en, ''))), 'A') ||
    setweight(to_tsvector('simple', public.normalize_ar(coalesce(description, ''))), 'B')
  ) stored,
  constraint clips_has_source check (video_asset_id is not null or youtube_video_id is not null or external_url is not null)
);

create index if not exists clips_live_idx on public.clips (status, published_at desc);
create index if not exists clips_episode_idx on public.clips (episode_id);
create index if not exists clips_search_idx on public.clips using gin (search_vector);

-- ---------------------------------------------------------------------------
-- Audience: newsletter, inbox, progress, analytics
-- ---------------------------------------------------------------------------

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique check (char_length(email) <= 254),
  status public.subscriber_status not null default 'pending',
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  source text check (source is null or char_length(source) <= 60),
  confirm_token_hash text,
  unsubscribe_token_hash text not null,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscribers_status_idx on public.subscribers (status, created_at desc);
create index if not exists subscribers_confirm_idx on public.subscribers (confirm_token_hash) where confirm_token_hash is not null;
create index if not exists subscribers_unsubscribe_idx on public.subscribers (unsubscribe_token_hash);

create table if not exists public.sponsorship_requests (
  id uuid primary key default gen_random_uuid(),
  company text not null check (char_length(company) between 1 and 160),
  contact_name text not null check (char_length(contact_name) between 1 and 120),
  email extensions.citext not null check (char_length(email) <= 254),
  phone text check (phone is null or phone ~ '^[+0-9 ()-]{6,24}$'),
  website text check (website is null or website ~ '^https?://'),
  budget_range text check (budget_range is null or budget_range in ('under_25k', '25k_75k', '75k_200k', 'over_200k', 'undisclosed')),
  interests text[] not null default '{}',
  message text not null check (char_length(message) between 10 and 5000),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  status public.sponsorship_status not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsorship_status_idx on public.sponsorship_requests (status, created_at desc);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  kind public.message_kind not null default 'general',
  name text not null check (char_length(name) between 1 and 120),
  email extensions.citext not null check (char_length(email) <= 254),
  subject text check (subject is null or char_length(subject) <= 200),
  message text not null check (char_length(message) between 10 and 5000),
  position text check (position is null or char_length(position) <= 120),
  portfolio_url text check (portfolio_url is null or portfolio_url ~ '^https://'),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  status public.inbox_status not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);
create index if not exists contact_messages_kind_idx on public.contact_messages (kind, created_at desc);

create table if not exists public.listening_progress (
  id uuid primary key default gen_random_uuid(),
  listener_id uuid not null,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  position_seconds int not null default 0 check (position_seconds >= 0),
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (listener_id, episode_id)
);

create index if not exists listening_progress_episode_idx on public.listening_progress (episode_id);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in (
    'page_view', 'play_start', 'play_progress', 'play_complete', 'share', 'newsletter_signup', 'outbound_click')),
  path text check (path is null or char_length(path) <= 300),
  locale text check (locale is null or locale in ('ar', 'en')),
  episode_id uuid references public.episodes (id) on delete set null,
  article_id uuid references public.articles (id) on delete set null,
  clip_id uuid references public.clips (id) on delete set null,
  listener_id uuid,
  value numeric check (value is null or (value >= 0 and value <= 100000)),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  device text check (device is null or device in ('mobile', 'tablet', 'desktop', 'other')),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_type_created_idx on public.analytics_events (event_type, created_at desc);
create index if not exists analytics_events_episode_idx on public.analytics_events (episode_id, event_type) where episode_id is not null;

-- ---------------------------------------------------------------------------
-- Settings, audit log, rate limiting
-- ---------------------------------------------------------------------------

create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value, is_public) values
  ('general', jsonb_build_object(
    'site_name', 'وارد',
    'site_name_en', 'Wared',
    'tagline', 'كل شيء وارد.',
    'tagline_en', 'Anything is possible.',
    'contact_email', null,
    'announcement', null), true),
  ('platforms', jsonb_build_object(
    'spotify', null, 'apple_podcasts', null, 'youtube', null, 'anghami', null), true),
  ('social', jsonb_build_object(
    'x', null, 'instagram', null, 'tiktok', null, 'youtube', null, 'linkedin', null), true),
  ('brand', jsonb_build_object('display_font', 'plex'), true),
  ('notifications', jsonb_build_object('inbox_email', null), false)
on conflict (key) do nothing;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  action text not null check (char_length(action) <= 40),
  entity_type text not null check (char_length(entity_type) <= 60),
  entity_id text,
  summary text,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at and audit trail
-- ---------------------------------------------------------------------------

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  row_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  row_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  ref jsonb := coalesce(row_new, row_old);
  changed jsonb := null;
  label text;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('from', left(o.value::text, 200), 'to', left(n.value::text, 200)))
      into changed
    from jsonb_each(row_new) n
    join jsonb_each(row_old) o on o.key = n.key
    where n.value is distinct from o.value
      and n.key not in ('updated_at', 'search_vector', 'body', 'body_en', 'show_notes', 'show_notes_en',
                        'segments', 'plain_text', 'confirm_token_hash', 'unsubscribe_token_hash');
    if changed is null then
      return null;
    end if;
  end if;

  label := coalesce(ref ->> 'title', ref ->> 'name', ref ->> 'company', ref ->> 'email', ref ->> 'key', ref ->> 'path');

  insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, summary, changes)
  values (
    actor,
    (select p.email::text from public.profiles p where p.id = actor),
    lower(tg_op),
    tg_table_name,
    coalesce(ref ->> 'id', ref ->> 'key'),
    left(label, 200),
    changed
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['podcasts', 'episodes', 'guests', 'categories', 'articles', 'clips',
                           'subscribers', 'sponsorship_requests', 'contact_messages', 'site_settings', 'transcripts']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
                   t || '_updated_at', t);
  end loop;

  foreach t in array array['podcasts', 'episodes', 'episode_chapters', 'transcripts', 'guests', 'episode_guests',
                           'categories', 'articles', 'clips', 'media_assets', 'profiles', 'site_settings',
                           'sponsorship_requests', 'contact_messages', 'subscribers']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
                   t || '_audit', t);
  end loop;
end $$;
