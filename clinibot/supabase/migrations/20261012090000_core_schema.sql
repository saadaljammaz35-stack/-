-- CliniBot core schema.
--
-- Multi-tenant model: every tenant-owned row carries organization_id. Child rows
-- reference their parent with a composite (id, organization_id) foreign key, so
-- the database itself refuses a message, note or appointment that points at a
-- conversation, service or request belonging to a different clinic.
--
-- Secrets never live in tables clients can read: WhatsApp credentials sit in
-- integration_credentials (no client grants, no RLS policies) and are stored
-- encrypted by the Edge Functions with a key the database never sees.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ───────────────────────────── enums ─────────────────────────────

create type public.member_role as enum ('owner', 'admin', 'receptionist');
create type public.conversation_channel as enum ('web', 'whatsapp');
create type public.conversation_status as enum ('open', 'awaiting_human', 'closed');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_sender as enum ('customer', 'assistant', 'staff', 'system');
create type public.message_status as enum ('received', 'pending', 'sent', 'delivered', 'read', 'failed');
create type public.appointment_status as enum ('new', 'contacted', 'confirmed', 'cancelled', 'completed');
create type public.integration_status as enum ('disconnected', 'credentials_verified', 'connected', 'error');
create type public.subscription_plan as enum ('starter', 'growth', 'pro');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired');

-- ──────────────────────── shared trigger helpers ────────────────────────

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Working hours: {"sat":[["09:00","21:00"]], ..., "fri":[]}.
-- Keys are day codes, values are up to three [open, close] ranges with open < close.
create or replace function private.valid_working_hours(hours jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  day_key text;
  ranges jsonb;
  range_item jsonb;
begin
  if hours is null or jsonb_typeof(hours) <> 'object' then
    return false;
  end if;
  for day_key, ranges in select key, value from jsonb_each(hours) loop
    if day_key not in ('sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri') then
      return false;
    end if;
    if jsonb_typeof(ranges) <> 'array' or jsonb_array_length(ranges) > 3 then
      return false;
    end if;
    for range_item in select value from jsonb_array_elements(ranges) loop
      if jsonb_typeof(range_item) <> 'array' or jsonb_array_length(range_item) <> 2 then
        return false;
      end if;
      if (range_item ->> 0) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or (range_item ->> 1) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$'
         or (range_item ->> 0) >= (range_item ->> 1) then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

-- ───────────────────────────── plans ─────────────────────────────
-- Proposed prices, shown publicly. Payments are not enabled until a payment
-- provider is integrated and tested; see docs/BILLING.md.

create table public.plan_limits (
  plan public.subscription_plan primary key,
  name_ar text not null,
  name_en text not null,
  monthly_price_sar numeric(10, 2) not null check (monthly_price_sar >= 0),
  ai_replies_per_month integer not null check (ai_replies_per_month > 0),
  seats integer not null check (seats > 0),
  sort_order integer not null default 0
);

insert into public.plan_limits (plan, name_ar, name_en, monthly_price_sar, ai_replies_per_month, seats, sort_order) values
  ('starter', 'الأساسية', 'Starter', 299, 1000, 3, 1),
  ('growth', 'النمو', 'Growth', 699, 5000, 6, 2),
  ('pro', 'الاحترافية', 'Pro', 1499, 15000, 15, 3);

-- ─────────────────────────── organizations ───────────────────────────

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  city text check (city is null or char_length(city) <= 80),
  phone text check (phone is null or phone ~ '^\+?[1-9][0-9]{7,14}$'),
  default_language text not null default 'ar' check (default_language in ('ar', 'en')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_created_by_idx on public.organizations (created_by);

create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'receptionist',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);

create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function private.set_updated_at();

-- ─────────────────────────── clinic settings ───────────────────────────

create table public.clinic_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  display_name_ar text check (display_name_ar is null or char_length(display_name_ar) <= 120),
  display_name_en text check (display_name_en is null or char_length(display_name_en) <= 120),
  address_ar text check (address_ar is null or char_length(address_ar) <= 300),
  address_en text check (address_en is null or char_length(address_en) <= 300),
  maps_url text check (maps_url is null or (maps_url ~ '^https://' and char_length(maps_url) <= 500)),
  reception_phone text check (reception_phone is null or reception_phone ~ '^\+?[1-9][0-9]{7,14}$'),
  timezone text not null default 'Asia/Riyadh',
  working_hours jsonb not null default '{"sat":[["09:00","21:00"]],"sun":[["09:00","21:00"]],"mon":[["09:00","21:00"]],"tue":[["09:00","21:00"]],"wed":[["09:00","21:00"]],"thu":[["09:00","21:00"]],"fri":[]}'::jsonb
    check (private.valid_working_hours(working_hours)),
  working_hours_note_ar text check (working_hours_note_ar is null or char_length(working_hours_note_ar) <= 300),
  working_hours_note_en text check (working_hours_note_en is null or char_length(working_hours_note_en) <= 300),
  assistant_enabled boolean not null default false,
  public_chat_enabled boolean not null default false,
  assistant_name text not null default 'CliniBot' check (char_length(btrim(assistant_name)) between 1 and 40),
  assistant_tone text not null default 'friendly' check (assistant_tone in ('friendly', 'formal')),
  welcome_message_ar text check (welcome_message_ar is null or char_length(welcome_message_ar) <= 500),
  welcome_message_en text check (welcome_message_en is null or char_length(welcome_message_en) <= 500),
  extra_instructions text check (extra_instructions is null or char_length(extra_instructions) <= 2000),
  emergency_number text not null default '997' check (emergency_number ~ '^[0-9]{3,15}$'),
  privacy_notice_ar text check (privacy_notice_ar is null or char_length(privacy_notice_ar) <= 1000),
  privacy_notice_en text check (privacy_notice_en is null or char_length(privacy_notice_en) <= 1000),
  message_retention_days integer not null default 180 check (message_retention_days between 7 and 1825),
  appointment_retention_days integer not null default 365 check (appointment_retention_days between 30 and 3650),
  -- Written only by the server after a real call to the AI API succeeds.
  ai_last_test_at timestamptz,
  ai_last_test_ok boolean,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clinic_settings_updated_at before update on public.clinic_settings
  for each row execute function private.set_updated_at();

-- ─────────────────────────── knowledge base ───────────────────────────

create table public.clinic_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name_ar text check (name_ar is null or char_length(btrim(name_ar)) between 1 and 120),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 1 and 120),
  description_ar text check (description_ar is null or char_length(description_ar) <= 1000),
  description_en text check (description_en is null or char_length(description_en) <= 1000),
  price_type text not null default 'fixed' check (price_type in ('fixed', 'starting_from', 'on_consultation')),
  price_sar numeric(10, 2) check (price_sar is null or price_sar between 0 and 1000000),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 600),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint clinic_services_has_name check (name_ar is not null or name_en is not null),
  constraint clinic_services_price_matches_type check (
    (price_type = 'on_consultation' and price_sar is null)
    or (price_type in ('fixed', 'starting_from') and price_sar is not null)
  )
);

create index clinic_services_org_idx on public.clinic_services (organization_id, sort_order);

create trigger clinic_services_updated_at before update on public.clinic_services
  for each row execute function private.set_updated_at();

create table public.approved_faqs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  question_ar text check (question_ar is null or char_length(btrim(question_ar)) between 3 and 300),
  answer_ar text check (answer_ar is null or char_length(btrim(answer_ar)) between 1 and 2000),
  question_en text check (question_en is null or char_length(btrim(question_en)) between 3 and 300),
  answer_en text check (answer_en is null or char_length(btrim(answer_en)) between 1 and 2000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_faqs_complete_pair check (
    (question_ar is not null and answer_ar is not null)
    or (question_en is not null and answer_en is not null)
  )
);

create index approved_faqs_org_idx on public.approved_faqs (organization_id, sort_order);

create trigger approved_faqs_updated_at before update on public.approved_faqs
  for each row execute function private.set_updated_at();

-- ─────────────────────────── conversations ───────────────────────────

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  channel public.conversation_channel not null,
  status public.conversation_status not null default 'open',
  customer_name text check (customer_name is null or char_length(customer_name) <= 120),
  -- WhatsApp ID (the customer's number, digits only). Needed to reply.
  customer_wa_id text check (customer_wa_id is null or customer_wa_id ~ '^[0-9]{6,20}$'),
  -- SHA-256 of the web chat session token. The token itself is never stored.
  web_session_hash text check (web_session_hash is null or web_session_hash ~ '^[0-9a-f]{64}$'),
  language text check (language is null or language in ('ar', 'en')),
  ai_paused boolean not null default false,
  handoff_reason text check (handoff_reason is null or char_length(handoff_reason) <= 500),
  assigned_to uuid references auth.users (id) on delete set null,
  consent_at timestamptz,
  privacy_notice_sent_at timestamptz,
  opted_out_at timestamptz,
  last_message_at timestamptz,
  last_message_direction public.message_direction,
  first_inbound_at timestamptz,
  last_inbound_at timestamptz,
  first_response_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint conversations_channel_identity check (
    (channel = 'whatsapp' and customer_wa_id is not null and web_session_hash is null)
    or (channel = 'web' and web_session_hash is not null and customer_wa_id is null)
  )
);

create unique index conversations_wa_unique
  on public.conversations (organization_id, customer_wa_id) where customer_wa_id is not null;
create unique index conversations_web_session_unique
  on public.conversations (web_session_hash) where web_session_hash is not null;
create index conversations_org_recent_idx on public.conversations (organization_id, last_message_at desc nulls last);
create index conversations_org_status_idx on public.conversations (organization_id, status);
create index conversations_org_created_idx on public.conversations (organization_id, created_at);
create index conversations_assigned_idx on public.conversations (assigned_to);

create trigger conversations_updated_at before update on public.conversations
  for each row execute function private.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  conversation_id uuid not null,
  direction public.message_direction not null,
  sender public.message_sender not null,
  body text not null check (char_length(body) between 1 and 4096),
  staff_user_id uuid references auth.users (id) on delete set null,
  wa_message_id text unique check (wa_message_id is null or char_length(wa_message_id) <= 256),
  status public.message_status not null,
  error_code text check (error_code is null or char_length(error_code) <= 64),
  error_detail text check (error_detail is null or char_length(error_detail) <= 1000),
  ai_model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete cascade,
  constraint messages_sender_direction check (
    (direction = 'inbound' and sender = 'customer')
    or (direction = 'outbound' and sender in ('assistant', 'staff', 'system'))
  )
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_org_created_idx on public.messages (organization_id, created_at);
create index messages_staff_user_idx on public.messages (staff_user_id);

create trigger messages_updated_at before update on public.messages
  for each row execute function private.set_updated_at();

-- Keep the conversation's bookkeeping in step with its messages. Response time
-- is measured from the first customer message to the first assistant or staff
-- reply; system notices (privacy notice, emergency guidance) do not count.
create or replace function private.on_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations c
     set last_message_at = new.created_at,
         last_message_direction = new.direction,
         last_inbound_at = case when new.direction = 'inbound' then new.created_at else c.last_inbound_at end,
         first_inbound_at = case
           when new.direction = 'inbound' then coalesce(c.first_inbound_at, new.created_at)
           else c.first_inbound_at end,
         first_response_at = case
           when new.direction = 'outbound' and new.sender in ('assistant', 'staff')
                and c.first_response_at is null and c.first_inbound_at is not null
             then new.created_at
           else c.first_response_at end,
         status = case
           when new.direction = 'inbound' and c.status = 'closed' then 'open'::public.conversation_status
           else c.status end
   where c.id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function private.on_message_inserted();

-- ───────────────────────── appointment requests ─────────────────────────

create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid,
  service_id uuid,
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 120),
  customer_phone text not null check (customer_phone ~ '^\+?[1-9][0-9]{7,14}$'),
  preferred_date date,
  preferred_time_window text not null default 'any'
    check (preferred_time_window in ('morning', 'afternoon', 'evening', 'any')),
  customer_notes text check (customer_notes is null or char_length(customer_notes) <= 1000),
  source text not null default 'dashboard' check (source in ('web_chat', 'whatsapp', 'dashboard')),
  status public.appointment_status not null default 'new',
  assigned_to uuid references auth.users (id) on delete set null,
  -- The time the clinic actually agreed with the customer. Required to confirm.
  scheduled_for timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  completed_at timestamptz,
  -- Set by the server only after a confirmation message was actually delivered to the channel.
  customer_notified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete set null (conversation_id),
  foreign key (service_id, organization_id)
    references public.clinic_services (id, organization_id) on delete set null (service_id),
  constraint appointment_requests_scheduled_when_confirmed check (
    status not in ('confirmed', 'completed') or scheduled_for is not null
  )
);

create index appointment_requests_org_status_idx on public.appointment_requests (organization_id, status, created_at desc);
create index appointment_requests_org_created_idx on public.appointment_requests (organization_id, created_at);
create index appointment_requests_conversation_idx on public.appointment_requests (conversation_id);
create index appointment_requests_service_idx on public.appointment_requests (service_id);
create index appointment_requests_assigned_idx on public.appointment_requests (assigned_to);

create trigger appointment_requests_updated_at before update on public.appointment_requests
  for each row execute function private.set_updated_at();

create table public.appointment_request_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  appointment_request_id uuid not null,
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (appointment_request_id, organization_id)
    references public.appointment_requests (id, organization_id) on delete cascade
);

create index appointment_request_notes_request_idx on public.appointment_request_notes (appointment_request_id, created_at);
create index appointment_request_notes_org_idx on public.appointment_request_notes (organization_id);
create index appointment_request_notes_author_idx on public.appointment_request_notes (author_id);

-- ─────────────────────────── integrations ───────────────────────────

create table public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'whatsapp' check (provider in ('whatsapp')),
  status public.integration_status not null default 'disconnected',
  phone_number_id text unique check (phone_number_id is null or phone_number_id ~ '^[0-9]{5,32}$'),
  waba_id text check (waba_id is null or waba_id ~ '^[0-9]{5,32}$'),
  display_phone_number text check (display_phone_number is null or char_length(display_phone_number) <= 32),
  verified_name text check (verified_name is null or char_length(verified_name) <= 200),
  -- Path segment of this clinic's webhook URL. Unguessable, not a secret by itself:
  -- every POST must also carry a valid Meta signature.
  webhook_key text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  credentials_verified_at timestamptz,
  webhook_verified_at timestamptz,
  last_inbound_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  last_error_at timestamptz,
  confirmation_template_name text
    check (confirmation_template_name is null or confirmation_template_name ~ '^[a-z0-9_]{1,512}$'),
  confirmation_template_language text not null default 'ar'
    check (confirmation_template_language ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create trigger integration_settings_updated_at before update on public.integration_settings
  for each row execute function private.set_updated_at();

-- Service-role only. Ciphertexts are AES-256-GCM, produced and read by the Edge
-- Functions with CREDENTIALS_ENCRYPTION_KEY, which the database never holds.
create table public.integration_credentials (
  integration_id uuid primary key references public.integration_settings (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  access_token_ciphertext text not null,
  app_secret_ciphertext text,
  verify_token_hash text check (verify_token_hash is null or verify_token_hash ~ '^[0-9a-f]{64}$'),
  key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create index integration_credentials_org_idx on public.integration_credentials (organization_id);

create trigger integration_credentials_updated_at before update on public.integration_credentials
  for each row execute function private.set_updated_at();

-- ─────────────────────── subscriptions and usage ───────────────────────

create table public.subscription_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan public.subscription_plan not null references public.plan_limits (plan),
  status public.subscription_status not null,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  -- Filled once a payment provider is integrated. Never card data.
  provider text check (provider is null or char_length(provider) <= 40),
  provider_customer_ref text check (provider_customer_ref is null or char_length(provider_customer_ref) <= 200),
  provider_subscription_ref text check (provider_subscription_ref is null or char_length(provider_subscription_ref) <= 200),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_records_trial_has_end check (status <> 'trialing' or trial_ends_at is not null)
);

create index subscription_records_org_idx on public.subscription_records (organization_id, created_at desc);
create unique index subscription_records_one_current
  on public.subscription_records (organization_id) where status in ('trialing', 'active', 'past_due');

create trigger subscription_records_updated_at before update on public.subscription_records
  for each row execute function private.set_updated_at();

create table public.ai_usage_monthly (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  replies integer not null default 0,
  test_replies integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, month)
);

-- ─────────────────────────── audit and ops ───────────────────────────

-- organization_id deliberately has no foreign key: the record of a clinic's
-- deletion must outlive the clinic.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid,
  actor_user_id uuid,
  actor_type text not null check (actor_type in ('user', 'system', 'assistant', 'webhook')),
  action text not null check (char_length(action) <= 100),
  entity_type text check (entity_type is null or char_length(entity_type) <= 64),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at);

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_name text not null check (char_length(btrim(clinic_name)) between 2 and 120),
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 120),
  phone text not null check (phone ~ '^\+?[1-9][0-9]{7,14}$'),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  city text check (city is null or char_length(city) <= 80),
  clinic_type text check (clinic_type is null or clinic_type in ('dental', 'dermatology', 'general', 'cosmetic', 'physio', 'other')),
  message text check (message is null or char_length(message) <= 2000),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  consent_at timestamptz not null,
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create index demo_requests_created_idx on public.demo_requests (created_at);

create table private.rate_limits (
  key text primary key check (char_length(key) <= 200),
  window_started_at timestamptz not null,
  hits integer not null
);
