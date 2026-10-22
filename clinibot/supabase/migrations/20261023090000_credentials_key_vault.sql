-- The AES-256-GCM key that seals each clinic's WhatsApp credentials
-- (integration_credentials). It is generated here, inside the database, and
-- kept in Supabase Vault, so nobody has to copy a key by hand. Only the
-- service role (the Edge Functions) can read it.
--
-- A valid CREDENTIALS_ENCRYPTION_KEY in the Edge Function environment still
-- takes precedence (used by tests and local development). Do not set one in
-- production once credentials exist: they were sealed with this key.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'clinibot_credentials_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'clinibot_credentials_key',
      'AES-256-GCM key for clinic WhatsApp credentials (read by Edge Functions)'
    );
  end if;
end;
$$;

create or replace function public.credentials_encryption_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'clinibot_credentials_key'
  limit 1;
$$;

revoke all on function public.credentials_encryption_key() from public, anon, authenticated;
grant execute on function public.credentials_encryption_key() to service_role;
