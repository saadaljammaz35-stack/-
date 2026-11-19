-- SAMAT | سماط — permissions, audit, rate limiting, store state, availability

-- Raise a typed application error. The server maps 'SAMAT:<code>' to a localized message.
create or replace function public.samat_error(p_code text, p_detail jsonb default '{}'::jsonb) returns void
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = 'SAMAT:' || p_code, detail = coalesce(p_detail, '{}'::jsonb)::text;
end $$;

-- Who is acting: the signed-in user (staff JWT) or the actor the server set for this transaction.
create or replace function public.current_actor() returns uuid
language sql stable as $$
  select coalesce(auth.uid(), nullif(current_setting('samat.actor_id', true), '')::uuid)
$$;

create or replace function public.has_permission(p_uid uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_members sm
    where sm.user_id = p_uid and sm.is_active
      and (
        sm.role_key = 'owner'
        or exists (select 1 from public.staff_permission_overrides o
                   where o.user_id = sm.user_id and o.permission_key = p_perm and o.allow)
        or (
          exists (select 1 from public.role_permissions rp
                  where rp.role_key = sm.role_key and rp.permission_key = p_perm)
          and not exists (select 1 from public.staff_permission_overrides o
                          where o.user_id = sm.user_id and o.permission_key = p_perm and not o.allow)
        )
      )
  )
$$;

create or replace function public.is_staff(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_members where user_id = p_uid and is_active)
$$;

create or replace function public.is_owner(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_members where user_id = p_uid and is_active and role_key = 'owner')
$$;

-- Effective permissions of the signed-in staff member (drives the admin UI; the server and the
-- database still check every action independently).
create or replace function public.my_permissions() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.key order by p.key), '{}')
  from public.permissions p
  where public.has_permission(auth.uid(), p.key)
$$;

create or replace function public.require_permission(p_perm text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.has_permission(uid, p_perm) then
    perform public.samat_error('forbidden', jsonb_build_object('permission', p_perm));
  end if;
  return uid;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------------------------
create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text,
  p_before jsonb default null, p_after jsonb default null, p_meta jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.current_actor(); v_email text;
begin
  if v_actor is not null then
    select email into v_email from auth.users where id = v_actor;
  end if;
  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, before, after, meta)
  values (v_actor, v_email, p_action, p_entity, p_entity_id, p_before, p_after, p_meta);
end $$;

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id text; v_before jsonb; v_after jsonb;
begin
  -- System-driven stock changes are recorded in inventory_movements; only audit people.
  if public.current_actor() is null and tg_table_name = 'inventory' then
    return coalesce(new, old);
  end if;
  v_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_after := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  if tg_op = 'UPDATE' and v_before - 'updated_at' = v_after - 'updated_at' then
    return new;
  end if;
  v_id := coalesce(v_after->>'id', v_before->>'id', v_after->>'user_id', v_before->>'user_id',
                   v_after->>'product_id', v_before->>'product_id');
  perform public.write_audit(lower(tg_op), tg_table_name, v_id, v_before, v_after);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['categories', 'products', 'ingredients', 'sauces', 'product_ingredients',
    'product_sauces', 'option_groups', 'product_options', 'inventory', 'coupons', 'loyalty_rewards',
    'store_settings', 'staff_members', 'staff_permission_overrides', 'staff_invitations'] loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.audit_trigger()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Rate limiting: returns true when the hit is allowed.
-- ---------------------------------------------------------------------------------------------
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_start timestamptz; v_hits int;
begin
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  -- opportunistic cleanup of old windows
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Store state (open / paused / busy / capacity)
-- ---------------------------------------------------------------------------------------------
create or replace function public.store_state(p_at timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.store_settings;
  days constant text[] := array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  local_ts timestamp;
  dow int;
  t time;
  slot jsonb;
  o time; c time;
  open_now boolean := false;
  hours_configured boolean;
  active_count int;
  prep int;
  reason text := null;
begin
  select * into s from public.store_settings where id = 1;
  local_ts := p_at at time zone s.timezone;
  dow := extract(dow from local_ts)::int;
  t := local_ts::time;
  hours_configured := exists (select 1 from jsonb_each(s.opening_hours) e where jsonb_array_length(e.value) > 0);

  if not hours_configured then
    open_now := true; -- no schedule set: the manual switch decides
  else
    for slot in select * from jsonb_array_elements(coalesce(s.opening_hours -> days[dow + 1], '[]')) loop
      o := (slot->>'open')::time; c := (slot->>'close')::time;
      if (o < c and t >= o and t < c) or (o >= c and t >= o) then open_now := true; end if;
    end loop;
    -- yesterday's slots that run past midnight
    for slot in select * from jsonb_array_elements(coalesce(s.opening_hours -> days[((dow + 6) % 7) + 1], '[]')) loop
      o := (slot->>'open')::time; c := (slot->>'close')::time;
      if o >= c and t < c then open_now := true; end if;
    end loop;
  end if;

  select count(*) into active_count from public.orders
  where status in ('awaiting_approval', 'accepted', 'preparing');

  prep := s.base_prep_minutes + case when s.busy_mode then s.busy_extra_minutes else 0 end;

  if not s.accepting_orders then reason := 'paused';
  elsif not open_now then reason := 'closed';
  elsif s.max_active_orders is not null and active_count >= s.max_active_orders then reason := 'capacity';
  end if;

  return jsonb_build_object(
    'open_now', open_now,
    'hours_configured', hours_configured,
    'accepting_orders', s.accepting_orders,
    'busy_mode', s.busy_mode,
    'busy_extra_minutes', s.busy_extra_minutes,
    'prep_minutes', prep,
    'at_capacity', s.max_active_orders is not null and active_count >= s.max_active_orders,
    'can_order', reason is null,
    'reason', reason,
    'pause_message_ar', s.pause_message_ar,
    'pause_message_en', s.pause_message_en,
    'busy_message_ar', s.busy_message_ar,
    'busy_message_en', s.busy_message_en
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- Inventory availability
-- ---------------------------------------------------------------------------------------------
create or replace function public.inventory_available(p_id uuid, p_exclude_order uuid default null) returns numeric
language sql stable security definer set search_path = public as $$
  select i.on_hand - coalesce((
    select sum(r.quantity) from public.inventory_reservations r
    where r.inventory_id = i.id and r.status = 'held'
      and (r.expires_at is null or r.expires_at > now())
      and (p_exclude_order is null or r.order_id <> p_exclude_order)
  ), 0)
  from public.inventory i where i.id = p_id
$$;

-- What the customer can currently order. Exposes booleans only, never stock counts.
create or replace function public.menu_availability() returns jsonb
language sql stable security definer set search_path = public as $$
  with avail as (
    select i.id, i.is_active and public.inventory_available(i.id) > 0 as ok,
           public.inventory_available(i.id) as qty
    from public.inventory i
  )
  select jsonb_build_object(
    'ingredients', coalesce((select jsonb_object_agg(g.id, g.is_active and coalesce(a.qty >= g.inventory_qty and a.ok, true))
                             from public.ingredients g left join avail a on a.id = g.inventory_id), '{}'),
    'sauces', coalesce((select jsonb_object_agg(s.id, s.is_active and coalesce(a.qty >= s.inventory_qty and a.ok, true))
                        from public.sauces s left join avail a on a.id = s.inventory_id), '{}'),
    'options', coalesce((select jsonb_object_agg(o.id, o.is_active and coalesce(a.qty >= o.inventory_qty and a.ok, true))
                         from public.product_options o left join avail a on a.id = o.inventory_id), '{}'),
    'products', coalesce((
      select jsonb_object_agg(p.id,
        p.is_active and p.is_available and p.deleted_at is null
        and coalesce(a.qty >= p.inventory_qty and a.ok, true)
        -- every base ingredient must be in stock
        and not exists (
          select 1 from public.product_ingredients pi
          join public.ingredients g on g.id = pi.ingredient_id
          left join avail ga on ga.id = g.inventory_id
          where pi.product_id = p.id and pi.role = 'base'
            and not (g.is_active and coalesce(ga.qty >= g.inventory_qty * pi.default_qty and ga.ok, true)))
        -- shawarma-style products need at least one bread in stock
        and (not exists (select 1 from public.product_ingredients pi where pi.product_id = p.id and pi.role = 'bread_choice')
             or exists (
               select 1 from public.product_ingredients pi
               join public.ingredients g on g.id = pi.ingredient_id
               left join avail ga on ga.id = g.inventory_id
               where pi.product_id = p.id and pi.role = 'bread_choice'
                 and g.is_active and coalesce(ga.qty >= g.inventory_qty and ga.ok, true)))
        -- every required option group needs one available option
        and not exists (
          select 1 from public.option_groups og
          where og.product_id = p.id and og.is_required
            and not exists (select 1 from public.product_options po
                            left join avail oa on oa.id = po.inventory_id
                            where po.group_id = og.id and po.is_active
                              and coalesce(oa.qty >= po.inventory_qty and oa.ok, true))))
      from public.products p left join avail a on a.id = p.inventory_id), '{}')
  )
$$;
