-- CliniBot security layer: tenant isolation (RLS), column-level privileges,
-- integrity triggers and the audit trail.
--
-- The rule: the browser holds an anon key and a user JWT, nothing else. Every
-- table is closed by default (RLS on, privileges revoked) and opened only as far
-- as each role needs. Writes the browser must never make (messages, credentials,
-- subscriptions, server-verified flags) are not granted at all; the Edge
-- Functions make them with the service role after their own checks.

-- ───────────────────────── membership helpers ─────────────────────────
-- SECURITY DEFINER so policies on organization_members do not recurse.

create or replace function private.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
     where m.organization_id = p_org
       and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_org_role(p_org uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
     where m.organization_id = p_org
       and m.user_id = (select auth.uid())
       and m.role = any (p_roles)
  );
$$;

create or replace function private.is_user_member(p_org uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
     where m.organization_id = p_org and m.user_id = p_user
  );
$$;

revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.has_org_role(uuid, public.member_role[]) from public;
revoke all on function private.is_user_member(uuid, uuid) from public;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;
grant execute on function private.has_org_role(uuid, public.member_role[]) to authenticated, service_role;
grant execute on function private.is_user_member(uuid, uuid) to authenticated, service_role;

-- ───────────────────────── integrity triggers ─────────────────────────

-- Staff can only assign work to people who belong to the same clinic.
create or replace function private.check_assignee()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and not private.is_user_member(new.organization_id, new.assigned_to) then
    raise exception 'assignee is not a member of this clinic' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger conversations_check_assignee before insert or update on public.conversations
  for each row execute function private.check_assignee();
create trigger appointment_requests_check_assignee before insert or update on public.appointment_requests
  for each row execute function private.check_assignee();

-- Appointment workflow. Allowed transitions:
--   new        -> contacted | confirmed | cancelled
--   contacted  -> confirmed | cancelled
--   confirmed  -> completed | cancelled
--   cancelled, completed: terminal
create or replace function private.appointment_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'new' then
      raise exception 'appointment requests start as new' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'new' and new.status in ('contacted', 'confirmed', 'cancelled'))
      or (old.status = 'contacted' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'invalid appointment status change: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    if new.status = 'confirmed' then
      new.confirmed_at := now();
      new.confirmed_by := (select auth.uid());
    elsif new.status = 'cancelled' then
      new.cancelled_at := now();
    elsif new.status = 'completed' then
      new.completed_at := now();
    end if;
  elsif old.status in ('cancelled', 'completed')
        and (new.scheduled_for is distinct from old.scheduled_for
             or new.service_id is distinct from old.service_id
             or new.customer_phone is distinct from old.customer_phone) then
    raise exception 'closed appointment requests cannot be changed' using errcode = '23514';
  end if;

  -- A changed time invalidates the confirmation the customer was sent.
  if new.scheduled_for is distinct from old.scheduled_for then
    new.customer_notified_at := null;
  end if;

  return new;
end;
$$;

create trigger appointment_requests_transition before insert or update on public.appointment_requests
  for each row execute function private.appointment_transition();

-- The assistant may only be switched on after a real, successful test call to
-- the AI API within the last 30 days. The test result is written by the server.
create or replace function private.guard_assistant_enable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assistant_enabled and not old.assistant_enabled then
    if new.ai_last_test_ok is not true
       or new.ai_last_test_at is null
       or new.ai_last_test_at < now() - interval '30 days' then
      raise exception 'test the assistant successfully before enabling it'
        using errcode = '23514', hint = 'assistant_not_tested';
    end if;
  end if;
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create trigger clinic_settings_guard_enable before update on public.clinic_settings
  for each row execute function private.guard_assistant_enable();

-- Seat limit, enforced in the database as well as in the invite function.
create or replace function private.enforce_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seats integer;
  v_used integer;
begin
  -- Serialise concurrent invites to the same clinic so the count is exact.
  perform 1 from public.organizations where id = new.organization_id for update;

  select pl.seats into v_seats
    from public.subscription_records s
    join public.plan_limits pl on pl.plan = s.plan
   where s.organization_id = new.organization_id
   order by s.created_at desc
   limit 1;

  select count(*) into v_used
    from public.organization_members
   where organization_id = new.organization_id;

  if v_seats is not null and v_used >= v_seats then
    raise exception 'seat limit reached for this plan' using errcode = '23514', hint = 'seat_limit';
  end if;
  return new;
end;
$$;

create trigger organization_members_seat_limit before insert on public.organization_members
  for each row execute function private.enforce_seat_limit();

-- A clinic always keeps at least one owner.
create or replace function private.keep_an_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('clinibot.org_deleting', true) = old.organization_id::text then
    return coalesce(new, old);
  end if;
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.organization_members m
        where m.organization_id = old.organization_id
          and m.role = 'owner'
          and m.id <> old.id
     ) then
    raise exception 'a clinic must keep at least one owner' using errcode = '23514', hint = 'last_owner';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger organization_members_keep_owner before update or delete on public.organization_members
  for each row execute function private.keep_an_owner();

-- ─────────────────────────── audit trail ───────────────────────────
-- Records who changed what. Never copies personal data (names, phones, message
-- bodies) into the log: only ids, changed column names and status/role values.

create or replace function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid;
  v_details jsonb := '{}'::jsonb;
  v_changed jsonb;
  v_actor uuid := (select auth.uid());
begin
  v_org := case when tg_table_name = 'organizations'
                then (v_row ->> 'id')::uuid
                else (v_row ->> 'organization_id')::uuid end;

  -- A clinic being deleted cascades through every child table; one entry for
  -- the deletion itself is enough.
  if tg_op = 'DELETE' and tg_table_name <> 'organizations'
     and current_setting('clinibot.org_deleting', true) = v_org::text then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Bookkeeping columns the server touches on every message are not events.
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb) into v_changed
      from jsonb_each(v_new) n
     where n.key not in (
             'updated_at', 'updated_by', 'last_inbound_at', 'last_message_at',
             'last_message_direction', 'first_inbound_at', 'first_response_at', 'last_error_at')
       and n.value is distinct from (v_old -> n.key);
    if v_changed = '[]'::jsonb then
      return new;
    end if;
    v_details := jsonb_build_object('changed', v_changed);
  end if;

  if tg_table_name = 'appointment_requests' then
    v_details := v_details || jsonb_strip_nulls(jsonb_build_object(
      'status_from', v_old ->> 'status',
      'status_to', v_new ->> 'status',
      'source', v_row ->> 'source'));
  elsif tg_table_name = 'organization_members' then
    v_details := v_details || jsonb_strip_nulls(jsonb_build_object(
      'user_id', v_row ->> 'user_id',
      'role_from', v_old ->> 'role',
      'role_to', v_new ->> 'role'));
  elsif tg_table_name = 'conversations' then
    v_details := v_details || jsonb_strip_nulls(jsonb_build_object(
      'channel', v_row ->> 'channel',
      'status_to', v_new ->> 'status',
      'ai_paused', v_new -> 'ai_paused'));
  elsif tg_table_name = 'integration_settings' then
    v_details := v_details || jsonb_strip_nulls(jsonb_build_object('status_to', v_new ->> 'status'));
  elsif tg_table_name = 'subscription_records' then
    v_details := v_details || jsonb_strip_nulls(jsonb_build_object(
      'plan', v_row ->> 'plan', 'status_to', v_new ->> 'status'));
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, actor_type, action, entity_type, entity_id, details)
  values (
    v_org,
    v_actor,
    case when v_actor is null then 'system' else 'user' end,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    case when tg_table_name = 'clinic_settings' then v_org else (v_row ->> 'id')::uuid end,
    v_details
  );

  return coalesce(new, old);
end;
$$;

create trigger audit_organizations after update or delete on public.organizations
  for each row execute function private.audit_change();
create trigger audit_organization_members after insert or update or delete on public.organization_members
  for each row execute function private.audit_change();
create trigger audit_clinic_settings after update on public.clinic_settings
  for each row execute function private.audit_change();
create trigger audit_clinic_services after insert or update or delete on public.clinic_services
  for each row execute function private.audit_change();
create trigger audit_approved_faqs after insert or update or delete on public.approved_faqs
  for each row execute function private.audit_change();
create trigger audit_conversations_update after update on public.conversations
  for each row
  when (old.status is distinct from new.status
        or old.ai_paused is distinct from new.ai_paused
        or old.assigned_to is distinct from new.assigned_to)
  execute function private.audit_change();
create trigger audit_conversations_delete after delete on public.conversations
  for each row execute function private.audit_change();
create trigger audit_appointment_requests after insert or update or delete on public.appointment_requests
  for each row execute function private.audit_change();
create trigger audit_integration_settings after insert or update or delete on public.integration_settings
  for each row execute function private.audit_change();
create trigger audit_subscription_records after insert or update or delete on public.subscription_records
  for each row execute function private.audit_change();

-- Audit entries are append-only. Only the retention purge may remove them.
create or replace function private.protect_audit_logs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('clinibot.audit_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'audit log entries are immutable' using errcode = '42501';
end;
$$;

create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.protect_audit_logs();

-- ─────────────────────────── row level security ───────────────────────────

alter table public.plan_limits enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.clinic_services enable row level security;
alter table public.approved_faqs enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.appointment_request_notes enable row level security;
alter table public.integration_settings enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.subscription_records enable row level security;
alter table public.ai_usage_monthly enable row level security;
alter table public.audit_logs enable row level security;
alter table public.demo_requests enable row level security;
alter table private.rate_limits enable row level security;

-- Public pricing.
create policy plan_limits_read on public.plan_limits
  for select to anon, authenticated using (true);

create policy organizations_select on public.organizations
  for select to authenticated using (private.is_org_member(id));
create policy organizations_update on public.organizations
  for update to authenticated
  using (private.has_org_role(id, '{owner,admin}'))
  with check (private.has_org_role(id, '{owner,admin}'));

create policy organization_members_select on public.organization_members
  for select to authenticated using (private.is_org_member(organization_id));

create policy clinic_settings_select on public.clinic_settings
  for select to authenticated using (private.is_org_member(organization_id));
create policy clinic_settings_update on public.clinic_settings
  for update to authenticated
  using (private.has_org_role(organization_id, '{owner,admin}'))
  with check (private.has_org_role(organization_id, '{owner,admin}'));

create policy clinic_services_select on public.clinic_services
  for select to authenticated using (private.is_org_member(organization_id));
create policy clinic_services_insert on public.clinic_services
  for insert to authenticated with check (private.has_org_role(organization_id, '{owner,admin}'));
create policy clinic_services_update on public.clinic_services
  for update to authenticated
  using (private.has_org_role(organization_id, '{owner,admin}'))
  with check (private.has_org_role(organization_id, '{owner,admin}'));
create policy clinic_services_delete on public.clinic_services
  for delete to authenticated using (private.has_org_role(organization_id, '{owner,admin}'));

create policy approved_faqs_select on public.approved_faqs
  for select to authenticated using (private.is_org_member(organization_id));
create policy approved_faqs_insert on public.approved_faqs
  for insert to authenticated with check (private.has_org_role(organization_id, '{owner,admin}'));
create policy approved_faqs_update on public.approved_faqs
  for update to authenticated
  using (private.has_org_role(organization_id, '{owner,admin}'))
  with check (private.has_org_role(organization_id, '{owner,admin}'));
create policy approved_faqs_delete on public.approved_faqs
  for delete to authenticated using (private.has_org_role(organization_id, '{owner,admin}'));

create policy conversations_select on public.conversations
  for select to authenticated using (private.is_org_member(organization_id));
create policy conversations_update on public.conversations
  for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
create policy conversations_delete on public.conversations
  for delete to authenticated using (private.has_org_role(organization_id, '{owner,admin}'));

create policy messages_select on public.messages
  for select to authenticated using (private.is_org_member(organization_id));

create policy appointment_requests_select on public.appointment_requests
  for select to authenticated using (private.is_org_member(organization_id));
create policy appointment_requests_insert on public.appointment_requests
  for insert to authenticated
  with check (private.is_org_member(organization_id) and source = 'dashboard' and created_by = (select auth.uid()));
create policy appointment_requests_update on public.appointment_requests
  for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));
create policy appointment_requests_delete on public.appointment_requests
  for delete to authenticated using (private.has_org_role(organization_id, '{owner,admin}'));

create policy appointment_request_notes_select on public.appointment_request_notes
  for select to authenticated using (private.is_org_member(organization_id));
create policy appointment_request_notes_insert on public.appointment_request_notes
  for insert to authenticated
  with check (private.is_org_member(organization_id) and author_id = (select auth.uid()));

create policy integration_settings_select on public.integration_settings
  for select to authenticated using (private.has_org_role(organization_id, '{owner,admin}'));
create policy integration_settings_update on public.integration_settings
  for update to authenticated
  using (private.has_org_role(organization_id, '{owner,admin}'))
  with check (private.has_org_role(organization_id, '{owner,admin}'));

create policy subscription_records_select on public.subscription_records
  for select to authenticated using (private.has_org_role(organization_id, '{owner,admin}'));

create policy ai_usage_monthly_select on public.ai_usage_monthly
  for select to authenticated using (private.has_org_role(organization_id, '{owner,admin}'));

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (organization_id is not null and private.has_org_role(organization_id, '{owner,admin}'));

-- integration_credentials, demo_requests and private.rate_limits have RLS on and
-- no policies on purpose: only the service role (which bypasses RLS) reads them.

-- ───────────────────────────── privileges ─────────────────────────────
-- Supabase grants broad table privileges to anon/authenticated by default.
-- Revoke them and grant back exactly what each table needs. Column lists keep
-- server-owned columns (organization_id on update, verified flags, timestamps
-- written by the server) out of the browser's reach even where RLS allows the row.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;

grant select on public.plan_limits to anon, authenticated;

grant select on public.organizations to authenticated;
grant update (name, city, phone, default_language) on public.organizations to authenticated;

grant select on public.organization_members to authenticated;

grant select on public.clinic_settings to authenticated;
grant update (
  display_name_ar, display_name_en, address_ar, address_en, maps_url, reception_phone,
  working_hours, working_hours_note_ar, working_hours_note_en,
  assistant_enabled, public_chat_enabled, assistant_name, assistant_tone,
  welcome_message_ar, welcome_message_en, extra_instructions, emergency_number,
  privacy_notice_ar, privacy_notice_en, message_retention_days, appointment_retention_days
) on public.clinic_settings to authenticated;

grant select, delete on public.clinic_services to authenticated;
grant insert (
  organization_id, name_ar, name_en, description_ar, description_en,
  price_type, price_sar, duration_minutes, is_active, sort_order
) on public.clinic_services to authenticated;
grant update (
  name_ar, name_en, description_ar, description_en,
  price_type, price_sar, duration_minutes, is_active, sort_order
) on public.clinic_services to authenticated;

grant select, delete on public.approved_faqs to authenticated;
grant insert (
  organization_id, question_ar, answer_ar, question_en, answer_en, is_active, sort_order
) on public.approved_faqs to authenticated;
grant update (
  question_ar, answer_ar, question_en, answer_en, is_active, sort_order
) on public.approved_faqs to authenticated;

grant select, delete on public.conversations to authenticated;
grant update (status, ai_paused, assigned_to) on public.conversations to authenticated;

grant select on public.messages to authenticated;

grant select, delete on public.appointment_requests to authenticated;
grant insert (
  organization_id, service_id, customer_name, customer_phone, preferred_date,
  preferred_time_window, customer_notes, assigned_to
) on public.appointment_requests to authenticated;
grant update (
  status, assigned_to, scheduled_for, service_id, preferred_date, preferred_time_window,
  customer_name, customer_phone
) on public.appointment_requests to authenticated;

grant select on public.appointment_request_notes to authenticated;
grant insert (organization_id, appointment_request_id, body) on public.appointment_request_notes to authenticated;

grant select on public.integration_settings to authenticated;
grant update (confirmation_template_name, confirmation_template_language) on public.integration_settings to authenticated;

grant select on public.subscription_records to authenticated;
grant select on public.ai_usage_monthly to authenticated;
grant select on public.audit_logs to authenticated;

grant all on all tables in schema public to service_role;
grant all on all tables in schema private to service_role;
grant usage, select on all sequences in schema public to service_role;
