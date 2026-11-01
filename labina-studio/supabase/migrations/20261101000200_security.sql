-- =============================================================================
-- لَبِنة · Labina Kids Studio — Row Level Security, grants and storage
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.admins           enable row level security;
alter table public.services         enable row level security;
alter table public.gallery_items    enable row level security;
alter table public.testimonials     enable row level security;
alter table public.faqs             enable row level security;
alter table public.working_hours    enable row level security;
alter table public.blocked_dates    enable row level security;
alter table public.site_settings    enable row level security;
alter table public.customers        enable row level security;
alter table public.bookings         enable row level security;
alter table public.booking_events   enable row level security;
alter table public.contact_messages enable row level security;

-- ---------------------------------------------------------------------------
-- Table grants (defense in depth on top of RLS)
-- Visitors (anon) can only read public content tables.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

grant select on public.services, public.gallery_items, public.testimonials, public.faqs,
                public.working_hours, public.blocked_dates, public.site_settings
  to anon;

-- Signed-in staff edit bookings/messages only through specific columns;
-- status and schedule changes must go through the logged functions.
revoke insert, update on public.bookings from authenticated;
grant update (admin_notes) on public.bookings to authenticated;
revoke insert, update on public.contact_messages from authenticated;
grant update (is_read) on public.contact_messages to authenticated;
revoke insert, update, delete on public.booking_events from authenticated;
revoke insert, update, delete on public.admins from authenticated;
revoke insert on public.customers from authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- admins: a user sees their own row; admins see the team
create policy admins_select on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- services
create policy services_select on public.services
  for select to anon, authenticated
  using (is_active or (select public.is_staff()));
create policy services_insert on public.services
  for insert to authenticated with check ((select public.is_admin()));
create policy services_update on public.services
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy services_delete on public.services
  for delete to authenticated using ((select public.is_admin()));

-- gallery
create policy gallery_select on public.gallery_items
  for select to anon, authenticated
  using (is_published or (select public.is_staff()));
create policy gallery_insert on public.gallery_items
  for insert to authenticated with check ((select public.is_admin()));
create policy gallery_update on public.gallery_items
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy gallery_delete on public.gallery_items
  for delete to authenticated using ((select public.is_admin()));

-- testimonials
create policy testimonials_select on public.testimonials
  for select to anon, authenticated
  using (is_published or (select public.is_staff()));
create policy testimonials_insert on public.testimonials
  for insert to authenticated with check ((select public.is_admin()));
create policy testimonials_update on public.testimonials
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy testimonials_delete on public.testimonials
  for delete to authenticated using ((select public.is_admin()));

-- faqs
create policy faqs_select on public.faqs
  for select to anon, authenticated
  using (is_published or (select public.is_staff()));
create policy faqs_insert on public.faqs
  for insert to authenticated with check ((select public.is_admin()));
create policy faqs_update on public.faqs
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy faqs_delete on public.faqs
  for delete to authenticated using ((select public.is_admin()));

-- working hours & closed days: public read, admin write
create policy working_hours_select on public.working_hours
  for select to anon, authenticated using (true);
create policy working_hours_insert on public.working_hours
  for insert to authenticated with check ((select public.is_admin()));
create policy working_hours_update on public.working_hours
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy blocked_dates_select on public.blocked_dates
  for select to anon, authenticated using (true);
create policy blocked_dates_insert on public.blocked_dates
  for insert to authenticated with check ((select public.is_admin()));
create policy blocked_dates_delete on public.blocked_dates
  for delete to authenticated using ((select public.is_admin()));

-- settings: public keys readable by everyone, private keys by admins only
create policy site_settings_select on public.site_settings
  for select to anon, authenticated
  using (is_public or (select public.is_admin()));
create policy site_settings_insert on public.site_settings
  for insert to authenticated with check ((select public.is_admin()));
create policy site_settings_update on public.site_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- customers: staff only
create policy customers_select on public.customers
  for select to authenticated using ((select public.is_staff()));
create policy customers_update on public.customers
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- bookings: staff read + admin_notes; admins may delete
create policy bookings_select on public.bookings
  for select to authenticated using ((select public.is_staff()));
create policy bookings_update on public.bookings
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy bookings_delete on public.bookings
  for delete to authenticated using ((select public.is_admin()));

create policy booking_events_select on public.booking_events
  for select to authenticated using ((select public.is_staff()));

-- contact messages: staff
create policy contact_messages_select on public.contact_messages
  for select to authenticated using ((select public.is_staff()));
create policy contact_messages_update on public.contact_messages
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy contact_messages_delete on public.contact_messages
  for delete to authenticated using ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Function grants: lock everything, then open exactly what is needed
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;
grant execute on function public.create_booking(uuid, date, time, text, text, text, integer, text) to anon, authenticated;
grant execute on function public.get_booking_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_booking_by_token(uuid, text) to anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text, text) to anon, authenticated;

grant execute on function public.admin_set_booking_status(uuid, text, text) to authenticated;
grant execute on function public.admin_reschedule_booking(uuid, date, time, text) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one public bucket for site images. Only admins can write, and
-- only images under known folders, max 10 MB.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy media_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));

create policy media_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (select public.is_admin())
    and (storage.foldername(name))[1] in ('gallery', 'services', 'home')
  );

create policy media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (
    bucket_id = 'media'
    and (select public.is_admin())
    and (storage.foldername(name))[1] in ('gallery', 'services', 'home')
  );

create policy media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
