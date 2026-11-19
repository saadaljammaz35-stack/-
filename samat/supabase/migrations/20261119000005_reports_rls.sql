-- SAMAT | سماط — decision locks, kitchen/pickup feeds, reports, RLS, grants, realtime, storage, cron

-- ---------------------------------------------------------------------------------------------
-- Decision lock: two managers cannot accept and reject (capture and refund) the same order at once.
-- ---------------------------------------------------------------------------------------------
alter table public.orders add column decision_lock_at timestamptz, add column decision_lock_by uuid;

create or replace function public.staff_claim_decision(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('orders.manage'); o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  if o.status <> 'awaiting_approval' then
    perform public.samat_error('invalid_transition', jsonb_build_object('from', o.status));
  end if;
  if o.decision_lock_by is not null and o.decision_lock_by <> uid and o.decision_lock_at > now() - interval '2 minutes' then
    perform public.samat_error('decision_in_progress');
  end if;
  update public.orders set decision_lock_at = now(), decision_lock_by = uid where id = p_order;
  return jsonb_build_object('ok', true, 'payment_status', o.payment_status, 'total', o.total);
end $$;

create or replace function public.staff_release_decision(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('orders.manage');
begin
  update public.orders set decision_lock_at = null, decision_lock_by = null
   where id = p_order and decision_lock_by = uid;
end $$;

create or replace function public.clear_decision_lock() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.decision_lock_at := null; new.decision_lock_by := null;
  end if;
  return new;
end $$;
create trigger orders_clear_lock before update of status on public.orders
  for each row execute function public.clear_decision_lock();

-- ---------------------------------------------------------------------------------------------
-- Busy mode / pause (orders managers can do this without full settings access)
-- ---------------------------------------------------------------------------------------------
create or replace function public.staff_set_ordering(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('busy.manage'); s public.store_settings;
begin
  perform set_config('samat.actor_id', uid::text, true);
  update public.store_settings set
    accepting_orders = coalesce((p->>'accepting_orders')::boolean, accepting_orders),
    pause_message_ar = case when p ? 'pause_message_ar' then nullif(left(p->>'pause_message_ar', 200), '') else pause_message_ar end,
    pause_message_en = case when p ? 'pause_message_en' then nullif(left(p->>'pause_message_en', 200), '') else pause_message_en end,
    busy_mode = coalesce((p->>'busy_mode')::boolean, busy_mode),
    busy_extra_minutes = coalesce((p->>'busy_extra_minutes')::int, busy_extra_minutes),
    busy_message_ar = case when p ? 'busy_message_ar' then nullif(left(p->>'busy_message_ar', 200), '') else busy_message_ar end,
    busy_message_en = case when p ? 'busy_message_en' then nullif(left(p->>'busy_message_en', 200), '') else busy_message_en end,
    max_active_orders = case when p ? 'max_active_orders' then nullif((p->>'max_active_orders')::int, 0) else max_active_orders end
  where id = 1
  returning * into s;
  return public.store_state();
end $$;

-- ---------------------------------------------------------------------------------------------
-- Kitchen feed: only what the kitchen needs (no phone numbers, no e-mails).
-- ---------------------------------------------------------------------------------------------
create or replace function public.kitchen_orders() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.require_permission('kitchen.view'); s public.store_settings;
begin
  select * into s from public.store_settings where id = 1;
  return coalesce((
    select jsonb_agg(x order by x->>'accepted_at')
    from (
      select jsonb_build_object(
        'id', o.id, 'order_number', o.order_number, 'pickup_code', o.pickup_code, 'status', o.status,
        'customer_name', split_part(o.customer_name, ' ', 1), 'notes', o.notes,
        'created_at', o.created_at, 'accepted_at', o.accepted_at, 'preparing_at', o.preparing_at,
        'ready_at', o.ready_at, 'delivered_at', o.delivered_at, 'estimated_ready_at', o.estimated_ready_at,
        'payment_status', o.payment_status, 'late_after_minutes', s.kitchen_late_minutes,
        'items', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', i.id, 'name_ar', i.product_name_ar, 'name_en', i.product_name_en, 'quantity', i.quantity,
            'category_kind', i.category_kind, 'builder', i.builder, 'bread_ar', i.bread_name_ar, 'bread_en', i.bread_name_en,
            'notes', i.notes,
            'customizations', (
              select coalesce(jsonb_agg(jsonb_build_object('kind', c.kind, 'action', c.action, 'quantity', c.quantity,
                       'name_ar', c.name_ar, 'name_en', c.name_en) order by c.sort_order), '[]')
              from public.order_customizations c where c.order_item_id = i.id)
          ) order by i.sort_order), '[]')
          from public.order_items i where i.order_id = o.id)
      ) as x
      from public.orders o
      where o.status in ('accepted', 'preparing', 'ready')
         or (o.status = 'delivered' and o.delivered_at > now() - interval '20 minutes')
    ) q), '[]'::jsonb);
end $$;

-- Pickup screen: order numbers only.
create or replace function public.pickup_board() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not s.pickup_screen_enabled then jsonb_build_object('enabled', false)
  else jsonb_build_object(
    'enabled', true,
    'ready', coalesce((select jsonb_agg(jsonb_build_object('n', b.order_number, 'at', b.ready_at) order by b.ready_at)
                       from public.order_board b where b.status = 'ready'), '[]'),
    'preparing', coalesce((select jsonb_agg(b.order_number order by b.order_number)
                           from public.order_board b where b.status in ('accepted', 'preparing')), '[]'),
    'delivered', coalesce((select jsonb_agg(x.order_number) from (
                             select b.order_number from public.order_board b
                             where b.status = 'delivered' and b.delivered_at > now() - interval '15 minutes'
                             order by b.delivered_at desc limit 8) x), '[]'))
  end
  from public.store_settings s where s.id = 1
$$;

-- ---------------------------------------------------------------------------------------------
-- Reports (actual figures only; the assistant and dashboard both read these)
-- ---------------------------------------------------------------------------------------------
create or replace function public.require_reports() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not (public.has_permission(uid, 'reports.view') or public.has_permission(uid, 'dashboard.view')) then
    perform public.samat_error('forbidden', '{"permission":"reports.view"}');
  end if;
  return uid;
end $$;

create or replace function public.report_overview(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.require_reports(); v jsonb;
begin
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'revenue', coalesce(sum(total) filter (where status in ('accepted', 'preparing', 'ready', 'delivered')), 0),
    'vat', coalesce(sum(vat_amount) filter (where status in ('accepted', 'preparing', 'ready', 'delivered')), 0),
    'discounts', coalesce(sum(discount_total) filter (where status in ('accepted', 'preparing', 'ready', 'delivered')), 0),
    'sales_orders', count(*) filter (where status in ('accepted', 'preparing', 'ready', 'delivered')),
    'avg_order_value', coalesce(round(avg(total) filter (where status in ('accepted', 'preparing', 'ready', 'delivered'))), 0),
    'all_orders', count(*) filter (where status not in ('pending_payment', 'expired', 'payment_failed')),
    'awaiting_approval', count(*) filter (where status = 'awaiting_approval'),
    'accepted', count(*) filter (where status = 'accepted'),
    'preparing', count(*) filter (where status = 'preparing'),
    'ready', count(*) filter (where status = 'ready'),
    'delivered', count(*) filter (where status = 'delivered'),
    'rejected', count(*) filter (where status = 'rejected'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'unpaid_abandoned', count(*) filter (where status in ('expired', 'payment_failed')),
    'unique_customers', count(distinct customer_phone) filter (where status in ('accepted', 'preparing', 'ready', 'delivered'))
  ) into v
  from public.orders where created_at >= p_from and created_at < p_to;
  return v;
end $$;

create or replace function public.report_products(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.require_reports();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('product_id', p.id, 'name_ar', p.name_ar, 'name_en', p.name_en,
             'category', c.kind, 'is_active', p.is_active, 'is_available', p.is_available,
             'quantity', coalesce(x.qty, 0), 'revenue', coalesce(x.revenue, 0)) order by coalesce(x.qty, 0) desc, p.name_en)
    from public.products p
    join public.categories c on c.id = p.category_id
    left join (
      select i.product_id, sum(i.quantity) as qty, sum(i.line_total) as revenue
      from public.order_items i join public.orders o on o.id = i.order_id
      where o.created_at >= p_from and o.created_at < p_to and o.status in ('accepted', 'preparing', 'ready', 'delivered')
      group by i.product_id) x on x.product_id = p.id
    where p.deleted_at is null), '[]'::jsonb);
end $$;

create or replace function public.report_timeseries(p_from timestamptz, p_to timestamptz, p_bucket text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.require_reports(); tz text;
begin
  if p_bucket not in ('hour', 'day', 'week', 'month') then perform public.samat_error('invalid_request'); end if;
  select timezone into tz from public.store_settings where id = 1;
  return coalesce((
    select jsonb_agg(jsonb_build_object('bucket', b, 'revenue', revenue, 'orders', n) order by b)
    from (
      select date_trunc(p_bucket, o.created_at at time zone tz) as b, sum(o.total) as revenue, count(*) as n
      from public.orders o
      where o.created_at >= p_from and o.created_at < p_to and o.status in ('accepted', 'preparing', 'ready', 'delivered')
      group by 1) q), '[]'::jsonb);
end $$;

create or replace function public.report_hours(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.require_reports(); tz text;
begin
  select timezone into tz from public.store_settings where id = 1;
  return coalesce((
    select jsonb_agg(jsonb_build_object('hour', h, 'orders', n, 'revenue', revenue) order by h)
    from (
      select extract(hour from o.created_at at time zone tz)::int as h, count(*) as n, sum(o.total) as revenue
      from public.orders o
      where o.created_at >= p_from and o.created_at < p_to and o.status in ('accepted', 'preparing', 'ready', 'delivered')
      group by 1) q), '[]'::jsonb);
end $$;

create or replace function public.report_customizations(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.require_reports();
begin
  return jsonb_build_object(
    'sauces', coalesce((
      select jsonb_agg(jsonb_build_object('name_ar', name_ar, 'name_en', name_en, 'portions', n) order by n desc)
      from (select c.name_ar, c.name_en, sum(c.quantity * i.quantity) as n
            from public.order_customizations c join public.order_items i on i.id = c.order_item_id
            join public.orders o on o.id = i.order_id
            where c.kind = 'sauce' and c.action <> 'removed' and o.created_at >= p_from and o.created_at < p_to
              and o.status in ('accepted', 'preparing', 'ready', 'delivered')
            group by 1, 2) q), '[]'),
    'added', coalesce((
      select jsonb_agg(jsonb_build_object('name_ar', name_ar, 'name_en', name_en, 'times', n) order by n desc)
      from (select c.name_ar, c.name_en, sum(i.quantity) as n
            from public.order_customizations c join public.order_items i on i.id = c.order_item_id
            join public.orders o on o.id = i.order_id
            where c.kind = 'ingredient' and c.action in ('added', 'extra') and o.created_at >= p_from and o.created_at < p_to
              and o.status in ('accepted', 'preparing', 'ready', 'delivered')
            group by 1, 2) q), '[]'),
    'removed', coalesce((
      select jsonb_agg(jsonb_build_object('name_ar', name_ar, 'name_en', name_en, 'times', n) order by n desc)
      from (select c.name_ar, c.name_en, sum(i.quantity) as n
            from public.order_customizations c join public.order_items i on i.id = c.order_item_id
            join public.orders o on o.id = i.order_id
            where c.action = 'removed' and o.created_at >= p_from and o.created_at < p_to
              and o.status in ('accepted', 'preparing', 'ready', 'delivered')
            group by 1, 2) q), '[]'),
    'breads', coalesce((
      select jsonb_agg(jsonb_build_object('name_ar', name_ar, 'name_en', name_en, 'times', n) order by n desc)
      from (select c.name_ar, c.name_en, sum(i.quantity) as n
            from public.order_customizations c join public.order_items i on i.id = c.order_item_id
            join public.orders o on o.id = i.order_id
            where c.kind = 'bread' and o.created_at >= p_from and o.created_at < p_to
              and o.status in ('accepted', 'preparing', 'ready', 'delivered')
            group by 1, 2) q), '[]'));
end $$;

create or replace function public.inventory_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not (public.has_permission(uid, 'inventory.manage') or public.has_permission(uid, 'reports.view')
                         or public.has_permission(uid, 'dashboard.view')) then
    perform public.samat_error('forbidden', '{"permission":"inventory.manage"}');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'name_ar', i.name_ar, 'name_en', i.name_en, 'group', i.group_key,
             'unit', i.unit, 'on_hand', i.on_hand, 'reserved', i.on_hand - public.inventory_available(i.id),
             'available', public.inventory_available(i.id), 'low_threshold', i.low_threshold, 'is_active', i.is_active,
             'sold_30d', coalesce((select -sum(m.quantity) from public.inventory_movements m
                                   where m.inventory_id = i.id and m.movement = 'sale' and m.created_at > now() - interval '30 days'), 0),
             'is_low', public.inventory_available(i.id) <= i.low_threshold) order by i.group_key, i.name_en)
    from public.inventory i), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Guard: the restaurant always keeps at least one active owner.
-- ---------------------------------------------------------------------------------------------
create or replace function public.protect_last_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE' and old.role_key = 'owner')
     or (tg_op = 'UPDATE' and old.role_key = 'owner' and (new.role_key <> 'owner' or not new.is_active)) then
    if not exists (select 1 from public.staff_members where role_key = 'owner' and is_active and user_id <> old.user_id) then
      perform public.samat_error('last_owner');
    end if;
  end if;
  if tg_op = 'UPDATE' and new.role_key = 'owner' and old.role_key <> 'owner' and not public.is_owner(public.current_actor()) then
    perform public.samat_error('forbidden', '{"permission":"owner"}');
  end if;
  return coalesce(new, old);
end $$;
create trigger staff_members_owner_guard before update or delete on public.staff_members
  for each row execute function public.protect_last_owner();

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['permissions', 'roles', 'role_permissions', 'staff_members', 'staff_permission_overrides',
    'staff_invitations', 'profiles', 'store_settings', 'inventory', 'inventory_movements', 'categories', 'products',
    'ingredients', 'sauces', 'product_ingredients', 'product_sauces', 'option_groups', 'product_options', 'coupons',
    'loyalty_accounts', 'loyalty_rewards', 'audit_logs', 'rate_limits', 'order_counters', 'orders', 'order_items',
    'order_customizations', 'order_events', 'order_board', 'inventory_reservations', 'payments', 'payment_events',
    'invoices', 'notifications', 'coupon_redemptions', 'loyalty_transactions', 'loyalty_lot_usage', 'printer_jobs',
    'ai_pending_actions'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- reference data for staff
create policy staff_read on public.permissions for select to authenticated using (public.is_staff(auth.uid()));
create policy staff_read on public.roles for select to authenticated using (public.is_staff(auth.uid()));
create policy staff_read on public.role_permissions for select to authenticated using (public.is_staff(auth.uid()));

-- staff management (owner / staff.manage)
create policy self_or_manager_read on public.staff_members for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'staff.manage') or public.has_permission(auth.uid(), 'audit.view'));
create policy manager_update on public.staff_members for update to authenticated
  using (public.has_permission(auth.uid(), 'staff.manage') and (role_key <> 'owner' or public.is_owner(auth.uid())))
  with check (public.has_permission(auth.uid(), 'staff.manage') and (role_key <> 'owner' or public.is_owner(auth.uid())));
create policy manager_delete on public.staff_members for delete to authenticated
  using (public.has_permission(auth.uid(), 'staff.manage') and (role_key <> 'owner' or public.is_owner(auth.uid())) and user_id <> auth.uid());

create policy manager_all on public.staff_permission_overrides for all to authenticated
  using (public.has_permission(auth.uid(), 'staff.manage'))
  with check (public.has_permission(auth.uid(), 'staff.manage') and user_id <> auth.uid());
create policy self_read on public.staff_permission_overrides for select to authenticated using (user_id = auth.uid());

create policy manager_all on public.staff_invitations for all to authenticated
  using (public.has_permission(auth.uid(), 'staff.manage'))
  with check (public.has_permission(auth.uid(), 'staff.manage') and invited_by = auth.uid());

-- customers
create policy own_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission(auth.uid(), 'orders.view_pii'));
create policy own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- settings
create policy settings_read on public.store_settings for select to authenticated using (public.is_staff(auth.uid()));
create policy settings_update on public.store_settings for update to authenticated
  using (public.has_permission(auth.uid(), 'settings.manage')) with check (public.has_permission(auth.uid(), 'settings.manage'));

-- catalog: public read of what is published, menu managers write
create policy public_read on public.categories for select to anon, authenticated
  using (is_active or public.has_permission(auth.uid(), 'menu.manage'));
create policy menu_update on public.categories for update to authenticated
  using (public.has_permission(auth.uid(), 'menu.manage')) with check (public.has_permission(auth.uid(), 'menu.manage'));

create policy public_read on public.products for select to anon, authenticated
  using ((is_active and deleted_at is null) or public.has_permission(auth.uid(), 'menu.manage')
         or public.has_permission(auth.uid(), 'reports.view'));
create policy menu_insert on public.products for insert to authenticated with check (public.has_permission(auth.uid(), 'menu.manage'));
create policy menu_update on public.products for update to authenticated
  using (public.has_permission(auth.uid(), 'menu.manage')) with check (public.has_permission(auth.uid(), 'menu.manage'));
create policy menu_delete on public.products for delete to authenticated using (public.has_permission(auth.uid(), 'menu.manage'));

do $$
declare t text;
begin
  foreach t in array array['ingredients', 'sauces', 'product_ingredients', 'product_sauces', 'option_groups', 'product_options'] loop
    execute format('create policy public_read on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy menu_insert on public.%I for insert to authenticated with check (public.has_permission(auth.uid(), ''menu.manage''))', t);
    execute format('create policy menu_update on public.%I for update to authenticated using (public.has_permission(auth.uid(), ''menu.manage'')) with check (public.has_permission(auth.uid(), ''menu.manage''))', t);
    execute format('create policy menu_delete on public.%I for delete to authenticated using (public.has_permission(auth.uid(), ''menu.manage''))', t);
  end loop;
end $$;

-- inventory: readable by inventory and menu managers; quantities change only through functions
create policy inv_read on public.inventory for select to authenticated
  using (public.has_permission(auth.uid(), 'inventory.manage') or public.has_permission(auth.uid(), 'menu.manage'));
create policy inv_insert on public.inventory for insert to authenticated
  with check (public.has_permission(auth.uid(), 'inventory.manage') and on_hand = 0);
create policy inv_update on public.inventory for update to authenticated
  using (public.has_permission(auth.uid(), 'inventory.manage')) with check (public.has_permission(auth.uid(), 'inventory.manage'));
create policy inv_delete on public.inventory for delete to authenticated using (public.has_permission(auth.uid(), 'inventory.manage'));
create policy inv_read on public.inventory_movements for select to authenticated using (public.has_permission(auth.uid(), 'inventory.manage'));
create policy inv_read on public.inventory_reservations for select to authenticated using (public.has_permission(auth.uid(), 'inventory.manage'));

-- on_hand can only move through inventory_move()/orders (each move is a ledger entry)
create or replace function public.guard_on_hand() returns trigger
language plpgsql as $$
begin
  if new.on_hand is distinct from old.on_hand and current_user = 'authenticated' then
    perform public.samat_error('use_inventory_movements');
  end if;
  return new;
end $$;
create trigger inventory_on_hand_guard before update on public.inventory
  for each row execute function public.guard_on_hand();

-- coupons & loyalty
create policy coupons_all on public.coupons for all to authenticated
  using (public.has_permission(auth.uid(), 'coupons.manage')) with check (public.has_permission(auth.uid(), 'coupons.manage'));
create policy coupons_read on public.coupon_redemptions for select to authenticated using (public.has_permission(auth.uid(), 'coupons.manage'));

create policy own_read on public.loyalty_accounts for select to authenticated
  using (customer_id = auth.uid() or public.has_permission(auth.uid(), 'loyalty.manage'));
create policy own_read on public.loyalty_transactions for select to authenticated
  using (customer_id = auth.uid() or public.has_permission(auth.uid(), 'loyalty.manage'));
create policy public_read on public.loyalty_rewards for select to anon, authenticated
  using (is_active or public.has_permission(auth.uid(), 'loyalty.manage'));
create policy loyalty_write on public.loyalty_rewards for insert to authenticated with check (public.has_permission(auth.uid(), 'loyalty.manage'));
create policy loyalty_update on public.loyalty_rewards for update to authenticated
  using (public.has_permission(auth.uid(), 'loyalty.manage')) with check (public.has_permission(auth.uid(), 'loyalty.manage'));
create policy loyalty_delete on public.loyalty_rewards for delete to authenticated using (public.has_permission(auth.uid(), 'loyalty.manage'));

-- orders: customers see their own; staff with orders.view see all; status changes via functions only
create policy order_read on public.orders for select to authenticated
  using (customer_id = auth.uid() or public.has_permission(auth.uid(), 'orders.view'));
create policy order_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (o.customer_id = auth.uid() or public.has_permission(auth.uid(), 'orders.view'))));
create policy order_read on public.order_customizations for select to authenticated
  using (exists (select 1 from public.order_items i join public.orders o on o.id = i.order_id where i.id = order_item_id
                 and (o.customer_id = auth.uid() or public.has_permission(auth.uid(), 'orders.view'))));
create policy order_read on public.order_events for select to authenticated using (public.has_permission(auth.uid(), 'orders.view'));
create policy public_read on public.order_board for select to anon, authenticated using (business_day >= current_date - 1);
create policy order_read on public.payments for select to authenticated using (public.has_permission(auth.uid(), 'orders.view'));
create policy invoice_read on public.invoices for select to authenticated
  using (public.has_permission(auth.uid(), 'orders.view') or public.has_permission(auth.uid(), 'invoices.print')
         or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy notif_read on public.notifications for select to authenticated
  using (public.has_permission(auth.uid(), 'notifications.view') or public.has_permission(auth.uid(), 'orders.view'));
create policy audit_read on public.audit_logs for select to authenticated using (public.has_permission(auth.uid(), 'audit.view'));
create policy print_read on public.printer_jobs for select to authenticated using (public.has_permission(auth.uid(), 'invoices.print'));
create policy own_read on public.ai_pending_actions for select to authenticated using (requested_by = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Function privileges: nothing is callable by default; grant explicitly.
-- ---------------------------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function public.has_permission(uuid, text), public.is_staff(uuid), public.is_owner(uuid),
  public.menu_availability(), public.pickup_board(), public.samat_error(text, jsonb), public.current_actor()
  to anon, authenticated;

grant execute on function public.my_permissions(), public.require_permission(text), public.require_reports(),
  public.staff_accept_order(uuid), public.staff_reject_order(uuid, text), public.staff_cancel_order(uuid, text, boolean),
  public.staff_claim_decision(uuid), public.staff_release_decision(uuid), public.staff_set_ordering(jsonb),
  public.kitchen_set_status(uuid, public.order_status), public.kitchen_orders(),
  public.pickup_lookup(text), public.pickup_deliver(text),
  public.inventory_move(uuid, public.inventory_movement_type, numeric, text), public.inventory_set_count(uuid, numeric, text),
  public.inventory_status(), public.loyalty_adjust(uuid, int, text),
  public.report_overview(timestamptz, timestamptz), public.report_products(timestamptz, timestamptz),
  public.report_timeseries(timestamptz, timestamptz, text), public.report_hours(timestamptz, timestamptz),
  public.report_customizations(timestamptz, timestamptz)
  to authenticated;
-- Note: internal helpers (loyalty ledger, holds, audit, store_state, place_order, payment transitions)
-- are deliberately NOT granted: they run inside SECURITY DEFINER functions or from the server.

-- service_role (the Next.js server) can call everything
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------------------------
-- Realtime: only the PII-free board is published.
-- ---------------------------------------------------------------------------------------------
alter publication supabase_realtime add table public.order_board;

-- ---------------------------------------------------------------------------------------------
-- Storage: public bucket for menu imagery (uploads go through the server after a permission check)
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu', 'menu', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Scheduled jobs (pg_cron): expire unpaid orders every minute, expire loyalty points nightly.
-- The server also runs these from /api/cron for hosts without pg_cron.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('samat-expire-unpaid', '* * * * *', 'select public.expire_unpaid_orders()');
  perform cron.schedule('samat-expire-points', '17 0 * * *', 'select public.loyalty_expire_points()');
exception when others then
  raise notice 'pg_cron not available (%); use /api/cron instead', sqlerrm;
end $$;
