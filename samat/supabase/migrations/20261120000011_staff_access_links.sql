-- SAMAT | سماط — one-time staff access links.
-- Lets a staff member set (or reset) a password from a single-use link that an owner/admin shares
-- with them (e.g. on WhatsApp), so the panel works even before e-mail delivery is configured.
-- Only the SHA-256 of each token is stored. Server (service role) access only.

create table public.staff_access_links (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null default 'setup' check (purpose in ('setup', 'reset')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '72 hours',
  used_at timestamptz
);
create index staff_access_links_email on public.staff_access_links (email, created_at desc);
alter table public.staff_access_links enable row level security;
revoke all on public.staff_access_links from anon, authenticated;
grant all on public.staff_access_links to service_role;

-- The auth user id for an e-mail (server only).
create or replace function public.auth_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1
$$;

-- Uses a link exactly once: returns its e-mail the first time, NULL afterwards or when expired.
create or replace function public.consume_staff_access_link(p_token_hash text) returns text
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  update public.staff_access_links set used_at = now()
   where token_hash = p_token_hash and used_at is null and expires_at > now()
  returning email::text into v_email;
  return v_email;
end $$;

-- Puts a link back if the password could not be saved (so the person can try again).
create or replace function public.restore_staff_access_link(p_token_hash text) returns void
language sql security definer set search_path = public as $$
  update public.staff_access_links set used_at = null where token_hash = p_token_hash and expires_at > now()
$$;

revoke execute on function public.auth_user_id_by_email(text), public.consume_staff_access_link(text), public.restore_staff_access_link(text)
  from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text), public.consume_staff_access_link(text), public.restore_staff_access_link(text)
  to service_role;
