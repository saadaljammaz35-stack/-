-- SAMAT | سماط — ordering engine. Prices, discounts, stock and loyalty are decided here, inside one
-- transaction, never in the browser.

-- ---------------------------------------------------------------------------------------------
-- Triggers: public board + status history
-- ---------------------------------------------------------------------------------------------
create or replace function public.sync_order_board() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_board (order_id, order_number, business_day, status, ready_at, delivered_at, updated_at)
  values (new.id, new.order_number, new.business_day, new.status, new.ready_at, new.delivered_at, now())
  on conflict (order_id) do update
    set status = excluded.status, ready_at = excluded.ready_at,
        delivered_at = excluded.delivered_at, updated_at = now();
  return new;
end $$;

create trigger orders_board after insert or update of status, ready_at, delivered_at on public.orders
  for each row execute function public.sync_order_board();

create or replace function public.log_order_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_events (order_id, from_status, to_status, actor_id, actor_type, note)
    values (new.id,
            case when tg_op = 'UPDATE' then old.status end,
            new.status,
            public.current_actor(),
            coalesce(nullif(current_setting('samat.actor_type', true), ''),
                     case when auth.uid() is not null then 'staff' when tg_op = 'INSERT' then 'customer' else 'system' end),
            nullif(current_setting('samat.event_note', true), ''));
  end if;
  return new;
end $$;

create trigger orders_events after insert or update of status on public.orders
  for each row execute function public.log_order_event();

-- ---------------------------------------------------------------------------------------------
-- Pricing helpers
-- ---------------------------------------------------------------------------------------------
create or replace function public.jsonb_add_num(p_obj jsonb, p_key text, p_amount numeric) returns jsonb
language sql immutable as $$
  select p_obj || jsonb_build_object(p_key, coalesce((p_obj->>p_key)::numeric, 0) + p_amount)
$$;

-- Evaluate a coupon against priced lines. Returns {ok, discount, reason}.
create or replace function public.evaluate_coupon(p_coupon public.coupons, p_lines jsonb, p_subtotal int,
  p_phone text, p_customer_id uuid, p_exclude_order uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_eligible int := 0;
  v_line jsonb;
  v_used int;
  v_discount int;
  v_has_points boolean;
begin
  if not p_coupon.is_active then return jsonb_build_object('ok', false, 'reason', 'inactive'); end if;
  if p_coupon.starts_at is not null and now() < p_coupon.starts_at then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  if p_coupon.ends_at is not null and now() >= p_coupon.ends_at then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if p_subtotal < p_coupon.min_order then
    return jsonb_build_object('ok', false, 'reason', 'min_order', 'min_order', p_coupon.min_order);
  end if;

  if p_coupon.audience = 'specific' and (p_phone is null or p_phone <> p_coupon.customer_phone) then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible');
  elsif p_coupon.audience = 'new_customers' then
    if p_phone is null then return jsonb_build_object('ok', false, 'reason', 'needs_phone'); end if;
    if exists (select 1 from public.orders o where o.customer_phone = p_phone
               and o.status in ('accepted', 'preparing', 'ready', 'delivered')
               and (p_exclude_order is null or o.id <> p_exclude_order)) then
      return jsonb_build_object('ok', false, 'reason', 'not_eligible');
    end if;
  elsif p_coupon.audience = 'loyalty_members' then
    select exists (select 1 from public.loyalty_accounts where customer_id = p_customer_id) into v_has_points;
    if p_customer_id is null or not v_has_points then return jsonb_build_object('ok', false, 'reason', 'members_only'); end if;
  end if;

  if p_coupon.usage_limit is not null then
    select count(*) into v_used from public.coupon_redemptions r
    where r.coupon_id = p_coupon.id
      and (r.status = 'confirmed' or (r.status = 'reserved' and (r.expires_at is null or r.expires_at > now())))
      and (p_exclude_order is null or r.order_id <> p_exclude_order);
    if v_used >= p_coupon.usage_limit then return jsonb_build_object('ok', false, 'reason', 'used_up'); end if;
  end if;

  if p_coupon.per_customer_limit is not null and p_phone is not null then
    select count(*) into v_used from public.coupon_redemptions r
    where r.coupon_id = p_coupon.id and r.customer_phone = p_phone
      and (r.status = 'confirmed' or (r.status = 'reserved' and (r.expires_at is null or r.expires_at > now())))
      and (p_exclude_order is null or r.order_id <> p_exclude_order);
    if v_used >= p_coupon.per_customer_limit then return jsonb_build_object('ok', false, 'reason', 'customer_limit'); end if;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if (p_coupon.product_ids is null and p_coupon.category_kinds is null)
       or (p_coupon.product_ids is not null and (v_line->>'product_id')::uuid = any(p_coupon.product_ids))
       or (p_coupon.category_kinds is not null and (v_line->>'category_kind')::public.category_kind = any(p_coupon.category_kinds)) then
      v_eligible := v_eligible + (v_line->>'line_total')::int;
    end if;
  end loop;
  if v_eligible = 0 then return jsonb_build_object('ok', false, 'reason', 'no_eligible_items'); end if;

  if p_coupon.kind = 'percent' then
    v_discount := floor(v_eligible::numeric * p_coupon.value / 10000);
  else
    v_discount := least(p_coupon.value, v_eligible);
  end if;
  if p_coupon.max_discount is not null then v_discount := least(v_discount, p_coupon.max_discount); end if;
  v_discount := least(v_discount, p_subtotal);
  return jsonb_build_object('ok', v_discount > 0, 'discount', v_discount, 'reason', case when v_discount > 0 then null else 'no_discount' end);
end $$;

-- ---------------------------------------------------------------------------------------------
-- place_order: quote (dry run) or create an order atomically.
--
-- p = {
--   idempotency_key, customer: {name, phone, email, user_id, locale}, notes,
--   coupon_code, reward_id, redeem_points,
--   items: [{ product_id, quantity, notes, bread_id,
--             ingredients: {"<ingredient uuid>": qty, ...},   -- omitted = default quantity
--             sauces: {"<sauce uuid>": qty, ...},             -- omitted = default
--             options: ["<option uuid>", ...] }]
-- }
-- ---------------------------------------------------------------------------------------------
create or replace function public.place_order(p jsonb, p_dry_run boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.store_settings;
  v_state jsonb;
  v_existing public.orders;
  v_item jsonb;
  v_product public.products;
  v_kind public.category_kind;
  v_cat_active boolean;
  v_qty int;
  v_sel jsonb;
  v_sel_s jsonb;
  v_sel_o jsonb;
  v_desired int;
  v_unit int;
  v_charge int;
  v_extras int;
  v_action text;
  v_custom jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_need jsonb := '{}'::jsonb;
  v_subtotal int := 0;
  v_line_total int;
  v_idx int := 0;
  r record;
  v_bread_id uuid;
  v_bread record;
  v_bread_name_ar text;
  v_bread_name_en text;
  v_auto public.coupons;
  v_has_bread_choice boolean;
  v_group record;
  v_count int;
  v_key text;
  v_coupon public.coupons;
  v_coupon_eval jsonb;
  v_coupon_discount int := 0;
  v_coupon_error text := null;
  v_best jsonb;
  v_customer_id uuid := nullif(p->'customer'->>'user_id', '')::uuid;
  v_phone text := nullif(p->'customer'->>'phone', '');
  v_points int := 0;
  v_points_discount int := 0;
  v_reward public.loyalty_rewards;
  v_account public.loyalty_accounts;
  v_loyalty_error text := null;
  v_after_discount int;
  v_vat int := 0;
  v_total int;
  v_unavailable jsonb := '[]'::jsonb;
  v_inv record;
  v_avail numeric;
  v_order_id uuid;
  v_order_number int;
  v_day date;
  v_code text;
  v_expires timestamptz;
  v_item_id uuid;
  v_c jsonb;
  v_line jsonb;
  v_status public.order_status;
  v_pay_status public.payment_status;
  v_tracking text;
begin
  select * into s from public.store_settings where id = 1;
  v_state := public.store_state();

  if not p_dry_run then
    if coalesce(p->>'idempotency_key', '') !~ '^[A-Za-z0-9_-]{16,80}$' then
      perform public.samat_error('invalid_request', '{"field":"idempotency_key"}');
    end if;
    -- Same checkout submitted twice (double tap, retry, flaky network) -> same order.
    select * into v_existing from public.orders where idempotency_key = p->>'idempotency_key';
    if found then
      return jsonb_build_object('replay', true, 'order_id', v_existing.id, 'tracking_token', v_existing.tracking_token,
        'order_number', v_existing.order_number, 'total', v_existing.total, 'status', v_existing.status,
        'payment_required', v_existing.status = 'pending_payment', 'expires_at', v_existing.expires_at);
    end if;
    if not (v_state->>'can_order')::boolean then
      perform public.samat_error('store_' || (v_state->>'reason'), v_state);
    end if;
  end if;

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    perform public.samat_error('empty_cart');
  end if;
  if jsonb_array_length(p->'items') > 30 then
    perform public.samat_error('cart_too_large');
  end if;

  -- ------------------------------------------------------------------ price every line
  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_idx := v_idx + 1;
    select * into v_product from public.products
    where id = nullif(v_item->>'product_id', '')::uuid and deleted_at is null;
    if not found or not v_product.is_active or not v_product.is_available or v_product.base_price is null then
      perform public.samat_error('product_unavailable', jsonb_build_object('product_id', v_item->>'product_id', 'line', v_idx));
    end if;
    select c.kind, c.is_active into v_kind, v_cat_active from public.categories c where c.id = v_product.category_id;
    if not v_cat_active then
      perform public.samat_error('product_unavailable', jsonb_build_object('product_id', v_product.id, 'line', v_idx));
    end if;

    v_qty := coalesce((v_item->>'quantity')::int, 1);
    if v_qty < 1 or v_qty > 20 then
      perform public.samat_error('invalid_quantity', jsonb_build_object('line', v_idx));
    end if;
    if char_length(coalesce(v_item->>'notes', '')) > 200 then
      perform public.samat_error('notes_too_long', jsonb_build_object('line', v_idx));
    end if;

    v_extras := 0;
    v_custom := '[]'::jsonb;
    v_sel := coalesce(v_item->'ingredients', '{}'::jsonb);
    v_sel_s := coalesce(v_item->'sauces', '{}'::jsonb);
    v_sel_o := coalesce(v_item->'options', '[]'::jsonb);
    v_bread_name_ar := null;
    v_bread_name_en := null;

    if v_product.inventory_id is not null then
      v_need := public.jsonb_add_num(v_need, v_product.inventory_id::text, v_product.inventory_qty * v_qty);
    end if;

    -- reject ingredients/sauces/options that do not belong to this product
    for v_key in select jsonb_object_keys(v_sel) loop
      if not exists (select 1 from public.product_ingredients where product_id = v_product.id
                     and ingredient_id::text = v_key and role <> 'bread_choice') then
        perform public.samat_error('invalid_ingredient', jsonb_build_object('line', v_idx, 'ingredient_id', v_key));
      end if;
    end loop;
    for v_key in select jsonb_object_keys(v_sel_s) loop
      if not exists (select 1 from public.product_sauces where product_id = v_product.id and sauce_id::text = v_key) then
        perform public.samat_error('invalid_sauce', jsonb_build_object('line', v_idx, 'sauce_id', v_key));
      end if;
    end loop;
    for v_key in select jsonb_array_elements_text(v_sel_o) loop
      if not exists (select 1 from public.product_options where product_id = v_product.id and id::text = v_key) then
        perform public.samat_error('invalid_option', jsonb_build_object('line', v_idx, 'option_id', v_key));
      end if;
    end loop;

    -- bread choice (exactly one, can never be removed)
    v_has_bread_choice := exists (select 1 from public.product_ingredients
                                  where product_id = v_product.id and role = 'bread_choice');
    if v_has_bread_choice then
      v_bread_id := nullif(v_item->>'bread_id', '')::uuid;
      if v_bread_id is null then
        perform public.samat_error('bread_required', jsonb_build_object('line', v_idx));
      end if;
      select pi.*, g.name_ar, g.name_en, g.extra_price, g.is_active as g_active, g.inventory_id, g.inventory_qty
        into v_bread
      from public.product_ingredients pi join public.ingredients g on g.id = pi.ingredient_id
      where pi.product_id = v_product.id and pi.ingredient_id = v_bread_id and pi.role = 'bread_choice';
      if not found then
        perform public.samat_error('bread_required', jsonb_build_object('line', v_idx));
      end if;
      if not v_bread.g_active then
        perform public.samat_error('ingredient_unavailable', jsonb_build_object('line', v_idx, 'ingredient_id', v_bread_id));
      end if;
      v_bread_name_ar := v_bread.name_ar;
      v_bread_name_en := v_bread.name_en;
      v_unit := case when v_bread.is_free then 0 else coalesce(v_bread.price_override, v_bread.extra_price) end;
      v_extras := v_extras + v_unit;
      v_custom := v_custom || jsonb_build_object('kind', 'bread', 'ref_id', v_bread_id, 'name_ar', v_bread.name_ar,
        'name_en', v_bread.name_en, 'action', 'selected', 'quantity', 1, 'unit_price', v_unit, 'total_price', v_unit);
      if v_bread.inventory_id is not null then
        v_need := public.jsonb_add_num(v_need, v_bread.inventory_id::text, v_bread.inventory_qty * v_qty);
      end if;
    elsif v_item ? 'bread_id' and nullif(v_item->>'bread_id', '') is not null then
      perform public.samat_error('invalid_ingredient', jsonb_build_object('line', v_idx, 'ingredient_id', v_item->>'bread_id'));
    end if;

    -- ingredients
    for r in
      select pi.*, g.name_ar, g.name_en, g.extra_price, g.is_active as g_active, g.inventory_id, g.inventory_qty
      from public.product_ingredients pi join public.ingredients g on g.id = pi.ingredient_id
      where pi.product_id = v_product.id and pi.role <> 'bread_choice'
      order by pi.layer_order, pi.sort_order
    loop
      v_desired := coalesce((v_sel->>r.ingredient_id::text)::int, r.default_qty);
      if v_desired < 0 or v_desired > r.max_qty then
        perform public.samat_error('invalid_quantity', jsonb_build_object('line', v_idx, 'ingredient_id', r.ingredient_id));
      end if;
      if r.role = 'base' and v_desired < 1 then
        -- the bun / base can never be removed
        perform public.samat_error('base_required', jsonb_build_object('line', v_idx, 'ingredient_id', r.ingredient_id));
      end if;
      if v_desired > 0 and not r.g_active then
        perform public.samat_error('ingredient_unavailable', jsonb_build_object('line', v_idx, 'ingredient_id', r.ingredient_id));
      end if;

      v_unit := case when r.is_free then 0 else coalesce(r.price_override, r.extra_price) end;
      v_charge := case when r.role = 'extra' then v_desired else greatest(v_desired - r.default_qty, 0) end * v_unit;
      v_extras := v_extras + v_charge;

      v_action := case
        when r.role = 'extra' then case when v_desired > 0 then 'added' end
        when v_desired = 0 then 'removed'
        when v_desired > r.default_qty then 'extra'
        else 'included' end;
      if v_action is not null then
        v_custom := v_custom || jsonb_build_object('kind', 'ingredient', 'ref_id', r.ingredient_id,
          'name_ar', r.name_ar, 'name_en', r.name_en, 'action', v_action, 'quantity', v_desired,
          'unit_price', v_unit, 'total_price', v_charge, 'role', r.role);
      end if;
      if v_desired > 0 and r.inventory_id is not null then
        v_need := public.jsonb_add_num(v_need, r.inventory_id::text, r.inventory_qty * v_desired * v_qty);
      end if;
    end loop;

    -- sauces
    for r in
      select ps.*, sc.name_ar, sc.name_en, sc.price, sc.is_active as s_active, sc.inventory_id, sc.inventory_qty
      from public.product_sauces ps join public.sauces sc on sc.id = ps.sauce_id
      where ps.product_id = v_product.id
      order by ps.sort_order
    loop
      v_desired := coalesce((v_sel_s->>r.sauce_id::text)::int,
                            case when r.is_default then greatest(r.included_qty, 1) else 0 end);
      if v_desired < 0 or v_desired > r.max_qty then
        perform public.samat_error('invalid_quantity', jsonb_build_object('line', v_idx, 'sauce_id', r.sauce_id));
      end if;
      if v_desired > 0 and not r.s_active then
        perform public.samat_error('sauce_unavailable', jsonb_build_object('line', v_idx, 'sauce_id', r.sauce_id));
      end if;
      v_unit := coalesce(r.price_override, r.price);
      v_charge := greatest(v_desired - r.included_qty, 0) * v_unit;
      v_extras := v_extras + v_charge;
      v_action := case
        when v_desired = 0 and r.is_default then 'removed'
        when v_desired = 0 then null
        when v_desired > greatest(r.included_qty, 1) then 'extra'
        when r.is_default then 'included'
        else 'added' end;
      if v_action is not null then
        v_custom := v_custom || jsonb_build_object('kind', 'sauce', 'ref_id', r.sauce_id,
          'name_ar', r.name_ar, 'name_en', r.name_en, 'action', v_action, 'quantity', v_desired,
          'unit_price', v_unit, 'total_price', v_charge);
      end if;
      if v_desired > 0 and r.inventory_id is not null then
        v_need := public.jsonb_add_num(v_need, r.inventory_id::text, r.inventory_qty * v_desired * v_qty);
      end if;
    end loop;

    -- option groups (e.g. sizes)
    for v_group in select * from public.option_groups where product_id = v_product.id order by sort_order loop
      select count(*) into v_count from public.product_options po
      where po.group_id = v_group.id and po.id::text in (select jsonb_array_elements_text(v_sel_o));
      if v_group.is_required and v_count = 0 then
        perform public.samat_error('option_required', jsonb_build_object('line', v_idx, 'group_id', v_group.id));
      end if;
      if (v_group.selection = 'single' and v_count > 1) or v_count > v_group.max_select then
        perform public.samat_error('too_many_options', jsonb_build_object('line', v_idx, 'group_id', v_group.id));
      end if;
    end loop;
    for r in
      select po.* from public.product_options po
      where po.product_id = v_product.id and po.id::text in (select jsonb_array_elements_text(v_sel_o))
      order by po.sort_order
    loop
      if not r.is_active then
        perform public.samat_error('option_unavailable', jsonb_build_object('line', v_idx, 'option_id', r.id));
      end if;
      v_extras := v_extras + r.price_delta;
      v_custom := v_custom || jsonb_build_object('kind', 'option', 'ref_id', r.id, 'name_ar', r.name_ar,
        'name_en', r.name_en, 'action', 'selected', 'quantity', 1, 'unit_price', r.price_delta, 'total_price', r.price_delta);
      if r.inventory_id is not null then
        v_need := public.jsonb_add_num(v_need, r.inventory_id::text, r.inventory_qty * v_qty);
      end if;
    end loop;

    v_line_total := (v_product.base_price + v_extras) * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_lines := v_lines || jsonb_build_object(
      'line', v_idx,
      'product_id', v_product.id,
      'product_name_ar', v_product.name_ar,
      'product_name_en', v_product.name_en,
      'category_kind', v_kind,
      'builder', v_product.builder,
      'quantity', v_qty,
      'unit_base_price', v_product.base_price,
      'unit_extras_price', v_extras,
      'unit_price', v_product.base_price + v_extras,
      'line_total', v_line_total,
      'bread_name_ar', v_bread_name_ar,
      'bread_name_en', v_bread_name_en,
      'notes', nullif(btrim(coalesce(v_item->>'notes', '')), ''),
      'selection', jsonb_build_object('product_id', v_product.id, 'bread_id', v_item->'bread_id',
                     'ingredients', v_sel, 'sauces', v_sel_s, 'options', v_sel_o),
      'customizations', v_custom);
  end loop;

  -- ------------------------------------------------------------------ discounts
  if nullif(btrim(coalesce(p->>'coupon_code', '')), '') is not null then
    if p_dry_run then
      select * into v_coupon from public.coupons where code = btrim(p->>'coupon_code')::citext and not is_automatic;
    else
      select * into v_coupon from public.coupons where code = btrim(p->>'coupon_code')::citext and not is_automatic for update;
    end if;
    if not found then
      v_coupon_error := 'not_found';
    else
      v_coupon_eval := public.evaluate_coupon(v_coupon, v_lines, v_subtotal, v_phone, v_customer_id);
      if (v_coupon_eval->>'ok')::boolean then
        v_coupon_discount := (v_coupon_eval->>'discount')::int;
      else
        v_coupon_error := v_coupon_eval->>'reason';
        v_coupon := null;
      end if;
    end if;
    if v_coupon_error is not null and not p_dry_run then
      perform public.samat_error('coupon_invalid', jsonb_build_object('reason', v_coupon_error));
    end if;
  else
    -- best automatic offer, if any
    for v_auto in select * from public.coupons where is_automatic and is_active loop
      v_coupon_eval := public.evaluate_coupon(v_auto, v_lines, v_subtotal, v_phone, v_customer_id);
      if (v_coupon_eval->>'ok')::boolean and (v_coupon_eval->>'discount')::int > v_coupon_discount then
        v_coupon_discount := (v_coupon_eval->>'discount')::int;
        v_coupon := v_auto;
      end if;
    end loop;
    if v_coupon.id is not null and not p_dry_run then
      perform 1 from public.coupons where id = v_coupon.id for update;
      v_coupon_eval := public.evaluate_coupon(v_coupon, v_lines, v_subtotal, v_phone, v_customer_id);
      if not (v_coupon_eval->>'ok')::boolean then
        v_coupon := null; v_coupon_discount := 0;
      end if;
    end if;
  end if;

  v_after_discount := v_subtotal - v_coupon_discount;

  -- loyalty (signed-in customers only)
  if nullif(p->>'reward_id', '') is not null or coalesce((p->>'redeem_points')::int, 0) > 0 then
    if not s.loyalty_enabled then
      v_loyalty_error := 'disabled';
    elsif v_customer_id is null then
      v_loyalty_error := 'sign_in_required';
    else
      if p_dry_run then
        select * into v_account from public.loyalty_accounts where customer_id = v_customer_id;
      else
        select * into v_account from public.loyalty_accounts where customer_id = v_customer_id for update;
      end if;
      if nullif(p->>'reward_id', '') is not null then
        select * into v_reward from public.loyalty_rewards where id = (p->>'reward_id')::uuid and is_active;
        if not found then
          v_loyalty_error := 'reward_unavailable';
        else
          v_points := v_reward.points_cost;
          if v_reward.reward_type = 'discount_fixed' then
            v_points_discount := v_reward.value;
          else
            select min((l->>'unit_base_price')::int) into v_points_discount from jsonb_array_elements(v_lines) l
            where (l->>'product_id')::uuid = v_reward.product_id;
            if v_points_discount is null then v_loyalty_error := 'reward_product_missing'; v_points_discount := 0; end if;
          end if;
        end if;
      else
        v_points := (p->>'redeem_points')::int;
        if v_points < s.loyalty_min_redeem_points then v_loyalty_error := 'below_minimum'; end if;
        v_points_discount := v_points * s.loyalty_point_value_halalas;
      end if;
      if v_loyalty_error is null and coalesce(v_account.balance, 0) < v_points then
        v_loyalty_error := 'insufficient_points';
      end if;
      v_points_discount := least(v_points_discount, v_after_discount);
    end if;
    if v_loyalty_error is not null then
      if not p_dry_run then
        perform public.samat_error('loyalty_invalid', jsonb_build_object('reason', v_loyalty_error));
      end if;
      v_points := 0; v_points_discount := 0;
    end if;
  end if;

  v_after_discount := v_after_discount - v_points_discount;

  -- VAT
  if s.vat_enabled and s.vat_rate_bps > 0 then
    if s.prices_include_vat then
      v_vat := round(v_after_discount::numeric * s.vat_rate_bps / (10000 + s.vat_rate_bps));
      v_total := v_after_discount;
    else
      v_vat := round(v_after_discount::numeric * s.vat_rate_bps / 10000);
      v_total := v_after_discount + v_vat;
    end if;
  else
    v_total := v_after_discount;
  end if;

  -- ------------------------------------------------------------------ stock
  if not p_dry_run then
    -- Lock every stock row this order needs, always in id order: concurrent checkouts for the
    -- same items serialize here (no overselling) and can never deadlock each other.
    perform 1 from public.inventory i where i.id::text in (select jsonb_object_keys(v_need)) order by i.id for update;
  end if;
  for v_inv in
    select i.id, i.name_ar, i.name_en, i.is_active, (v_need->>i.id::text)::numeric as need
    from public.inventory i
    where i.id::text in (select jsonb_object_keys(v_need))
    order by i.id
  loop
    v_avail := public.inventory_available(v_inv.id);
    if not v_inv.is_active or v_avail < v_inv.need then
      v_unavailable := v_unavailable || jsonb_build_object('inventory_id', v_inv.id, 'name_ar', v_inv.name_ar,
        'name_en', v_inv.name_en, 'available', greatest(floor(v_avail), 0));
    end if;
  end loop;

  if p_dry_run then
    return jsonb_build_object(
      'lines', v_lines, 'subtotal', v_subtotal,
      'coupon', case when v_coupon.id is not null then jsonb_build_object('id', v_coupon.id, 'code', v_coupon.code,
                  'title_ar', v_coupon.title_ar, 'title_en', v_coupon.title_en, 'automatic', v_coupon.is_automatic) end,
      'coupon_discount', v_coupon_discount, 'coupon_error', v_coupon_error,
      'points_redeemed', v_points, 'points_discount', v_points_discount, 'loyalty_error', v_loyalty_error,
      'discount_total', v_coupon_discount + v_points_discount,
      'vat_amount', v_vat, 'vat_rate_bps', case when s.vat_enabled then s.vat_rate_bps else 0 end,
      'prices_include_vat', s.prices_include_vat, 'total', v_total,
      'unavailable', v_unavailable, 'store', v_state,
      'can_order', (v_state->>'can_order')::boolean and jsonb_array_length(v_unavailable) = 0);
  end if;

  if jsonb_array_length(v_unavailable) > 0 then
    perform public.samat_error('out_of_stock', jsonb_build_object('items', v_unavailable));
  end if;

  -- ------------------------------------------------------------------ create
  v_day := (now() at time zone s.timezone)::date;
  insert into public.order_counters (day, last_number) values (v_day, 1)
  on conflict (day) do update set last_number = public.order_counters.last_number + 1
  returning last_number into v_order_number;

  if v_total = 0 then
    v_status := 'awaiting_approval'; v_pay_status := 'not_required'; v_expires := null;
  else
    v_status := 'pending_payment'; v_pay_status := 'unpaid';
    v_expires := now() + make_interval(mins => s.unpaid_order_ttl_minutes);
  end if;

  perform set_config('samat.actor_type', 'customer', true);
  loop
    v_code := public.random_code(6);
    begin
      insert into public.orders (order_number, business_day, pickup_code, idempotency_key, status, payment_status,
        customer_id, customer_name, customer_phone, customer_email, locale, notes,
        subtotal, discount_total, coupon_discount, points_discount, vat_amount, total,
        vat_rate_bps, prices_include_vat, coupon_id, coupon_code, loyalty_reward_id, points_redeemed,
        prep_minutes, expires_at, paid_at)
      values (v_order_number, v_day, v_code, p->>'idempotency_key', v_status, v_pay_status,
        v_customer_id, btrim(p->'customer'->>'name'), v_phone, nullif(btrim(coalesce(p->'customer'->>'email', '')), ''),
        coalesce(nullif(p->'customer'->>'locale', ''), 'ar'), nullif(btrim(coalesce(p->>'notes', '')), ''),
        v_subtotal, v_coupon_discount + v_points_discount, v_coupon_discount, v_points_discount, v_vat, v_total,
        case when s.vat_enabled then s.vat_rate_bps else 0 end, s.prices_include_vat,
        v_coupon.id, v_coupon.code, v_reward.id, v_points,
        (v_state->>'prep_minutes')::int, v_expires, case when v_total = 0 then now() end)
      returning id, tracking_token into v_order_id, v_tracking;
      exit;
    exception when unique_violation then
      -- pickup code collision (astronomically rare) or a concurrent duplicate submission
      select * into v_existing from public.orders where idempotency_key = p->>'idempotency_key';
      if found then
        return jsonb_build_object('replay', true, 'order_id', v_existing.id, 'tracking_token', v_existing.tracking_token,
          'order_number', v_existing.order_number, 'total', v_existing.total, 'status', v_existing.status,
          'payment_required', v_existing.status = 'pending_payment', 'expires_at', v_existing.expires_at);
      end if;
    end;
  end loop;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    insert into public.order_items (order_id, product_id, product_name_ar, product_name_en, category_kind, builder,
      quantity, unit_base_price, unit_extras_price, unit_price, line_total, bread_name_ar, bread_name_en, notes,
      selection, sort_order)
    values (v_order_id, (v_line->>'product_id')::uuid, v_line->>'product_name_ar', v_line->>'product_name_en',
      (v_line->>'category_kind')::public.category_kind, (v_line->>'builder')::public.builder_type,
      (v_line->>'quantity')::int, (v_line->>'unit_base_price')::int, (v_line->>'unit_extras_price')::int,
      (v_line->>'unit_price')::int, (v_line->>'line_total')::int, v_line->>'bread_name_ar', v_line->>'bread_name_en',
      v_line->>'notes', v_line->'selection', (v_line->>'line')::int)
    returning id into v_item_id;

    v_idx := 0;
    for v_c in select * from jsonb_array_elements(v_line->'customizations') loop
      v_idx := v_idx + 1;
      insert into public.order_customizations (order_item_id, kind, ref_id, name_ar, name_en, action, quantity,
        unit_price, total_price, sort_order)
      values (v_item_id, v_c->>'kind', (v_c->>'ref_id')::uuid, v_c->>'name_ar', v_c->>'name_en', v_c->>'action',
        (v_c->>'quantity')::int, (v_c->>'unit_price')::int, (v_c->>'total_price')::int, v_idx);
    end loop;
  end loop;

  -- hold stock until payment (expires with the unpaid order) / until the restaurant decides
  insert into public.inventory_reservations (order_id, inventory_id, quantity, expires_at)
  select v_order_id, k::uuid, (v_need->>k)::numeric, v_expires from jsonb_object_keys(v_need) k;

  if v_coupon.id is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, customer_phone, customer_id, amount, status, expires_at)
    values (v_coupon.id, v_order_id, v_phone, v_customer_id, v_coupon_discount,
            case when v_total = 0 then 'confirmed' else 'reserved' end, v_expires);
  end if;

  if v_points > 0 then
    perform public.loyalty_debit(v_customer_id, v_points, 'redeem', v_order_id, null);
  end if;

  return jsonb_build_object('replay', false, 'order_id', v_order_id, 'tracking_token', v_tracking,
    'order_number', v_order_number, 'total', v_total, 'status', v_status,
    'payment_required', v_total > 0, 'expires_at', v_expires);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Loyalty ledger primitives
-- ---------------------------------------------------------------------------------------------
create table public.loyalty_lot_usage (
  debit_txn_id bigint not null references public.loyalty_transactions(id) on delete cascade,
  lot_txn_id bigint not null references public.loyalty_transactions(id) on delete cascade,
  points int not null check (points > 0),
  primary key (debit_txn_id, lot_txn_id)
);

alter table public.loyalty_transactions drop constraint loyalty_lot_shape;
alter table public.loyalty_transactions add constraint loyalty_lot_shape
  check (remaining is null or (type in ('earn', 'adjust', 'refund_redeem') and points > 0 and remaining between 0 and points));

-- Credit points as a new lot (earn / positive adjust / refund of a redemption).
create or replace function public.loyalty_credit(p_customer uuid, p_points int, p_type public.loyalty_txn_type,
  p_order uuid, p_note text, p_expires timestamptz) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.loyalty_accounts (customer_id) values (p_customer) on conflict do nothing;
  perform 1 from public.loyalty_accounts where customer_id = p_customer for update;
  insert into public.loyalty_transactions (customer_id, order_id, type, points, remaining, expires_at, note, actor_id)
  values (p_customer, p_order, p_type, p_points, p_points, p_expires, p_note, public.current_actor())
  returning id into v_id;
  update public.loyalty_accounts
     set balance = balance + p_points,
         lifetime_earned = lifetime_earned + case when p_type = 'earn' then p_points else 0 end,
         updated_at = now()
   where customer_id = p_customer;
  return v_id;
end $$;

-- Debit points FIFO from unexpired lots (redeem / reverse_earn / expire / negative adjust).
create or replace function public.loyalty_debit(p_customer uuid, p_points int, p_type public.loyalty_txn_type,
  p_order uuid, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_left int := p_points; v_take int; lot record; v_balance int;
begin
  insert into public.loyalty_accounts (customer_id) values (p_customer) on conflict do nothing;
  select balance into v_balance from public.loyalty_accounts where customer_id = p_customer for update;
  if v_balance < p_points then
    perform public.samat_error('loyalty_invalid', '{"reason":"insufficient_points"}');
  end if;
  insert into public.loyalty_transactions (customer_id, order_id, type, points, note, actor_id)
  values (p_customer, p_order, p_type, -p_points, p_note, public.current_actor())
  returning id into v_id;
  for lot in
    select id, remaining from public.loyalty_transactions
    where customer_id = p_customer and remaining > 0 and (expires_at is null or expires_at > now())
    order by expires_at nulls last, id
    for update
  loop
    exit when v_left = 0;
    v_take := least(lot.remaining, v_left);
    update public.loyalty_transactions set remaining = remaining - v_take where id = lot.id;
    insert into public.loyalty_lot_usage (debit_txn_id, lot_txn_id, points) values (v_id, lot.id, v_take);
    v_left := v_left - v_take;
  end loop;
  update public.loyalty_accounts set balance = balance - p_points, updated_at = now() where customer_id = p_customer;
  return v_id;
end $$;

-- Give back the points an order redeemed (payment failed, expired, rejected, cancelled).
create or replace function public.loyalty_refund_redeem(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_txn public.loyalty_transactions; u record;
begin
  select * into v_txn from public.loyalty_transactions where order_id = p_order and type = 'redeem';
  if not found then return; end if;
  if exists (select 1 from public.loyalty_transactions where order_id = p_order and type = 'refund_redeem') then return; end if;
  perform 1 from public.loyalty_accounts where customer_id = v_txn.customer_id for update;
  -- put the points back into the same lots (they keep their original expiry)
  for u in select * from public.loyalty_lot_usage where debit_txn_id = v_txn.id loop
    update public.loyalty_transactions set remaining = remaining + u.points where id = u.lot_txn_id;
  end loop;
  insert into public.loyalty_transactions (customer_id, order_id, type, points, note, actor_id)
  values (v_txn.customer_id, p_order, 'refund_redeem', -v_txn.points, 'Order not completed', public.current_actor());
  update public.loyalty_accounts set balance = balance - v_txn.points, updated_at = now()
   where customer_id = v_txn.customer_id;
end $$;

-- Award points once the order has been handed over.
create or replace function public.loyalty_earn_for_order(p_order uuid) returns int
language plpgsql security definer set search_path = public as $$
declare o public.orders; s public.store_settings; v_points int;
begin
  select * into s from public.store_settings where id = 1;
  select * into o from public.orders where id = p_order;
  if not s.loyalty_enabled or o.customer_id is null or o.status <> 'delivered' then return 0; end if;
  if exists (select 1 from public.loyalty_transactions where order_id = p_order and type = 'earn') then return 0; end if;
  v_points := floor((o.total::numeric / 100) * s.loyalty_points_per_sar);
  if v_points <= 0 then return 0; end if;
  perform public.loyalty_credit(o.customer_id, v_points, 'earn', p_order, null,
    case when s.loyalty_expiry_days is not null then now() + make_interval(days => s.loyalty_expiry_days) end);
  update public.orders set points_earned = v_points where id = p_order;
  return v_points;
end $$;

-- Reverse earned points when a delivered order is refunded (clamped to the current balance).
create or replace function public.loyalty_reverse_for_order(p_order uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_earn public.loyalty_transactions; v_balance int; v_points int;
begin
  select * into v_earn from public.loyalty_transactions where order_id = p_order and type = 'earn';
  if not found then return 0; end if;
  if exists (select 1 from public.loyalty_transactions where order_id = p_order and type = 'reverse_earn') then return 0; end if;
  select balance into v_balance from public.loyalty_accounts where customer_id = v_earn.customer_id for update;
  v_points := least(v_earn.points, v_balance);
  if v_points > 0 then
    perform public.loyalty_debit(v_earn.customer_id, v_points, 'reverse_earn', p_order, 'Order refunded');
  end if;
  return v_points;
end $$;

create or replace function public.loyalty_expire_points() returns int
language plpgsql security definer set search_path = public as $$
declare lot record; v_total int := 0; v_id bigint;
begin
  for lot in
    select * from public.loyalty_transactions
    where remaining > 0 and expires_at is not null and expires_at <= now()
    for update
  loop
    perform 1 from public.loyalty_accounts where customer_id = lot.customer_id for update;
    insert into public.loyalty_transactions (customer_id, type, points, note)
    values (lot.customer_id, 'expire', -lot.remaining, 'Points expired') returning id into v_id;
    insert into public.loyalty_lot_usage (debit_txn_id, lot_txn_id, points) values (v_id, lot.id, lot.remaining);
    update public.loyalty_accounts set balance = balance - lot.remaining, updated_at = now() where customer_id = lot.customer_id;
    update public.loyalty_transactions set remaining = 0 where id = lot.id;
    v_total := v_total + lot.remaining;
  end loop;
  return v_total;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Releasing holds when an order does not go ahead
-- ---------------------------------------------------------------------------------------------
create or replace function public.release_order_holds(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.inventory_reservations set status = 'released', updated_at = now()
   where order_id = p_order and status = 'held';
  update public.coupon_redemptions set status = 'released', updated_at = now()
   where order_id = p_order and status in ('reserved', 'confirmed');
  perform public.loyalty_refund_redeem(p_order);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Payment transitions (server / webhook only, after verifying with the gateway)
-- ---------------------------------------------------------------------------------------------
-- p_payment = {provider, provider_payment_id, payment_row_id, amount, status ('authorized'|'paid'),
--              method, card_scheme, card_last4, live}
create or replace function public.mark_order_paid(p_order uuid, p_payment jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_status public.payment_status := (p_payment->>'status')::public.payment_status;
  v_short jsonb;
  v_need record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  if v_status not in ('authorized', 'paid') then perform public.samat_error('invalid_payment_status'); end if;
  if (p_payment->>'amount')::int <> o.total then
    perform public.samat_error('payment_amount_mismatch', jsonb_build_object('expected', o.total, 'got', p_payment->>'amount'));
  end if;

  update public.payments
     set provider_payment_id = p_payment->>'provider_payment_id', status = v_status,
         method = p_payment->>'method', card_scheme = p_payment->>'card_scheme', card_last4 = p_payment->>'card_last4',
         captured_amount = case when v_status = 'paid' then o.total else captured_amount end,
         live = (p_payment->>'live')::boolean
   where id = (p_payment->>'payment_row_id')::uuid and order_id = p_order;

  -- Idempotent: callback and webhook may both arrive.
  if o.status <> 'pending_payment' and o.status not in ('expired', 'payment_failed') then
    return jsonb_build_object('transitioned', false, 'status', o.status);
  end if;

  if o.status in ('expired', 'payment_failed') and o.points_redeemed > 0 then
    update public.orders set payment_status = v_status, paid_at = now() where id = p_order;
    return jsonb_build_object('transitioned', false, 'status', o.status, 'needs_refund', true, 'reason', 'expired');
  end if;
  if o.status in ('expired', 'payment_failed') then
    -- The customer paid after the hold lapsed. Re-check stock; if it is gone the server refunds.
    v_short := '[]'::jsonb;
    for v_need in select r.inventory_id, r.quantity from public.inventory_reservations r
                  where r.order_id = p_order order by r.inventory_id loop
      perform 1 from public.inventory where id = v_need.inventory_id for update;
      if public.inventory_available(v_need.inventory_id, p_order) < v_need.quantity then
        v_short := v_short || to_jsonb(v_need.inventory_id);
      end if;
    end loop;
    if jsonb_array_length(v_short) > 0 then
      update public.orders set payment_status = v_status, paid_at = now() where id = p_order;
      return jsonb_build_object('transitioned', false, 'status', o.status, 'needs_refund', true, 'reason', 'out_of_stock');
    end if;
    update public.inventory_reservations set status = 'held', updated_at = now() where order_id = p_order;
    update public.coupon_redemptions set status = 'reserved' where order_id = p_order and status = 'released';
  end if;

  perform set_config('samat.actor_type', 'payment', true);
  update public.orders
     set status = 'awaiting_approval', payment_status = v_status, paid_at = now(), expires_at = null
   where id = p_order;
  update public.inventory_reservations set expires_at = null, updated_at = now() where order_id = p_order and status = 'held';
  update public.coupon_redemptions set status = 'confirmed', expires_at = null, updated_at = now()
   where order_id = p_order and status = 'reserved';
  return jsonb_build_object('transitioned', true, 'status', 'awaiting_approval');
end $$;

create or replace function public.mark_payment_failed(p_order uuid, p_payment_row uuid, p_provider_payment_id text,
  p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  update public.payments set status = 'failed', provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         failure_message = left(p_message, 300)
   where id = p_payment_row and order_id = p_order and status in ('initiated', 'failed');
  -- A failed attempt does not kill the order: the customer may retry until it expires.
  return jsonb_build_object('status', o.status);
end $$;

create or replace function public.expire_unpaid_orders() returns int
language plpgsql security definer set search_path = public as $$
declare o record; n int := 0;
begin
  perform set_config('samat.actor_type', 'system', true);
  for o in select id from public.orders where status = 'pending_payment' and expires_at < now() for update skip locked loop
    update public.orders set status = 'expired' where id = o.id;
    perform public.release_order_holds(o.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Record capture / void / refund results reported by the gateway.
create or replace function public.record_payment_update(p_payment_row uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_order uuid; v_status public.payment_status := (p->>'status')::public.payment_status;
begin
  update public.payments
     set status = v_status,
         captured_amount = coalesce((p->>'captured_amount')::int, captured_amount),
         refunded_amount = coalesce((p->>'refunded_amount')::int, refunded_amount),
         failure_message = coalesce(left(p->>'message', 300), failure_message)
   where id = p_payment_row
   returning order_id into v_order;
  if v_order is not null then
    update public.orders set payment_status = v_status where id = v_order;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Staff transitions (run with the staff member's JWT; permission checked here as well)
-- ---------------------------------------------------------------------------------------------
create or replace function public.staff_accept_order(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_permission('orders.manage');
  o public.orders;
  s public.store_settings;
  r record;
  v_balance numeric;
  v_prep int;
  v_inv_no text;
  v_seller text;
  v_ex int;
begin
  select * into s from public.store_settings where id = 1;
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  if o.status <> 'awaiting_approval' then
    perform public.samat_error('invalid_transition', jsonb_build_object('from', o.status, 'to', 'accepted'));
  end if;
  if o.payment_status not in ('paid', 'not_required') then
    -- authorised payments must be captured (by the server, with the gateway) before acceptance
    perform public.samat_error('payment_not_captured', jsonb_build_object('payment_status', o.payment_status));
  end if;

  -- convert held stock into real deductions (once per order per item)
  for r in select * from public.inventory_reservations where order_id = p_order and status = 'held' order by inventory_id loop
    update public.inventory set on_hand = on_hand - r.quantity where id = r.inventory_id returning on_hand into v_balance;
    insert into public.inventory_movements (inventory_id, movement, quantity, balance_after, order_id, actor_id)
    values (r.inventory_id, 'sale', -r.quantity, v_balance, p_order, uid);
    update public.inventory_reservations set status = 'committed', updated_at = now() where id = r.id;
  end loop;

  v_prep := s.base_prep_minutes + case when s.busy_mode then s.busy_extra_minutes else 0 end;
  update public.orders
     set status = 'accepted', accepted_at = now(), accepted_by = uid,
         prep_minutes = v_prep, estimated_ready_at = now() + make_interval(mins => v_prep)
   where id = p_order;

  -- simplified tax invoice
  v_seller := coalesce(s.legal_name, s.branch_name_ar);
  v_ex := o.total - o.vat_amount;
  v_inv_no := 'INV-' || to_char(now() at time zone s.timezone, 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0');
  insert into public.invoices (order_id, invoice_number, seller_name, vat_number, subtotal_ex_vat, vat_amount, total)
  values (p_order, v_inv_no, v_seller, s.vat_number, v_ex, o.vat_amount, o.total)
  on conflict (order_id) do nothing;

  perform public.write_audit('order.accept', 'orders', p_order::text, null, null,
    jsonb_build_object('order_number', o.order_number));
  return jsonb_build_object('status', 'accepted', 'estimated_ready_at', now() + make_interval(mins => v_prep),
                            'invoice_number', v_inv_no);
end $$;

create or replace function public.staff_reject_order(p_order uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('orders.manage'); o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  if o.status <> 'awaiting_approval' then
    perform public.samat_error('invalid_transition', jsonb_build_object('from', o.status, 'to', 'rejected'));
  end if;
  perform set_config('samat.event_note', left(coalesce(p_reason, ''), 300), true);
  update public.orders
     set status = 'rejected', rejected_at = now(), rejected_by = uid, reject_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
         payment_status = case when payment_status in ('paid', 'authorized') then 'refund_pending'::public.payment_status else payment_status end
   where id = p_order;
  perform public.release_order_holds(p_order);
  perform public.write_audit('order.reject', 'orders', p_order::text, null, null,
    jsonb_build_object('order_number', o.order_number, 'reason', p_reason));
  return jsonb_build_object('status', 'rejected', 'payment_status', o.payment_status,
                            'refund_needed', o.payment_status in ('paid', 'authorized'));
end $$;

create or replace function public.staff_cancel_order(p_order uuid, p_reason text, p_restock boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('orders.manage'); o public.orders; m record; v_balance numeric;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  if o.status not in ('accepted', 'preparing', 'ready') then
    perform public.samat_error('invalid_transition', jsonb_build_object('from', o.status, 'to', 'cancelled'));
  end if;
  perform set_config('samat.event_note', left(coalesce(p_reason, ''), 300), true);
  update public.orders
     set status = 'cancelled', cancelled_at = now(), cancelled_by = uid, cancel_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
         payment_status = case when payment_status = 'paid' then 'refund_pending'::public.payment_status else payment_status end
   where id = p_order;
  if p_restock then
    for m in select inventory_id, -quantity as qty from public.inventory_movements
             where order_id = p_order and movement = 'sale' loop
      update public.inventory set on_hand = on_hand + m.qty where id = m.inventory_id returning on_hand into v_balance;
      insert into public.inventory_movements (inventory_id, movement, quantity, balance_after, order_id, actor_id, note)
      values (m.inventory_id, 'cancel_return', m.qty, v_balance, p_order, uid, 'Order cancelled');
    end loop;
  end if;
  update public.coupon_redemptions set status = 'released', updated_at = now() where order_id = p_order;
  perform public.loyalty_refund_redeem(p_order);
  update public.invoices set status = 'credited', credited_at = now() where order_id = p_order;
  perform public.write_audit('order.cancel', 'orders', p_order::text, null, null,
    jsonb_build_object('order_number', o.order_number, 'reason', p_reason, 'restock', p_restock));
  return jsonb_build_object('status', 'cancelled', 'refund_needed', o.payment_status = 'paid');
end $$;

-- Kitchen display: accepted -> preparing -> ready -> delivered.
create or replace function public.kitchen_set_status(p_order uuid, p_status public.order_status) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; o public.orders; v_points int := 0;
begin
  if p_status = 'delivered' then
    uid := auth.uid();
    if uid is null or not (public.has_permission(uid, 'kitchen.update') or public.has_permission(uid, 'pickup.verify')) then
      perform public.samat_error('forbidden', '{"permission":"kitchen.update"}');
    end if;
  else
    uid := public.require_permission('kitchen.update');
  end if;
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  if not ((o.status = 'accepted' and p_status in ('preparing', 'ready'))
       or (o.status = 'preparing' and p_status = 'ready')
       or (o.status = 'ready' and p_status = 'delivered')) then
    perform public.samat_error('invalid_transition', jsonb_build_object('from', o.status, 'to', p_status));
  end if;
  update public.orders
     set status = p_status,
         preparing_at = case when p_status = 'preparing' then now() else preparing_at end,
         ready_at = case when p_status = 'ready' then now() else ready_at end,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
         delivered_by = case when p_status = 'delivered' then uid else delivered_by end
   where id = p_order;
  if p_status = 'delivered' then
    v_points := public.loyalty_earn_for_order(p_order);
  end if;
  return jsonb_build_object('status', p_status, 'points_earned', v_points);
end $$;

-- Counter: look up an order by the QR token or the typed pickup code.
create or replace function public.pickup_lookup(p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('pickup.verify'); o public.orders; v_by text;
begin
  select * into o from public.orders
  where pickup_token = btrim(p_ref) or pickup_code = upper(regexp_replace(btrim(p_ref), '[^A-Za-z0-9]', '', 'g'));
  if not found then return jsonb_build_object('found', false); end if;
  if o.delivered_by is not null then select email into v_by from auth.users where id = o.delivered_by; end if;
  return jsonb_build_object('found', true, 'order_id', o.id, 'order_number', o.order_number, 'status', o.status,
    'customer_name', o.customer_name, 'total', o.total, 'payment_status', o.payment_status,
    'delivered_at', o.delivered_at, 'delivered_by_email', v_by, 'ready_at', o.ready_at);
end $$;

-- Counter: hand over. Atomic: a code can only ever complete one handover.
create or replace function public.pickup_deliver(p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('pickup.verify'); o public.orders; v_by text; v_points int;
begin
  select * into o from public.orders
  where pickup_token = btrim(p_ref) or pickup_code = upper(regexp_replace(btrim(p_ref), '[^A-Za-z0-9]', '', 'g'))
  for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if o.status = 'delivered' then
    select email into v_by from auth.users where id = o.delivered_by;
    return jsonb_build_object('ok', false, 'reason', 'already_delivered', 'order_id', o.id, 'order_number', o.order_number,
                              'delivered_at', o.delivered_at, 'delivered_by_email', v_by);
  end if;
  if o.status <> 'ready' then
    return jsonb_build_object('ok', false, 'reason', 'not_ready', 'status', o.status, 'order_id', o.id, 'order_number', o.order_number);
  end if;
  update public.orders set status = 'delivered', delivered_at = now(), delivered_by = uid where id = o.id;
  v_points := public.loyalty_earn_for_order(o.id);
  perform public.write_audit('order.handover', 'orders', o.id::text, null, null,
    jsonb_build_object('order_number', o.order_number));
  return jsonb_build_object('ok', true, 'order_id', o.id, 'order_number', o.order_number, 'points_earned', v_points,
                            'delivered_at', now());
end $$;

-- ---------------------------------------------------------------------------------------------
-- Inventory administration
-- ---------------------------------------------------------------------------------------------
create or replace function public.inventory_move(p_inventory uuid, p_movement public.inventory_movement_type,
  p_quantity numeric, p_note text) returns numeric
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('inventory.manage'); v_balance numeric;
begin
  if p_movement not in ('purchase', 'adjustment', 'waste', 'correction') then
    perform public.samat_error('invalid_request', '{"field":"movement"}');
  end if;
  if p_quantity = 0 then perform public.samat_error('invalid_quantity'); end if;
  if p_movement = 'purchase' and p_quantity < 0 then perform public.samat_error('invalid_quantity'); end if;
  if p_movement = 'waste' and p_quantity > 0 then p_quantity := -p_quantity; end if;
  update public.inventory set on_hand = on_hand + p_quantity,
         low_alert_sent_at = case when on_hand + p_quantity > low_threshold then null else low_alert_sent_at end
   where id = p_inventory returning on_hand into v_balance;
  if not found then perform public.samat_error('not_found'); end if;
  insert into public.inventory_movements (inventory_id, movement, quantity, balance_after, actor_id, note)
  values (p_inventory, p_movement, p_quantity, v_balance, uid, left(p_note, 300));
  return v_balance;
end $$;

-- Physical stock count: set the absolute quantity, recording the difference.
create or replace function public.inventory_set_count(p_inventory uuid, p_count numeric, p_note text) returns numeric
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('inventory.manage'); v_old numeric;
begin
  if p_count < 0 then perform public.samat_error('invalid_quantity'); end if;
  select on_hand into v_old from public.inventory where id = p_inventory for update;
  if not found then perform public.samat_error('not_found'); end if;
  if v_old = p_count then return v_old; end if;
  return public.inventory_move(p_inventory, 'correction', p_count - v_old, coalesce(p_note, 'Stock count'));
end $$;

-- Items at or below their alert threshold that have not been alerted recently (server sends e-mail).
create or replace function public.inventory_low_items(p_mark boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name_ar', i.name_ar, 'name_en', i.name_en,
           'unit', i.unit, 'available', public.inventory_available(i.id), 'threshold', i.low_threshold)), '[]')
    into v
  from public.inventory i
  where i.is_active and public.inventory_available(i.id) <= i.low_threshold
    and (i.low_alert_sent_at is null or i.low_alert_sent_at < now() - interval '12 hours');
  if p_mark then
    update public.inventory i set low_alert_sent_at = now()
    where i.is_active and public.inventory_available(i.id) <= i.low_threshold
      and (i.low_alert_sent_at is null or i.low_alert_sent_at < now() - interval '12 hours');
  end if;
  return v;
end $$;

-- Owner/admin adjusts a customer's points.
create or replace function public.loyalty_adjust(p_customer uuid, p_points int, p_note text) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('loyalty.manage'); v_balance int;
begin
  if p_points = 0 then perform public.samat_error('invalid_quantity'); end if;
  if p_points > 0 then
    perform public.loyalty_credit(p_customer, p_points, 'adjust', null, coalesce(p_note, 'Manual adjustment'), null);
  else
    perform public.loyalty_debit(p_customer, -p_points, 'adjust', null, coalesce(p_note, 'Manual adjustment'));
  end if;
  perform public.write_audit('loyalty.adjust', 'loyalty_accounts', p_customer::text, null, null,
    jsonb_build_object('points', p_points, 'note', p_note));
  select balance into v_balance from public.loyalty_accounts where customer_id = p_customer;
  return v_balance;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Staff onboarding (server only; the server has already verified the e-mail through Supabase Auth)
-- ---------------------------------------------------------------------------------------------
create or replace function public.bootstrap_staff(p_user uuid, p_super_admin_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u auth.users; inv public.staff_invitations; sm public.staff_members;
begin
  select * into u from auth.users where id = p_user;
  if not found or u.email is null or u.email_confirmed_at is null then
    return jsonb_build_object('ok', false, 'reason', 'email_not_verified');
  end if;
  select * into sm from public.staff_members where user_id = p_user;
  if found then
    update public.staff_members set last_seen_at = now() where user_id = p_user;
    return jsonb_build_object('ok', sm.is_active, 'role', sm.role_key, 'reason', case when sm.is_active then null else 'disabled' end);
  end if;
  perform set_config('samat.actor_id', p_user::text, true);
  if p_super_admin_email is not null and lower(u.email) = lower(btrim(p_super_admin_email)) then
    insert into public.staff_members (user_id, email, full_name, role_key) values (p_user, u.email, null, 'owner');
    return jsonb_build_object('ok', true, 'role', 'owner', 'bootstrapped', true);
  end if;
  select * into inv from public.staff_invitations
  where email = u.email::citext and accepted_at is null and revoked_at is null and expires_at > now()
  order by created_at desc limit 1 for update;
  if found then
    insert into public.staff_members (user_id, email, full_name, role_key, invited_by)
    values (p_user, u.email, inv.full_name, inv.role_key, inv.invited_by);
    update public.staff_invitations set accepted_at = now() where id = inv.id;
    return jsonb_build_object('ok', true, 'role', inv.role_key, 'invited', true);
  end if;
  return jsonb_build_object('ok', false, 'reason', 'not_staff');
end $$;
