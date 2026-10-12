-- Covering indexes for foreign keys flagged by the Supabase performance
-- advisor. Composite tenant FKs get an index on exactly their columns so
-- cascades and joins from the parent never scan the child table.

create index if not exists messages_conversation_org_idx
  on public.messages (conversation_id, organization_id);
create index if not exists appointment_requests_conversation_org_idx
  on public.appointment_requests (conversation_id, organization_id);
create index if not exists appointment_requests_service_org_idx
  on public.appointment_requests (service_id, organization_id);
create index if not exists appointment_request_notes_request_org_idx
  on public.appointment_request_notes (appointment_request_id, organization_id);

drop index if exists public.appointment_requests_conversation_idx;
drop index if exists public.appointment_requests_service_idx;

create index if not exists appointment_requests_confirmed_by_idx on public.appointment_requests (confirmed_by);
create index if not exists appointment_requests_created_by_idx on public.appointment_requests (created_by);
create index if not exists approved_faqs_created_by_idx on public.approved_faqs (created_by);
create index if not exists clinic_settings_updated_by_idx on public.clinic_settings (updated_by);
create index if not exists organization_members_invited_by_idx on public.organization_members (invited_by);
create index if not exists subscription_records_plan_idx on public.subscription_records (plan);
