-- CliniBot database functions.
--
-- Two kinds:
--   * Called by signed-in staff (authenticated): each checks the caller's
--     membership and role itself, because SECURITY DEFINER bypasses RLS.
--   * Called only by the Edge Functions (service_role): ingest, rate limiting,
--     usage accounting, audit writes, retention. Not executable by anyone else.

-- ───────────────────────── clinic accounts ─────────────────────────

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_city text default null,
  p_phone text default null,
  p_language text default 'ar'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_slug text := lower(btrim(p_slug));
  v_name text := btrim(p_name);
  v_language text := coalesce(nullif(p_language, ''), 'ar');
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_language not in ('ar', 'en') then
    raise exception 'invalid language' using errcode = '22023';
  end if;
  -- Abuse protection: one person cannot spin up unlimited trial clinics.
  if (select count(*) from public.organizations where created_by = v_user) >= 3 then
    raise exception 'clinic limit reached for this account' using errcode = '23514', hint = 'org_limit';
  end if;
  if exists (select 1 from public.organizations where slug = v_slug) then
    raise exception 'this clinic link is already taken' using errcode = '23505', hint = 'slug_taken';
  end if;

  insert into public.organizations (name, slug, city, phone, default_language, created_by)
  values (v_name, v_slug, nullif(btrim(p_city), ''), nullif(btrim(p_phone), ''), v_language, v_user)
  returning id into v_org;

  insert into public.subscription_records (organization_id, plan, status, trial_ends_at, notes)
  values (v_org, 'starter', 'trialing', now() + interval '14 days', 'Free trial started at signup');

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'owner');

  insert into public.clinic_settings (organization_id, display_name_ar, display_name_en)
  values (
    v_org,
    case when v_language = 'ar' then v_name end,
    case when v_language = 'en' then v_name end
  );

  insert into public.audit_logs (organization_id, actor_user_id, actor_type, action, entity_type, entity_id)
  values (v_org, v_user, 'user', 'organizations.create', 'organizations', v_org);

  return v_org;
end;
$$;

create or replace function public.list_org_members(p_org uuid)
returns table (
  member_id uuid,
  user_id uuid,
  role public.member_role,
  email text,
  full_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_org_member(p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, m.role, u.email::text, (u.raw_user_meta_data ->> 'full_name')::text, m.created_at
      from public.organization_members m
      join auth.users u on u.id = m.user_id
     where m.organization_id = p_org
     order by m.created_at;
end;
$$;

-- Only owners change roles. The keep_an_owner trigger stops the last owner
-- from being demoted.
create or replace function public.update_member_role(p_member_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.organization_members where id = p_member_id;
  -- Same error for "no such member" and "not allowed": no existence oracle.
  if v_org is null or not private.has_org_role(v_org, '{owner}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.organization_members set role = p_role where id = p_member_id;
end;
$$;

-- Owners remove anyone (but never the last owner); admins remove
-- receptionists; anyone may leave.
create or replace function public.remove_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.organization_members;
  v_actor_role public.member_role;
begin
  select * into v_target from public.organization_members where id = p_member_id;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select role into v_actor_role
    from public.organization_members
   where organization_id = v_target.organization_id and user_id = (select auth.uid());

  if not (
    v_target.user_id = (select auth.uid())
    or v_actor_role = 'owner'
    or (v_actor_role = 'admin' and v_target.role = 'receptionist')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.organization_members where id = p_member_id;
end;
$$;

-- Permanently deletes a clinic and every record it owns (conversations,
-- messages, appointment requests, knowledge, credentials). Owner only, and the
-- caller must type the clinic's link to confirm.
create or replace function public.delete_organization(p_org uuid, p_confirm_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  if not private.has_org_role(p_org, '{owner}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select slug into v_slug from public.organizations where id = p_org;
  if v_slug is distinct from lower(btrim(p_confirm_slug)) then
    raise exception 'confirmation does not match the clinic link' using errcode = '22023', hint = 'confirm_mismatch';
  end if;
  perform set_config('clinibot.org_deleting', p_org::text, true);
  delete from public.organizations where id = p_org;
end;
$$;

-- ───────────────────────── entitlements ─────────────────────────
-- The only source of truth for what a clinic may use. Computed from
-- subscription_records, which the browser cannot write.

create or replace function public.org_entitlements(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub public.subscription_records;
  v_limits public.plan_limits;
  v_month date := date_trunc('month', now() at time zone 'Asia/Riyadh')::date;
  v_used integer;
  v_seats_used integer;
  v_active boolean := false;
  v_ai_limit integer := 0;
begin
  if coalesce((select auth.role()), '') <> 'service_role' and not private.is_org_member(p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_sub
    from public.subscription_records
   where organization_id = p_org
   order by created_at desc
   limit 1;

  if found then
    select * into v_limits from public.plan_limits where plan = v_sub.plan;
    v_active :=
      (v_sub.status = 'trialing' and v_sub.trial_ends_at > now())
      or (v_sub.status in ('active', 'past_due')
          and (v_sub.current_period_end is null or v_sub.current_period_end > now()));
    -- Trials get a capped allowance so a trial cannot run up large AI costs.
    v_ai_limit := case
      when v_sub.status = 'trialing' then least(v_limits.ai_replies_per_month, 300)
      else v_limits.ai_replies_per_month end;
  end if;

  select u.replies + u.test_replies into v_used
    from public.ai_usage_monthly u
   where u.organization_id = p_org and u.month = v_month;
  v_used := coalesce(v_used, 0);

  select count(*) into v_seats_used from public.organization_members where organization_id = p_org;

  return jsonb_build_object(
    'plan', v_sub.plan,
    'status', v_sub.status,
    'is_active', v_active,
    'trial_ends_at', v_sub.trial_ends_at,
    'current_period_end', v_sub.current_period_end,
    'ai_replies_limit', v_ai_limit,
    'ai_replies_used', v_used,
    'ai_replies_remaining', greatest(v_ai_limit - v_used, 0),
    'seats_limit', v_limits.seats,
    'seats_used', v_seats_used
  );
end;
$$;

-- ───────────────────────── dashboard ─────────────────────────
-- SECURITY INVOKER: every count below runs under the caller's RLS, so a
-- clinic can only ever count its own rows.

create or replace function public.dashboard_metrics(p_org uuid, p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_result jsonb;
begin
  if not private.is_org_member(p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'since', v_since,
    'total_conversations', (
      select count(*) from public.conversations c
       where c.organization_id = p_org and c.created_at >= v_since),
    'active_conversations', (
      select count(*) from public.conversations c
       where c.organization_id = p_org and c.last_message_at >= v_since),
    'unanswered_conversations', (
      select count(*) from public.conversations c
       where c.organization_id = p_org
         and c.status <> 'closed'
         and (c.status = 'awaiting_human' or c.last_message_direction = 'inbound')),
    'awaiting_human', (
      select count(*) from public.conversations c
       where c.organization_id = p_org and c.status = 'awaiting_human'),
    'appointment_requests', (
      select count(*) from public.appointment_requests a
       where a.organization_id = p_org and a.created_at >= v_since),
    'new_appointment_requests', (
      select count(*) from public.appointment_requests a
       where a.organization_id = p_org and a.status = 'new'),
    'confirmed_appointments', (
      select count(*) from public.appointment_requests a
       where a.organization_id = p_org
         and a.status in ('confirmed', 'completed')
         and a.confirmed_at >= v_since),
    'avg_first_response_seconds', (
      select round(avg(extract(epoch from (c.first_response_at - c.first_inbound_at))))::integer
        from public.conversations c
       where c.organization_id = p_org
         and c.first_inbound_at >= v_since
         and c.first_response_at is not null),
    'median_first_response_seconds', (
      select round(percentile_cont(0.5) within group (
               order by extract(epoch from (c.first_response_at - c.first_inbound_at)))::numeric)::integer
        from public.conversations c
       where c.organization_id = p_org
         and c.first_inbound_at >= v_since
         and c.first_response_at is not null),
    'responded_conversations', (
      select count(*) from public.conversations c
       where c.organization_id = p_org
         and c.first_inbound_at >= v_since
         and c.first_response_at is not null),
    'conversations_by_channel', (
      select coalesce(jsonb_object_agg(t.channel, t.n), '{}'::jsonb)
        from (select c.channel, count(*) as n
                from public.conversations c
               where c.organization_id = p_org and c.created_at >= v_since
               group by c.channel) t),
    'messages_by_sender', (
      select coalesce(jsonb_object_agg(t.sender, t.n), '{}'::jsonb)
        from (select m.sender, count(*) as n
                from public.messages m
               where m.organization_id = p_org and m.created_at >= v_since
               group by m.sender) t),
    'daily_conversations', (
      select coalesce(jsonb_agg(jsonb_build_object('day', t.day, 'count', t.n) order by t.day), '[]'::jsonb)
        from (select (c.created_at at time zone 'Asia/Riyadh')::date as day, count(*) as n
                from public.conversations c
               where c.organization_id = p_org and c.created_at >= v_since
               group by 1) t)
  ) into v_result;

  return v_result;
end;
$$;

-- ───────────────────────── service-role only ─────────────────────────

-- Fixed-window rate limiter. Returns true while the caller is under the limit.
create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into private.rate_limits as r (key, window_started_at, hits)
  values (left(p_key, 200), now(), 1)
  on conflict (key) do update
    set hits = case
          when r.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
          else r.hits + 1 end,
        window_started_at = case
          when r.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
          else r.window_started_at end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- Stores one inbound WhatsApp message exactly once. Meta retries deliveries,
-- so the same wa_message_id may arrive many times; only the first is stored.
create or replace function public.ingest_whatsapp_inbound(
  p_org uuid,
  p_wa_id text,
  p_customer_name text,
  p_wa_message_id text,
  p_body text,
  p_received_at timestamptz default null
)
returns table (
  conversation_id uuid,
  message_id uuid,
  is_duplicate boolean,
  conversation_status public.conversation_status,
  ai_paused boolean,
  opted_out boolean,
  privacy_notice_sent boolean,
  language text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_msg uuid;
begin
  if exists (select 1 from public.messages m where m.wa_message_id = p_wa_message_id) then
    return query select null::uuid, null::uuid, true, null::public.conversation_status,
                        null::boolean, null::boolean, null::boolean, null::text;
    return;
  end if;

  insert into public.conversations as c (organization_id, channel, customer_wa_id, customer_name)
  values (p_org, 'whatsapp', p_wa_id, nullif(left(btrim(coalesce(p_customer_name, '')), 120), ''))
  on conflict (organization_id, customer_wa_id) where customer_wa_id is not null
  do update set customer_name = coalesce(excluded.customer_name, c.customer_name)
  returning * into v_conv;

  insert into public.messages (organization_id, conversation_id, direction, sender, body, wa_message_id, status, created_at)
  values (p_org, v_conv.id, 'inbound', 'customer', left(p_body, 4096), p_wa_message_id, 'received',
          least(coalesce(p_received_at, now()), now()))
  on conflict (wa_message_id) do nothing
  returning id into v_msg;

  if v_msg is null then
    return query select v_conv.id, null::uuid, true, null::public.conversation_status,
                        null::boolean, null::boolean, null::boolean, null::text;
    return;
  end if;

  update public.integration_settings
     set last_inbound_at = now()
   where organization_id = p_org and provider = 'whatsapp';

  select * into v_conv from public.conversations c where c.id = v_conv.id;

  return query select v_conv.id, v_msg, false, v_conv.status, v_conv.ai_paused,
                      v_conv.opted_out_at is not null, v_conv.privacy_notice_sent_at is not null,
                      v_conv.language;
end;
$$;

-- Delivery receipts only move forward (sent -> delivered -> read). A failure
-- is recorded only for a message not yet delivered.
create or replace function public.apply_whatsapp_status(
  p_wa_message_id text,
  p_status public.message_status,
  p_error_code text default null,
  p_error_detail text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_status not in ('sent', 'delivered', 'read', 'failed') then
    raise exception 'unsupported status' using errcode = '22023';
  end if;

  update public.messages m
     set status = p_status,
         error_code = case when p_status = 'failed' then left(p_error_code, 64) else m.error_code end,
         error_detail = case when p_status = 'failed' then left(p_error_detail, 1000) else m.error_detail end
   where m.wa_message_id = p_wa_message_id
     and m.direction = 'outbound'
     and (
       (p_status = 'failed' and m.status in ('pending', 'sent'))
       or (p_status <> 'failed' and m.status <> 'failed'
           and array_position(array['pending', 'sent', 'delivered', 'read']::public.message_status[], p_status)
             > array_position(array['pending', 'sent', 'delivered', 'read']::public.message_status[], m.status))
     );
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.record_ai_usage(
  p_org uuid,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_is_test boolean default false
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_usage_monthly as u (organization_id, month, replies, test_replies, input_tokens, output_tokens)
  values (
    p_org,
    date_trunc('month', now() at time zone 'Asia/Riyadh')::date,
    case when p_is_test then 0 else 1 end,
    case when p_is_test then 1 else 0 end,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0)
  )
  on conflict (organization_id, month) do update
    set replies = u.replies + excluded.replies,
        test_replies = u.test_replies + excluded.test_replies,
        input_tokens = u.input_tokens + excluded.input_tokens,
        output_tokens = u.output_tokens + excluded.output_tokens,
        updated_at = now();
$$;

create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;

create or replace function public.write_audit(
  p_org uuid,
  p_actor uuid,
  p_actor_type text,
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (organization_id, actor_user_id, actor_type, action, entity_type, entity_id, details)
  values (p_org, p_actor, p_actor_type, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Applies every clinic's retention settings. Scheduled daily (see the cron
-- migration); safe to run by hand.
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_messages integer;
  v_conversations integer;
  v_appointments integer;
  v_demo integer;
  v_audit integer;
  v_rate integer;
  v_result jsonb;
begin
  delete from public.messages m
   using public.clinic_settings s
   where s.organization_id = m.organization_id
     and m.created_at < now() - make_interval(days => s.message_retention_days);
  get diagnostics v_messages = row_count;

  delete from public.conversations c
   using public.clinic_settings s
   where s.organization_id = c.organization_id
     and coalesce(c.last_message_at, c.created_at) < now() - make_interval(days => s.message_retention_days);
  get diagnostics v_conversations = row_count;

  delete from public.appointment_requests a
   using public.clinic_settings s
   where s.organization_id = a.organization_id
     and greatest(a.created_at, coalesce(a.scheduled_for, a.created_at))
         < now() - make_interval(days => s.appointment_retention_days);
  get diagnostics v_appointments = row_count;

  delete from public.demo_requests where created_at < now() - interval '365 days';
  get diagnostics v_demo = row_count;

  perform set_config('clinibot.audit_purge', 'on', true);
  delete from public.audit_logs where created_at < now() - interval '730 days';
  get diagnostics v_audit = row_count;
  perform set_config('clinibot.audit_purge', 'off', true);

  delete from private.rate_limits where window_started_at < now() - interval '1 day';
  get diagnostics v_rate = row_count;

  v_result := jsonb_build_object(
    'messages', v_messages,
    'conversations', v_conversations,
    'appointment_requests', v_appointments,
    'demo_requests', v_demo,
    'audit_logs', v_audit,
    'rate_limits', v_rate
  );

  insert into public.audit_logs (organization_id, actor_type, action, details)
  values (null, 'system', 'retention.purge', v_result);

  return v_result;
end;
$$;

-- ───────────────────────── function privileges ─────────────────────────
-- Supabase makes new functions executable by anon and authenticated by
-- default. Close everything, then open exactly what each caller needs.

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function public.create_organization(text, text, text, text, text) to authenticated;
grant execute on function public.list_org_members(uuid) to authenticated;
grant execute on function public.update_member_role(uuid, public.member_role) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.delete_organization(uuid, text) to authenticated;
grant execute on function public.org_entitlements(uuid) to authenticated;
grant execute on function public.dashboard_metrics(uuid, integer) to authenticated;

-- Used inside RLS policies and CHECK constraints evaluated as the caller.
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, public.member_role[]) to authenticated;
grant execute on function private.is_user_member(uuid, uuid) to authenticated;
grant execute on function private.valid_working_hours(jsonb) to authenticated;

grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;
