-- SAMAT | سماط — customer sign-in by SMS code, handled by the app itself.
-- The app sends the code through its own SMS provider (Unifonic / Taqnyat / Twilio, or WhatsApp),
-- so phone sign-in needs no extra Supabase Auth settings. Only a hash of the code is stored.
-- Server (service role) access only.

create table public.phone_otps (
  phone text primary key check (phone ~ '^\+9665[0-9]{8}$'),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  attempts int not null default 0 check (attempts >= 0),
  sends_in_window int not null default 1 check (sends_in_window >= 0),
  window_started_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now()
);
alter table public.phone_otps enable row level security;
revoke all on public.phone_otps from anon, authenticated;
grant all on public.phone_otps to service_role;

-- The auth user for a phone (auth stores it without the leading +).
create or replace function public.auth_user_by_phone(p_phone text) returns table (id uuid, email text)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text from auth.users u where u.phone = regexp_replace(p_phone, '^\+', '') limit 1
$$;

-- Counts one wrong attempt atomically and returns the new total.
create or replace function public.phone_otp_fail(p_phone text) returns int
language sql security definer set search_path = public as $$
  update public.phone_otps set attempts = attempts + 1 where phone = p_phone returning attempts
$$;

revoke execute on function public.auth_user_by_phone(text), public.phone_otp_fail(text) from public, anon, authenticated;
grant execute on function public.auth_user_by_phone(text), public.phone_otp_fail(text) to service_role;
