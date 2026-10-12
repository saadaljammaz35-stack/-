-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--
-- Why it is a manual step: these statements contain DELETE / DROP, and the
-- Supabase connector used to set up this project requires an interactive
-- approval for those that could not be given from the build session. The
-- SQL is identical to the repository migrations; it defines functions and
-- removes two redundant indexes. It deletes no data when you run it.
--
-- Safe to run more than once.

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

revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.delete_organization(uuid, text) from public, anon;
revoke execute on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.remove_member(uuid) to authenticated, service_role;
grant execute on function public.delete_organization(uuid, text) to authenticated, service_role;
grant execute on function public.purge_expired_data() to service_role;

-- Superseded by the composite indexes in 20261012090400_fk_indexes.sql.
drop index if exists public.appointment_requests_conversation_idx;
drop index if exists public.appointment_requests_service_idx;
