-- SAMAT | سماط — engagement features: WhatsApp contact, favourites, order ratings, birthday gift,
-- stamp card, web push subscriptions and the owner's daily report.

-- settings --------------------------------------------------------------------------------------
alter table public.store_settings
  add column if not exists whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^\+9665[0-9]{8}$'),
  add column if not exists loyalty_birthday_points int not null default 0 check (loyalty_birthday_points between 0 and 100000),
  add column if not exists loyalty_stamp_target int not null default 0 check (loyalty_stamp_target between 0 and 100),
  add column if not exists loyalty_stamp_reward_points int not null default 0 check (loyalty_stamp_reward_points between 0 and 100000);

alter table public.profiles
  add column if not exists birthday date,
  add column if not exists birthday_rewarded_year int,
  add column if not exists stamps int not null default 0 check (stamps >= 0);

-- favourites (a saved build of a product) -------------------------------------------------------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  item jsonb not null,
  created_at timestamptz not null default now()
);
create index favorites_customer on public.favorites (customer_id, created_at desc);
alter table public.favorites enable row level security;
create policy own_read on public.favorites for select to authenticated using (customer_id = auth.uid());
create policy own_delete on public.favorites for delete to authenticated using (customer_id = auth.uid());
grant select, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;

-- order ratings (one per order, from the tracking link) -----------------------------------------
create table public.order_ratings (
  order_id uuid primary key references public.orders(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
alter table public.order_ratings enable row level security;
create policy staff_read on public.order_ratings for select to authenticated using (public.has_permission(auth.uid(), 'orders.view'));
grant select on public.order_ratings to authenticated;
grant all on public.order_ratings to service_role;

-- web push subscriptions (customers per order; staff per device) --------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  kind text not null check (kind in ('order', 'staff')),
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((kind = 'order' and order_id is not null) or (kind = 'staff' and user_id is not null))
);
create index push_subscriptions_order on public.push_subscriptions (order_id) where order_id is not null;
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;

-- daily report ----------------------------------------------------------------------------------
create table public.daily_reports (
  day date primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.daily_reports enable row level security;
create policy staff_read on public.daily_reports for select to authenticated using (public.has_permission(auth.uid(), 'reports.view'));
grant select on public.daily_reports to authenticated;
grant all on public.daily_reports to service_role;

create or replace function public.build_daily_report(p_day date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb; v_from timestamptz := (p_day::timestamp at time zone 'Asia/Riyadh'); v_to timestamptz := ((p_day + 1)::timestamp at time zone 'Asia/Riyadh');
begin
  with o as (select * from public.orders where created_at >= v_from and created_at < v_to)
  select jsonb_build_object(
    'day', p_day,
    'orders', (select count(*) from o where status not in ('pending_payment', 'expired', 'payment_failed')),
    'delivered', (select count(*) from o where status = 'delivered'),
    'rejected', (select count(*) from o where status in ('rejected', 'cancelled')),
    'sales', (select coalesce(sum(total), 0) from o where status = 'delivered'),
    'avg_order', (select coalesce(round(avg(total)), 0) from o where status = 'delivered'),
    'new_customers', (select count(*) from public.profiles where created_at >= v_from and created_at < v_to),
    'rating_avg', (select round(avg(r.rating)::numeric, 2) from public.order_ratings r join o on o.id = r.order_id),
    'ratings', (select count(*) from public.order_ratings r join o on o.id = r.order_id),
    'top', (select coalesce(jsonb_agg(t order by t.qty desc), '[]'::jsonb) from (
      select i.product_name_ar as name_ar, i.product_name_en as name_en, sum(i.quantity)::int as qty
      from public.order_items i join o on o.id = i.order_id where o.status = 'delivered'
      group by 1, 2 order by 3 desc limit 3) t)
  ) into v;
  insert into public.daily_reports (day, data) values (p_day, v)
    on conflict (day) do update set data = excluded.data, created_at = now();
  return v;
end $$;

-- stamp card: every delivered order of a signed-in customer is a stamp ---------------------------
create or replace function public.loyalty_stamp_on_delivery() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.store_settings; v_stamps int;
begin
  if new.status <> 'delivered' or old.status = 'delivered' or new.customer_id is null then return new; end if;
  select * into s from public.store_settings where id = 1;
  if not s.loyalty_enabled or s.loyalty_stamp_target <= 0 then return new; end if;
  update public.profiles set stamps = stamps + 1 where id = new.customer_id returning stamps into v_stamps;
  if v_stamps is not null and v_stamps >= s.loyalty_stamp_target then
    update public.profiles set stamps = stamps - s.loyalty_stamp_target where id = new.customer_id;
    if s.loyalty_stamp_reward_points > 0 then
      perform public.loyalty_credit(new.customer_id, s.loyalty_stamp_reward_points, 'adjust', new.id, 'Stamp card reward',
        case when s.loyalty_expiry_days is not null then now() + make_interval(days => s.loyalty_expiry_days) end);
    end if;
  end if;
  return new;
end $$;
create trigger orders_stamp after update of status on public.orders
  for each row execute function public.loyalty_stamp_on_delivery();

-- birthday gift: once a year, on the customer's birthday (Riyadh date) ---------------------------
create or replace function public.loyalty_birthday_run() returns int
language plpgsql security definer set search_path = public as $$
declare s public.store_settings; v_today date := (now() at time zone 'Asia/Riyadh')::date; r record; n int := 0;
begin
  select * into s from public.store_settings where id = 1;
  if not s.loyalty_enabled or s.loyalty_birthday_points <= 0 then return 0; end if;
  for r in
    update public.profiles p set birthday_rewarded_year = extract(year from v_today)::int
     where p.birthday is not null
       and extract(month from p.birthday) = extract(month from v_today)
       and extract(day from p.birthday) = extract(day from v_today)
       and p.birthday_rewarded_year is distinct from extract(year from v_today)::int
    returning p.id
  loop
    perform public.loyalty_credit(r.id, s.loyalty_birthday_points, 'adjust', null, 'Birthday gift',
      case when s.loyalty_expiry_days is not null then now() + make_interval(days => s.loyalty_expiry_days) end);
    n := n + 1;
  end loop;
  return n;
end $$;

-- loyalty settings now include birthday and stamp card ------------------------------------------
create or replace function public.admin_save_loyalty_settings(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('loyalty.manage');
begin
  perform set_config('samat.actor_id', uid::text, true);
  update public.store_settings set
    loyalty_enabled = coalesce((p->>'loyalty_enabled')::boolean, loyalty_enabled),
    loyalty_points_per_sar = coalesce((p->>'loyalty_points_per_sar')::numeric, loyalty_points_per_sar),
    loyalty_point_value_halalas = coalesce((p->>'loyalty_point_value_halalas')::int, loyalty_point_value_halalas),
    loyalty_min_redeem_points = coalesce((p->>'loyalty_min_redeem_points')::int, loyalty_min_redeem_points),
    loyalty_expiry_days = case when p ? 'loyalty_expiry_days' then nullif((p->>'loyalty_expiry_days')::int, 0) else loyalty_expiry_days end,
    loyalty_welcome_points = coalesce((p->>'loyalty_welcome_points')::int, loyalty_welcome_points),
    loyalty_birthday_points = coalesce((p->>'loyalty_birthday_points')::int, loyalty_birthday_points),
    loyalty_stamp_target = coalesce((p->>'loyalty_stamp_target')::int, loyalty_stamp_target),
    loyalty_stamp_reward_points = coalesce((p->>'loyalty_stamp_reward_points')::int, loyalty_stamp_reward_points)
  where id = 1;
end $$;

revoke execute on function public.build_daily_report(date), public.loyalty_birthday_run(), public.loyalty_stamp_on_delivery() from public, anon, authenticated;
grant execute on function public.build_daily_report(date), public.loyalty_birthday_run() to service_role;
grant execute on function public.admin_save_loyalty_settings(jsonb) to authenticated;

do $$
begin
  perform cron.schedule('samat-birthdays', '5 3 * * *', 'select public.loyalty_birthday_run()');
  perform cron.schedule('samat-daily-report', '10 21 * * *', $c$select public.build_daily_report(((now() at time zone 'Asia/Riyadh')::date) - 1)$c$);
exception when others then
  raise notice 'pg_cron not available (%); /api/cron runs these', sqlerrm;
end $$;
