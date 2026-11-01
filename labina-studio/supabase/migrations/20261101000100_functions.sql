-- =============================================================================
-- لَبِنة · Labina Kids Studio — booking engine & helper functions
-- Every public-facing write goes through a SECURITY DEFINER function that
-- validates its input on the server, so the anon key can never write rows
-- directly.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()) and a.role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Internal helpers (private schema is not exposed through the API)
-- ---------------------------------------------------------------------------
create or replace function private.booking_settings()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'timezone', 'Asia/Riyadh',
           'slot_interval_minutes', 30,
           'booking_window_days', 60,
           'min_notice_hours', 12,
           'cancel_notice_hours', 24,
           'max_children', 6
         )
         || coalesce((select s.value from public.site_settings s where s.key = 'booking'), '{}'::jsonb);
$$;

create or replace function private.studio_now()
returns timestamp
language sql
stable
set search_path = ''
as $$
  select now() at time zone (private.booking_settings() ->> 'timezone');
$$;

-- Is the studio open on this date, and between which hours?
create or replace function private.day_status(
  p_date date,
  out is_open boolean,
  out open_time time,
  out close_time time,
  out reason text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  cfg     jsonb := private.booking_settings();
  v_today date := private.studio_now()::date;
  wh      public.working_hours%rowtype;
begin
  is_open := false;
  if p_date is null then
    reason := 'INVALID_DATE';
    return;
  end if;
  if p_date < v_today or p_date > v_today + (cfg ->> 'booking_window_days')::int then
    reason := 'DATE_OUT_OF_RANGE';
    return;
  end if;
  if exists (select 1 from public.blocked_dates bd where bd.day = p_date) then
    reason := 'DAY_CLOSED';
    return;
  end if;
  select * into wh from public.working_hours w where w.weekday = extract(dow from p_date)::smallint;
  if not found or not wh.is_open then
    reason := 'DAY_CLOSED';
    return;
  end if;
  is_open := true;
  open_time := wh.open_time;
  close_time := wh.close_time;
end;
$$;

create or replace function private.new_booking_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ref text;
begin
  loop
    ref := 'LB-';
    for i in 1..6 loop
      ref := ref || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bookings b where b.reference = ref);
  end loop;
  return ref;
end;
$$;

create or replace function private.booking_payload(b public.bookings)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id,
    'reference', b.reference,
    'manage_token', b.manage_token,
    'service_name', b.service_name,
    'booking_date', b.booking_date,
    'start_time', to_char(b.start_time, 'HH24:MI'),
    'end_time', to_char(b.end_time, 'HH24:MI'),
    'status', b.status,
    'customer_name', b.customer_name,
    'customer_phone', b.customer_phone,
    'customer_email', b.customer_email,
    'children_count', b.children_count,
    'notes', b.notes
  );
$$;

create or replace function private.actor_label()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select coalesce(nullif(a.display_name, ''), u.email, 'admin')
       from public.admins a
       join auth.users u on u.id = a.user_id
      where a.user_id = (select auth.uid())),
    'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- PUBLIC: available start times for a service on a day
-- ---------------------------------------------------------------------------
create or replace function public.get_available_slots(p_service_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg        jsonb := private.booking_settings();
  v_interval int := greatest((cfg ->> 'slot_interval_minutes')::int, 5);
  v_notice   int := greatest((cfg ->> 'min_notice_hours')::int, 0);
  v_now      timestamp := private.studio_now();
  v_duration int;
  d          record;
  v_slots    jsonb;
begin
  select s.duration_minutes into v_duration
    from public.services s
   where s.id = p_service_id and s.is_active and s.is_bookable;
  if not found then
    return jsonb_build_object('slots', '[]'::jsonb, 'reason', 'SERVICE_UNAVAILABLE');
  end if;

  select * into d from private.day_status(p_date);
  if not d.is_open then
    return jsonb_build_object('slots', '[]'::jsonb, 'reason', d.reason);
  end if;

  select coalesce(jsonb_agg(to_char(c.t, 'HH24:MI') order by c.t), '[]'::jsonb)
    into v_slots
    from (
      select (d.open_time + make_interval(mins => g * v_interval))::time as t
        from generate_series(
               0,
               ((extract(epoch from (d.close_time - d.open_time)) / 60)::int - v_duration) / v_interval
             ) as g
    ) c
   where p_date + c.t >= v_now + make_interval(hours => v_notice)
     and not exists (
       select 1
         from public.bookings b
        where b.status in ('pending', 'confirmed')
          and tsrange(b.booking_date + b.start_time, b.booking_date + b.end_time, '[)')
              && tsrange(p_date + c.t, p_date + c.t + make_interval(mins => v_duration), '[)')
     );

  return jsonb_build_object(
    'slots', v_slots,
    'reason', case when jsonb_array_length(v_slots) = 0 then 'FULLY_BOOKED' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- PUBLIC: create a booking (validates everything server-side)
-- Raises P0001 with a machine-readable code the app translates to Arabic.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_service_id uuid,
  p_date       date,
  p_start      time,
  p_name       text,
  p_phone      text,
  p_email      text,
  p_children   integer,
  p_notes      text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cfg        jsonb := private.booking_settings();
  v_interval int := greatest((cfg ->> 'slot_interval_minutes')::int, 5);
  v_notice   int := greatest((cfg ->> 'min_notice_hours')::int, 0);
  v_max_kids int := greatest((cfg ->> 'max_children')::int, 1);
  v_now      timestamp := private.studio_now();
  v_name     text := btrim(coalesce(p_name, ''));
  v_phone    text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_email    text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_notes    text := nullif(btrim(coalesce(p_notes, '')), '');
  v_service  public.services%rowtype;
  d          record;
  v_end_ts   timestamp;
  v_active   int;
  v_customer uuid;
  v_booking  public.bookings%rowtype;
begin
  -- 1. Input validation -------------------------------------------------------
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if v_phone !~ '^\+?[0-9]{8,15}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  if v_email is not null and (char_length(v_email) > 160 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;
  if p_children is null or p_children < 1 or p_children > v_max_kids then
    raise exception 'INVALID_CHILDREN' using errcode = 'P0001';
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'INVALID_NOTES' using errcode = 'P0001';
  end if;

  -- 2. Service ------------------------------------------------------------------
  select * into v_service from public.services s
   where s.id = p_service_id and s.is_active and s.is_bookable;
  if not found then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- 3. Date & time --------------------------------------------------------------
  if p_start is null then
    raise exception 'INVALID_SLOT' using errcode = 'P0001';
  end if;
  select * into d from private.day_status(p_date);
  if not d.is_open then
    raise exception '%', d.reason using errcode = 'P0001';
  end if;
  v_end_ts := p_date + p_start + make_interval(mins => v_service.duration_minutes);
  if p_start < d.open_time or v_end_ts > p_date + d.close_time then
    raise exception 'OUTSIDE_HOURS' using errcode = 'P0001';
  end if;
  if mod((extract(epoch from (p_start - d.open_time)) / 60)::int, v_interval) <> 0 then
    raise exception 'INVALID_SLOT' using errcode = 'P0001';
  end if;
  if p_date + p_start < v_now + make_interval(hours => v_notice) then
    raise exception 'TOO_SOON' using errcode = 'P0001';
  end if;

  -- 4. Anti-abuse: at most 3 upcoming active bookings per phone number ----------
  select count(*) into v_active
    from public.bookings b
   where b.customer_phone = v_phone
     and b.status in ('pending', 'confirmed')
     and b.booking_date >= v_now::date;
  if v_active >= 3 then
    raise exception 'TOO_MANY_BOOKINGS' using errcode = 'P0001';
  end if;

  -- 5. Customer record (keyed by phone) ----------------------------------------
  insert into public.customers (full_name, phone, email)
  values (v_name, v_phone, v_email)
  on conflict (phone) do update
     set email = coalesce(public.customers.email, excluded.email),
         updated_at = now()
  returning id into v_customer;

  -- 6. Booking — the exclusion constraint guarantees no overlap ----------------
  begin
    insert into public.bookings (
      reference, customer_id, service_id, service_name, price_snapshot,
      booking_date, start_time, end_time, children_count,
      customer_name, customer_phone, customer_email, notes, status, source
    ) values (
      private.new_booking_reference(), v_customer, v_service.id, v_service.name, v_service.price,
      p_date, p_start, v_end_ts::time, p_children,
      v_name, v_phone, v_email, v_notes, 'pending', 'website'
    )
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  insert into public.booking_events (booking_id, event, to_status, actor_label)
  values (v_booking.id, 'created', 'pending', 'customer');

  return private.booking_payload(v_booking);
end;
$$;

-- ---------------------------------------------------------------------------
-- PUBLIC: look up a booking with its private manage link token
-- ---------------------------------------------------------------------------
create or replace function public.get_booking_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg      jsonb := private.booking_settings();
  v_notice int := greatest((cfg ->> 'cancel_notice_hours')::int, 0);
  b        public.bookings%rowtype;
begin
  if p_token is null then
    return null;
  end if;
  select * into b from public.bookings x where x.manage_token = p_token;
  if not found then
    return null;
  end if;
  return private.booking_payload(b)
         - 'id' - 'customer_phone' - 'customer_email' - 'manage_token'
         || jsonb_build_object(
              'can_cancel', b.status in ('pending', 'confirmed')
                            and b.booking_date + b.start_time > private.studio_now() + make_interval(hours => v_notice),
              'cancel_notice_hours', v_notice
            );
end;
$$;

-- ---------------------------------------------------------------------------
-- PUBLIC: customer cancels with the manage link
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking_by_token(p_token uuid, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cfg      jsonb := private.booking_settings();
  v_notice int := greatest((cfg ->> 'cancel_notice_hours')::int, 0);
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
  b        public.bookings%rowtype;
  v_from   text;
begin
  select * into b from public.bookings x where x.manage_token = p_token for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if b.status not in ('pending', 'confirmed')
     or b.booking_date + b.start_time <= private.studio_now() + make_interval(hours => v_notice) then
    raise exception 'CANNOT_CANCEL' using errcode = 'P0001';
  end if;
  v_from := b.status;

  update public.bookings x
     set status = 'cancelled', cancelled_reason = v_reason
   where x.id = b.id
  returning * into b;

  insert into public.booking_events (booking_id, event, from_status, to_status, note, actor_label)
  values (b.id, 'cancelled_by_customer', v_from, 'cancelled', v_reason, 'customer');

  return private.booking_payload(b) - 'manage_token';
end;
$$;

-- ---------------------------------------------------------------------------
-- PUBLIC: contact form
-- ---------------------------------------------------------------------------
create or replace function public.submit_contact_message(
  p_name    text,
  p_phone   text,
  p_email   text,
  p_subject text,
  p_message text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name    text := btrim(coalesce(p_name, ''));
  v_phone   text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_email   text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
  v_message text := btrim(coalesce(p_message, ''));
  v_id      uuid;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if v_phone is null and v_email is null then
    raise exception 'CONTACT_REQUIRED' using errcode = 'P0001';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{8,15}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  if v_email is not null and (char_length(v_email) > 160 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;
  if v_subject is not null and char_length(v_subject) > 120 then
    raise exception 'INVALID_SUBJECT' using errcode = 'P0001';
  end if;
  if char_length(v_message) < 5 or char_length(v_message) > 2000 then
    raise exception 'INVALID_MESSAGE' using errcode = 'P0001';
  end if;

  -- Rate limits: 3 per sender per hour, 40 overall per 10 minutes
  if (select count(*) from public.contact_messages m
       where m.created_at > now() - interval '1 hour'
         and ((v_phone is not null and m.phone = v_phone) or (v_email is not null and m.email = v_email))) >= 3
     or (select count(*) from public.contact_messages m where m.created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into public.contact_messages (full_name, phone, email, subject, message)
  values (v_name, v_phone, v_email, v_subject, v_message)
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- STAFF: change a booking's status (logged)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_booking_status(p_booking_id uuid, p_status text, p_note text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  b      public.bookings%rowtype;
  v_from text;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'confirmed', 'completed', 'cancelled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select * into b from public.bookings x where x.id = p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if b.status = p_status then
    return private.booking_payload(b) || jsonb_build_object('changed', false);
  end if;
  v_from := b.status;

  begin
    update public.bookings x
       set status = p_status,
           cancelled_reason = case when p_status = 'cancelled' then v_note else x.cancelled_reason end
     where x.id = b.id
    returning * into b;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  insert into public.booking_events (booking_id, event, from_status, to_status, note, actor_id, actor_label)
  values (b.id, 'status_changed', v_from, p_status, v_note, (select auth.uid()), private.actor_label());

  return private.booking_payload(b) || jsonb_build_object('changed', true, 'from_status', v_from);
end;
$$;

-- ---------------------------------------------------------------------------
-- STAFF: move a booking to another date/time (logged; overlap still enforced)
-- ---------------------------------------------------------------------------
create or replace function public.admin_reschedule_booking(p_booking_id uuid, p_date date, p_start time, p_note text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_note     text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  b          public.bookings%rowtype;
  v_duration interval;
  v_end_ts   timestamp;
  v_old      text;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_date is null or p_start is null then
    raise exception 'INVALID_SLOT' using errcode = 'P0001';
  end if;

  select * into b from public.bookings x where x.id = p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if b.status not in ('pending', 'confirmed') then
    raise exception 'NOT_ACTIVE' using errcode = 'P0001';
  end if;

  v_duration := b.end_time - b.start_time;
  v_end_ts := p_date + p_start + v_duration;
  if v_end_ts::date <> p_date then
    raise exception 'OUTSIDE_HOURS' using errcode = 'P0001';
  end if;
  v_old := to_char(b.booking_date, 'YYYY-MM-DD') || ' ' || to_char(b.start_time, 'HH24:MI');

  begin
    update public.bookings x
       set booking_date = p_date, start_time = p_start, end_time = v_end_ts::time
     where x.id = b.id
    returning * into b;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  insert into public.booking_events (booking_id, event, note, actor_id, actor_label)
  values (
    b.id, 'rescheduled',
    v_old || ' → ' || to_char(p_date, 'YYYY-MM-DD') || ' ' || to_char(p_start, 'HH24:MI')
      || coalesce(' · ' || v_note, ''),
    (select auth.uid()), private.actor_label()
  );

  return private.booking_payload(b);
end;
$$;

-- ---------------------------------------------------------------------------
-- STAFF: dashboard numbers in one round trip
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz    text := private.booking_settings() ->> 'timezone';
  v_now   timestamp := private.studio_now();
  v_today date := v_now::date;
  result  jsonb;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'total', count(*),
           'pending', count(*) filter (where b.status = 'pending'),
           'confirmed', count(*) filter (where b.status = 'confirmed'),
           'completed', count(*) filter (where b.status = 'completed'),
           'cancelled', count(*) filter (where b.status = 'cancelled'),
           'today', count(*) filter (where b.booking_date = v_today and b.status in ('pending', 'confirmed')),
           'upcoming_week', count(*) filter (where b.booking_date between v_today and v_today + 7
                                               and b.status in ('pending', 'confirmed')),
           'created_this_month', count(*) filter (where date_trunc('month', b.created_at at time zone v_tz)
                                                    = date_trunc('month', v_now))
         )
    into result
    from public.bookings b;

  result := result || jsonb_build_object(
    'customers', (select count(*) from public.customers),
    'unread_messages', (select count(*) from public.contact_messages m where not m.is_read),
    'weekly', (
      select coalesce(jsonb_agg(jsonb_build_object('week', to_char(w, 'YYYY-MM-DD'), 'count', (
               select count(*) from public.bookings b
                where b.created_at at time zone v_tz >= w
                  and b.created_at at time zone v_tz < w + interval '7 days')) order by w), '[]'::jsonb)
        from generate_series(date_trunc('week', v_now) - interval '7 weeks', date_trunc('week', v_now), interval '1 week') w
    )
  );
  return result;
end;
$$;
