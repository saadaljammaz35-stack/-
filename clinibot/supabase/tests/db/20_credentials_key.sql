-- The WhatsApp credentials key in Vault: created once, 32 random bytes, and
-- readable only by the service role. Uses the helpers from 10_tenant_isolation.sql.

\set as_super   'reset role; reset request.jwt.claims;'
\set as_service 'reset role; set request.jwt.claims to ''{"role":"service_role"}''; set role service_role;'
\set as_anon    'reset role; set request.jwt.claims to ''{"role":"anon"}''; set role anon;'
\set as_user    'reset role; set request.jwt.claims to ''{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}''; set role authenticated;'

:as_super
select test.ok(
  (select count(*) from vault.secrets where name = 'clinibot_credentials_key') = 1,
  'the credentials key exists once'
);
select test.ok(
  length(decode((select decrypted_secret from vault.decrypted_secrets where name = 'clinibot_credentials_key'), 'base64')) = 32,
  'the credentials key is 32 bytes of base64'
);

-- Running the migration again keeps the same key.
create temp table key_before as
  select decrypted_secret from vault.decrypted_secrets where name = 'clinibot_credentials_key';
\ir ../../migrations/20261023090000_credentials_key_vault.sql
select test.ok(
  (select count(*) from vault.secrets where name = 'clinibot_credentials_key') = 1
    and (select decrypted_secret from vault.decrypted_secrets where name = 'clinibot_credentials_key')
      = (select decrypted_secret from key_before),
  'running the migration again does not replace the key'
);

:as_service
select test.ok(
  length(decode(public.credentials_encryption_key(), 'base64')) = 32,
  'the service role reads the key'
);

:as_user
select test.throws('select public.credentials_encryption_key()', '42501', 'signed-in users cannot read the key');

:as_anon
select test.throws('select public.credentials_encryption_key()', '42501', 'anonymous callers cannot read the key');

:as_super
