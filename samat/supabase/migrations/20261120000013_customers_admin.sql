-- SAMAT | سماط — registered customers for the admin (search, points), and optional welcome points.

alter table public.store_settings
  add column if not exists loyalty_welcome_points int not null default 0 check (loyalty_welcome_points between 0 and 100000);
alter table public.profiles add column if not exists welcome_granted_at timestamptz;

-- Registered customers with their points and orders (loyalty.manage).
create or replace function public.admin_customers(p_search text default null, p_sort text default 'recent', p_limit int default 50, p_offset int default 0)
returns table (id uuid, full_name text, phone text, email text, via text, balance int, lifetime_earned int,
               orders bigint, spent bigint, last_order_at timestamptz, joined_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_term text := nullif(btrim(coalesce(p_search, '')), '');
  v_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
begin
  perform public.require_permission('loyalty.manage');
  if v_digits like '966%' then v_digits := substr(v_digits, 4); elsif v_digits like '0%' then v_digits := substr(v_digits, 2); end if;
  return query
  with base as (
    select p.id, p.full_name, p.phone, p.email::text as email,
      case when u.raw_app_meta_data->>'samat_provider' = 'google' then 'google'
           when coalesce(u.phone, '') <> '' then 'phone' else 'other' end as via,
      coalesce(a.balance, 0) as balance, coalesce(a.lifetime_earned, 0) as lifetime_earned,
      (select count(*) from public.orders o where o.customer_id = p.id and o.status not in ('pending_payment', 'expired', 'payment_failed')) as orders,
      (select coalesce(sum(o.total), 0)::bigint from public.orders o where o.customer_id = p.id and o.status = 'delivered') as spent,
      (select max(o.created_at) from public.orders o where o.customer_id = p.id) as last_order_at,
      p.created_at as joined_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.loyalty_accounts a on a.customer_id = p.id
    where v_term is null
       or p.full_name ilike '%' || v_term || '%'
       or p.email::text ilike '%' || v_term || '%'
       or (length(v_digits) >= 3 and p.phone like '%' || v_digits || '%')
  )
  select b.*, count(*) over () as total_count from base b
  order by
    case when p_sort = 'points' then b.balance end desc nulls last,
    case when p_sort = 'spent' then b.spent end desc nulls last,
    case when p_sort = 'orders' then b.orders end desc nulls last,
    b.joined_at desc
  limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0);
end $$;

-- Welcome points, once per customer, when the restaurant has set them (server only).
create or replace function public.loyalty_grant_welcome(p_customer uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_points int; s public.store_settings;
begin
  select * into s from public.store_settings where id = 1;
  v_points := coalesce(s.loyalty_welcome_points, 0);
  if not s.loyalty_enabled or v_points <= 0 then return 0; end if;
  update public.profiles set welcome_granted_at = now() where id = p_customer and welcome_granted_at is null;
  if not found then return 0; end if;
  perform public.loyalty_credit(p_customer, v_points, 'adjust', null, 'Welcome points',
    case when s.loyalty_expiry_days is not null then now() + make_interval(days => s.loyalty_expiry_days) end);
  return v_points;
end $$;

-- Loyalty settings now include the welcome points.
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
    loyalty_welcome_points = coalesce((p->>'loyalty_welcome_points')::int, loyalty_welcome_points)
  where id = 1;
end $$;

revoke execute on function public.admin_customers(text, text, int, int), public.loyalty_grant_welcome(uuid) from public, anon, authenticated;
grant execute on function public.admin_customers(text, text, int, int) to authenticated, service_role;
grant execute on function public.loyalty_grant_welcome(uuid) to service_role;
grant execute on function public.admin_save_loyalty_settings(jsonb) to authenticated;
