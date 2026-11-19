-- SAMAT | سماط — atomic product save for the admin menu editor (permission menu.manage).
create or replace function public.admin_save_product(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_permission('menu.manage');
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_kind public.category_kind;
  v_builder public.builder_type := (p->>'builder')::public.builder_type;
  v_active boolean := coalesce((p->>'is_active')::boolean, false);
  g jsonb; o jsonb; v_group uuid; i jsonb;
  v_bases int; v_breads int;
begin
  select kind into v_kind from public.categories where id = (p->>'category_id')::uuid;
  if v_kind is null then perform public.samat_error('invalid_request', '{"field":"category_id"}'); end if;
  if (v_kind = 'fries' and v_builder <> 'simple') or (v_kind = 'burger' and v_builder = 'shawarma') or (v_kind = 'shawarma' and v_builder = 'burger') then
    perform public.samat_error('invalid_request', '{"field":"builder"}');
  end if;

  select count(*) filter (where x->>'role' = 'base' and g2.kind = 'bread'), count(*) filter (where x->>'role' = 'bread_choice')
    into v_bases, v_breads
  from jsonb_array_elements(coalesce(p->'ingredients', '[]')) x
  join public.ingredients g2 on g2.id = (x->>'ingredient_id')::uuid;
  if v_active and v_builder = 'burger' and v_bases < 1 then perform public.samat_error('burger_needs_bun'); end if;
  if v_active and v_builder = 'shawarma' and v_breads < 1 then perform public.samat_error('shawarma_needs_bread'); end if;

  if v_id is null then
    insert into public.products (category_id, slug, builder, name_ar, name_en, description_ar, description_en, image_url,
      base_price, is_active, is_available, is_featured, inventory_id, inventory_qty, sort_order)
    values ((p->>'category_id')::uuid, p->>'slug', v_builder, p->>'name_ar', p->>'name_en', nullif(p->>'description_ar', ''),
      nullif(p->>'description_en', ''), nullif(p->>'image_url', ''), (p->>'base_price')::int, v_active,
      coalesce((p->>'is_available')::boolean, true), coalesce((p->>'is_featured')::boolean, false),
      nullif(p->>'inventory_id', '')::uuid, coalesce((p->>'inventory_qty')::numeric, 1), coalesce((p->>'sort_order')::int, 0))
    returning id into v_id;
  else
    update public.products set category_id = (p->>'category_id')::uuid, slug = p->>'slug', builder = v_builder,
      name_ar = p->>'name_ar', name_en = p->>'name_en', description_ar = nullif(p->>'description_ar', ''),
      description_en = nullif(p->>'description_en', ''), image_url = nullif(p->>'image_url', ''), base_price = (p->>'base_price')::int,
      is_active = v_active, is_available = coalesce((p->>'is_available')::boolean, true),
      is_featured = coalesce((p->>'is_featured')::boolean, false), inventory_id = nullif(p->>'inventory_id', '')::uuid,
      inventory_qty = coalesce((p->>'inventory_qty')::numeric, 1), sort_order = coalesce((p->>'sort_order')::int, 0)
    where id = v_id and deleted_at is null;
    if not found then perform public.samat_error('not_found'); end if;
  end if;

  delete from public.product_ingredients where product_id = v_id;
  for i in select * from jsonb_array_elements(coalesce(p->'ingredients', '[]')) loop
    insert into public.product_ingredients (product_id, ingredient_id, role, default_qty, max_qty, price_override, is_free, layer_order, sort_order)
    values (v_id, (i->>'ingredient_id')::uuid, (i->>'role')::public.ingredient_role, (i->>'default_qty')::int, (i->>'max_qty')::int,
      (i->>'price_override')::int, coalesce((i->>'is_free')::boolean, false), coalesce((i->>'layer_order')::int, 0), coalesce((i->>'layer_order')::int, 0));
  end loop;

  delete from public.product_sauces where product_id = v_id;
  for i in select * from jsonb_array_elements(coalesce(p->'sauces', '[]')) loop
    insert into public.product_sauces (product_id, sauce_id, included_qty, is_default, max_qty, price_override, sort_order)
    values (v_id, (i->>'sauce_id')::uuid, (i->>'included_qty')::int, coalesce((i->>'is_default')::boolean, false),
      (i->>'max_qty')::int, (i->>'price_override')::int, coalesce((i->>'sort_order')::int, 0));
  end loop;

  -- option groups: replace (old option ids are referenced by past orders only through snapshots)
  delete from public.option_groups where product_id = v_id;
  for g in select * from jsonb_array_elements(coalesce(p->'groups', '[]')) loop
    insert into public.option_groups (product_id, name_ar, name_en, selection, is_required, max_select, sort_order)
    values (v_id, g->>'name_ar', g->>'name_en', g->>'selection', coalesce((g->>'is_required')::boolean, false),
      greatest(coalesce((g->>'max_select')::int, 1), 1), coalesce((g->>'sort_order')::int, 0))
    returning id into v_group;
    for o in select * from jsonb_array_elements(coalesce(g->'options', '[]')) loop
      insert into public.product_options (group_id, product_id, name_ar, name_en, price_delta, is_default, is_active, inventory_id, inventory_qty, sort_order)
      values (v_group, v_id, o->>'name_ar', o->>'name_en', coalesce((o->>'price_delta')::int, 0), coalesce((o->>'is_default')::boolean, false),
        coalesce((o->>'is_active')::boolean, true), nullif(o->>'inventory_id', '')::uuid, coalesce((o->>'inventory_qty')::numeric, 1),
        coalesce((o->>'sort_order')::int, 0));
    end loop;
  end loop;
  return v_id;
end $$;

-- Products are soft-deleted so past orders and reports keep their history.
create or replace function public.admin_delete_product(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('menu.manage');
begin
  update public.products set is_active = false, deleted_at = now(), slug = slug || '-deleted-' || left(md5(random()::text), 6)
  where id = p_id and deleted_at is null;
end $$;

grant execute on function public.admin_save_product(jsonb), public.admin_delete_product(uuid) to authenticated;
