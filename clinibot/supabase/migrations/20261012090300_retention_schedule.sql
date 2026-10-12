-- Daily retention purge at 02:30 Riyadh time (23:30 UTC).
--
-- Uses Supabase Cron (pg_cron) when the extension is available. Where it is not
-- (a plain local Postgres), the migration only logs a notice; schedule
-- `select public.purge_expired_data();` with any external scheduler instead.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    perform cron.schedule(
      'clinibot-retention-purge',
      '30 23 * * *',
      'select public.purge_expired_data();'
    );
  else
    raise notice 'pg_cron is not available: schedule public.purge_expired_data() externally';
  end if;
end;
$$;
