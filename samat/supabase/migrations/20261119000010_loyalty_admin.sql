-- Loyalty programme settings are editable with loyalty.manage (not only settings.manage).
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
    loyalty_expiry_days = case when p ? 'loyalty_expiry_days' then nullif((p->>'loyalty_expiry_days')::int, 0) else loyalty_expiry_days end
  where id = 1;
end $$;
grant execute on function public.admin_save_loyalty_settings(jsonb) to authenticated;
