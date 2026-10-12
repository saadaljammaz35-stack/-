-- Tenant isolation, role permissions and integrity rules, tested as the real
-- API roles (anon, authenticated, service_role) with Supabase-style JWT claims.
--
-- Cast:
--   alice  owner of Clinic A          adam  admin of Clinic A
--   rana   receptionist of Clinic A   bob   owner of Clinic B
--   eve    signed in, no clinic       (anon) not signed in

\set alice   'a1111111-1111-4111-8111-111111111111'
\set bob     'b2222222-2222-4222-8222-222222222222'
\set rana    'c3333333-3333-4333-8333-333333333333'
\set adam    'd4444444-4444-4444-8444-444444444444'
\set eve     'e5555555-5555-4555-8555-555555555555'

\set as_super   'reset role; reset request.jwt.claims;'
\set as_service 'reset role; set request.jwt.claims to ''{"role":"service_role"}''; set role service_role;'
\set as_anon    'reset role; set request.jwt.claims to ''{"role":"anon"}''; set role anon;'
\set as_alice   'reset role; set request.jwt.claims to ''{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}''; set role authenticated;'
\set as_bob     'reset role; set request.jwt.claims to ''{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}''; set role authenticated;'
\set as_rana    'reset role; set request.jwt.claims to ''{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}''; set role authenticated;'
\set as_adam    'reset role; set request.jwt.claims to ''{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}''; set role authenticated;'
\set as_eve     'reset role; set request.jwt.claims to ''{"sub":"e5555555-5555-4555-8555-555555555555","role":"authenticated"}''; set role authenticated;'

-- ───────────────────────────── helpers ─────────────────────────────

create schema test;
grant usage on schema test to anon, authenticated, service_role;

create function test.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'ok - %', label;
end;
$$;

-- Runs a statement and requires it to fail with the given SQLSTATE.
create function test.throws(stmt text, expected text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected then
      raise notice 'ok - % [%]', label, sqlstate;
      return;
    end if;
    raise exception 'FAIL: % - expected SQLSTATE %, got % (%)', label, expected, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % - expected SQLSTATE %, but the statement succeeded', label, expected;
end;
$$;

-- Runs a statement and requires it to succeed.
create function test.lives(stmt text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise notice 'ok - %', label;
exception when others then
  raise exception 'FAIL: % - % (%)', label, sqlerrm, sqlstate;
end;
$$;

-- Number of rows a statement affects or returns, as the current role.
create function test.n(stmt text) returns bigint language plpgsql as $$
declare
  v bigint;
begin
  execute 'select count(*) from (' || stmt || ') s' into v;
  return v;
end;
$$;

create function test.affected(stmt text) returns bigint language plpgsql as $$
declare
  v bigint;
begin
  execute stmt;
  get diagnostics v = row_count;
  return v;
end;
$$;

grant execute on all functions in schema test to anon, authenticated, service_role;

-- Holds ids across identity switches (the test roles cannot create temp tables).
create table test.ids (name text primary key, id uuid not null);
grant select on test.ids to anon, authenticated, service_role;
create function test.id(p_name text) returns uuid language sql stable as $$
  select id from test.ids where name = p_name
$$;
grant execute on function test.id(text) to anon, authenticated, service_role;

-- ───────────────────────────── fixtures ─────────────────────────────

insert into auth.users (id, email, raw_user_meta_data) values
  (:'alice', 'alice@clinic-a.test', '{"full_name":"Alice"}'),
  (:'bob',   'bob@clinic-b.test',   '{"full_name":"Bob"}'),
  (:'rana',  'rana@clinic-a.test',  '{"full_name":"Rana"}'),
  (:'adam',  'adam@clinic-a.test',  '{"full_name":"Adam"}'),
  (:'eve',   'eve@nowhere.test',    '{}');

:as_alice
select test.lives($$select public.create_organization('Clinic A', 'clinic-a', 'Riyadh', '+966500000001', 'ar')$$,
                  'owner creates a clinic through the RPC');
:as_bob
select test.lives($$select public.create_organization('Clinic B', 'clinic-b', 'Jeddah', null, 'en')$$,
                  'second owner creates a separate clinic');

:as_super
insert into test.ids select 'org_a', id from public.organizations where slug = 'clinic-a';
insert into test.ids select 'org_b', id from public.organizations where slug = 'clinic-b';

-- Staff of Clinic A are added the way the invite function does it: as service_role.
:as_service
insert into public.organization_members (organization_id, user_id, role, invited_by)
values (test.id('org_a'), :'rana', 'receptionist', :'alice'),
       (test.id('org_a'), :'adam', 'admin', :'alice');

-- Knowledge, conversations, messages and requests for both clinics.
insert into public.clinic_services (id, organization_id, name_ar, price_type, price_sar)
values ('11111111-0000-4000-8000-00000000000a', test.id('org_a'), 'تنظيف الأسنان', 'fixed', 250),
       ('11111111-0000-4000-8000-00000000000b', test.id('org_b'), 'Teeth whitening', 'fixed', 900);
insert into public.approved_faqs (organization_id, question_ar, answer_ar)
values (test.id('org_a'), 'هل يوجد موقف سيارات؟', 'نعم، يوجد موقف مجاني.'),
       (test.id('org_b'), 'هل تقبلون التأمين؟', 'نعم.');
insert into public.conversations (id, organization_id, channel, customer_wa_id, customer_name)
values ('22222222-0000-4000-8000-00000000000a', test.id('org_a'), 'whatsapp', '966500000010', 'Patient A'),
       ('22222222-0000-4000-8000-00000000000b', test.id('org_b'), 'whatsapp', '966500000020', 'Patient B');
insert into public.messages (organization_id, conversation_id, direction, sender, body, status)
values (test.id('org_a'), '22222222-0000-4000-8000-00000000000a', 'inbound', 'customer', 'كم سعر التنظيف؟', 'received'),
       (test.id('org_b'), '22222222-0000-4000-8000-00000000000b', 'inbound', 'customer', 'How much is whitening?', 'received');
insert into public.appointment_requests (id, organization_id, conversation_id, service_id, customer_name, customer_phone, source)
values ('33333333-0000-4000-8000-00000000000a', test.id('org_a'), '22222222-0000-4000-8000-00000000000a',
        '11111111-0000-4000-8000-00000000000a', 'Patient A', '+966500000010', 'whatsapp'),
       ('33333333-0000-4000-8000-00000000000b', test.id('org_b'), '22222222-0000-4000-8000-00000000000b',
        '11111111-0000-4000-8000-00000000000b', 'Patient B', '+966500000020', 'whatsapp');
insert into public.integration_settings (organization_id, status, phone_number_id)
values (test.id('org_a'), 'credentials_verified', '1000000001'),
       (test.id('org_b'), 'credentials_verified', '1000000002');
insert into public.integration_credentials (integration_id, organization_id, access_token_ciphertext)
select id, organization_id, 'ciphertext' from public.integration_settings;
insert into public.demo_requests (clinic_name, contact_name, phone, consent_at)
values ('Some clinic', 'Someone', '+966500000099', now());

-- ─────────────────────── 1. tenant isolation ───────────────────────

:as_alice
select test.ok(test.n('select * from public.organizations') = 1, 'alice sees exactly one clinic');
select test.ok(test.n($$select * from public.organizations where slug = 'clinic-b'$$) = 0, 'alice cannot see Clinic B');
select test.ok(test.n('select * from public.organization_members') = 3, 'alice sees the 3 members of Clinic A only');
select test.ok(test.n('select * from public.clinic_settings') = 1, 'alice sees one settings row');
select test.ok(test.n('select * from public.clinic_services') = 1, 'alice sees only Clinic A services');
select test.ok(test.n('select * from public.approved_faqs') = 1, 'alice sees only Clinic A FAQs');
select test.ok(test.n('select * from public.conversations') = 1, 'alice sees only Clinic A conversations');
select test.ok(test.n('select * from public.messages') = 1, 'alice sees only Clinic A messages');
select test.ok(test.n('select * from public.appointment_requests') = 1, 'alice sees only Clinic A appointment requests');
select test.ok(test.n('select * from public.integration_settings') = 1, 'alice sees only Clinic A integration');
select test.ok(test.n('select * from public.subscription_records') = 1, 'alice sees only Clinic A subscription');
select test.ok(test.n($$select * from public.audit_logs where organization_id <> test.id('org_a')$$) = 0,
               'alice sees no audit entries of other clinics');

:as_bob
select test.ok(test.n($$select * from public.messages where organization_id = test.id('org_a')$$) = 0,
               'bob cannot read Clinic A messages');
select test.ok(test.affected($$update public.clinic_services set price_sar = 1 where organization_id = test.id('org_a')$$) = 0,
               'bob cannot update Clinic A services');
select test.ok(test.affected($$delete from public.clinic_services where organization_id = test.id('org_a')$$) = 0,
               'bob cannot delete Clinic A services');
select test.ok(test.affected($$update public.conversations set status = 'closed' where organization_id = test.id('org_a')$$) = 0,
               'bob cannot change Clinic A conversations');
select test.ok(test.affected($$update public.appointment_requests set status = 'cancelled' where organization_id = test.id('org_a')$$) = 0,
               'bob cannot change Clinic A appointment requests');
select test.throws($$insert into public.clinic_services (organization_id, name_ar, price_type, price_sar) values (test.id('org_a'), 'x', 'fixed', 1)$$,
                   '42501', 'bob cannot add a service to Clinic A');
select test.throws($$insert into public.appointment_requests (organization_id, customer_name, customer_phone) values (test.id('org_a'), 'Mallory', '+966500000077')$$,
                   '42501', 'bob cannot create an appointment request in Clinic A');
select test.throws($$insert into public.appointment_request_notes (organization_id, appointment_request_id, body) values (test.id('org_a'), '33333333-0000-4000-8000-00000000000a', 'hi')$$,
                   '42501', 'bob cannot add a note to a Clinic A request');
select test.throws($$insert into public.appointment_request_notes (organization_id, appointment_request_id, body) values (test.id('org_b'), '33333333-0000-4000-8000-00000000000a', 'hi')$$,
                   '23503', 'a note cannot point at another clinic''s request, even with your own organization id');
select test.throws($$select public.dashboard_metrics(test.id('org_a'))$$, '42501', 'bob cannot read Clinic A metrics');
select test.throws($$select public.org_entitlements(test.id('org_a'))$$, '42501', 'bob cannot read Clinic A entitlements');
select test.throws($$select * from public.list_org_members(test.id('org_a'))$$, '42501', 'bob cannot list Clinic A staff');
select test.throws($$select public.delete_organization(test.id('org_a'), 'clinic-a')$$, '42501', 'bob cannot delete Clinic A');

:as_eve
select test.ok(test.n('select * from public.organizations') = 0, 'a user without a clinic sees no clinics');
select test.ok(test.n('select * from public.messages') = 0, 'a user without a clinic sees no messages');
select test.ok(test.n('select * from public.appointment_requests') = 0, 'a user without a clinic sees no requests');

:as_anon
select test.throws('select * from public.organizations', '42501', 'anon has no access to clinics');
select test.throws('select * from public.messages', '42501', 'anon has no access to messages');
select test.throws('select * from public.conversations', '42501', 'anon has no access to conversations');
select test.throws('select * from public.demo_requests', '42501', 'anon cannot read demo requests');
select test.throws($$insert into public.demo_requests (clinic_name, contact_name, phone, consent_at) values ('x','y','+966500000001', now())$$,
                   '42501', 'anon cannot write demo requests directly');
select test.ok(test.n('select * from public.plan_limits') = 3, 'anon can read public pricing');
select test.throws($$select public.create_organization('Anon clinic', 'anon-clinic')$$, '42501', 'anon cannot create a clinic');

-- Composite foreign keys keep children inside their clinic even for the service role.
:as_service
select test.throws($$insert into public.messages (organization_id, conversation_id, direction, sender, body, status) values (test.id('org_b'), '22222222-0000-4000-8000-00000000000a', 'outbound', 'assistant', 'x', 'sent')$$,
                   '23503', 'a message cannot belong to one clinic and point at another clinic''s conversation');
select test.throws($$insert into public.appointment_requests (organization_id, service_id, customer_name, customer_phone, source) values (test.id('org_b'), '11111111-0000-4000-8000-00000000000a', 'X Y', '+966500000001', 'whatsapp')$$,
                   '23503', 'an appointment request cannot reference another clinic''s service');

-- ─────────────────────── 2. secrets and server-owned columns ───────────────────────

:as_alice
select test.throws('select * from public.integration_credentials', '42501', 'owners cannot read encrypted credentials');
select test.throws('select * from public.demo_requests', '42501', 'clinic users cannot read demo requests');
select test.throws($$insert into public.messages (organization_id, conversation_id, direction, sender, body, status) values (test.id('org_a'), '22222222-0000-4000-8000-00000000000a', 'outbound', 'staff', 'x', 'sent')$$,
                   '42501', 'the browser cannot write messages directly');
select test.throws($$update public.clinic_settings set ai_last_test_ok = true, ai_last_test_at = now()$$,
                   '42501', 'the browser cannot mark the AI as tested');
select test.throws($$update public.clinic_services set organization_id = test.id('org_b')$$,
                   '42501', 'a service cannot be moved to another clinic');
select test.throws($$update public.appointment_requests set customer_notified_at = now()$$,
                   '42501', 'the browser cannot claim the customer was notified');
select test.throws($$update public.integration_settings set status = 'connected'$$,
                   '42501', 'the browser cannot mark WhatsApp as connected');
select test.throws($$insert into public.subscription_records (organization_id, plan, status) values (test.id('org_a'), 'pro', 'active')$$,
                   '42501', 'the browser cannot grant itself a subscription');
select test.throws($$update public.subscription_records set status = 'active'$$,
                   '42501', 'the browser cannot change subscription status');
select test.throws($$select public.consume_rate_limit('x', 1, 60)$$, '42501', 'staff cannot call service-only functions (rate limit)');
select test.throws($$select public.find_user_id_by_email('bob@clinic-b.test')$$, '42501', 'staff cannot look up users by email');
select test.throws($$select * from public.ingest_whatsapp_inbound(test.id('org_a'), '966500000010', 'x', 'wamid.1', 'hi')$$,
                   '42501', 'staff cannot call the WhatsApp ingest function');
select test.throws($$select public.write_audit(test.id('org_a'), null, 'system', 'fake.entry')$$, '42501', 'staff cannot forge audit entries');
select test.throws($$select public.purge_expired_data()$$, '42501', 'staff cannot trigger the retention purge');

-- The assistant cannot be switched on before a real test succeeded.
select test.throws($$update public.clinic_settings set assistant_enabled = true$$, '23514',
                   'assistant cannot be enabled before a successful test');
:as_service
update public.clinic_settings set ai_last_test_ok = true, ai_last_test_at = now() where organization_id = test.id('org_a');
:as_alice
select test.lives($$update public.clinic_settings set assistant_enabled = true$$, 'assistant can be enabled after a successful test');

-- ─────────────────────── 3. roles inside one clinic ───────────────────────

:as_rana
select test.ok(test.n('select * from public.clinic_services') = 1, 'receptionist can read services');
select test.throws($$insert into public.clinic_services (organization_id, name_ar, price_type, price_sar) values (test.id('org_a'), 'x', 'fixed', 1)$$,
                   '42501', 'receptionist cannot add services');
select test.ok(test.affected($$update public.clinic_services set price_sar = 1$$) = 0, 'receptionist cannot change prices');
select test.ok(test.affected($$update public.approved_faqs set answer_ar = 'x'$$) = 0, 'receptionist cannot change FAQs');
select test.ok(test.affected($$update public.clinic_settings set assistant_tone = 'formal'$$) = 0, 'receptionist cannot change clinic settings');
select test.ok(test.n('select * from public.integration_settings') = 0, 'receptionist cannot see integration settings');
select test.ok(test.n('select * from public.subscription_records') = 0, 'receptionist cannot see billing');
select test.ok(test.n('select * from public.audit_logs') = 0, 'receptionist cannot read the audit log');
select test.ok(test.affected($$delete from public.conversations$$) = 0, 'receptionist cannot delete conversations');
select test.ok(test.affected($$update public.conversations set ai_paused = true, assigned_to = 'c3333333-3333-4333-8333-333333333333'$$) = 1,
               'receptionist can take over a conversation');
select test.throws($$update public.conversations set assigned_to = 'b2222222-2222-4222-8222-222222222222'$$, '23514',
                   'conversations cannot be assigned to someone outside the clinic');
select test.ok(test.affected($$update public.appointment_requests set status = 'contacted'$$) = 1,
               'receptionist can move a request to contacted');
select test.lives($$insert into public.appointment_request_notes (organization_id, appointment_request_id, body) values (test.id('org_a'), '33333333-0000-4000-8000-00000000000a', 'Called, no answer')$$,
                  'receptionist can add an internal note');
select test.ok((select author_id from public.appointment_request_notes limit 1) = 'c3333333-3333-4333-8333-333333333333',
               'the note is attributed to its author');
select test.throws($$select public.update_member_role((select id from public.organization_members where user_id = 'd4444444-4444-4444-8444-444444444444'), 'receptionist')$$,
                   '42501', 'receptionist cannot change roles');
select test.throws($$select public.remove_member((select id from public.organization_members where user_id = 'd4444444-4444-4444-8444-444444444444'))$$,
                   '42501', 'receptionist cannot remove an admin');
select test.ok(test.n('select * from public.list_org_members(test.id(''org_a''))') = 3, 'receptionist can list colleagues');

:as_adam
select test.lives($$insert into public.clinic_services (organization_id, name_en, price_type) values (test.id('org_a'), 'Consultation', 'on_consultation')$$,
                  'admin can add a service');
select test.throws($$select public.update_member_role((select id from public.organization_members where user_id = 'c3333333-3333-4333-8333-333333333333'), 'admin')$$,
                   '42501', 'admin cannot promote staff (owners only)');
select test.throws($$select public.delete_organization(test.id('org_a'), 'clinic-a')$$, '42501', 'admin cannot delete the clinic');

:as_alice
select test.throws($$select public.update_member_role((select id from public.organization_members where user_id = 'a1111111-1111-4111-8111-111111111111'), 'admin')$$,
                   '23514', 'the last owner cannot be demoted');
select test.throws($$select public.remove_member((select id from public.organization_members where user_id = 'a1111111-1111-4111-8111-111111111111'))$$,
                   '23514', 'the last owner cannot leave');
select test.lives($$select public.update_member_role((select id from public.organization_members where user_id = 'd4444444-4444-4444-8444-444444444444'), 'owner')$$,
                  'owner can promote an admin to co-owner');
select test.lives($$select public.update_member_role((select id from public.organization_members where user_id = 'd4444444-4444-4444-8444-444444444444'), 'admin')$$,
                  'owner can demote a co-owner when another owner remains');

-- ─────────────────────── 4. seat limits ───────────────────────

:as_service
select test.throws($$insert into public.organization_members (organization_id, user_id, role) values (test.id('org_a'), 'e5555555-5555-4555-8555-555555555555', 'receptionist')$$,
                   '23514', 'starter plan stops at 3 seats');

-- ─────────────────────── 5. appointment workflow ───────────────────────

:as_alice
select test.throws($$update public.appointment_requests set status = 'completed'$$, '23514', 'contacted cannot jump to completed');
select test.throws($$update public.appointment_requests set status = 'confirmed'$$, '23514',
                   'a request cannot be confirmed without the agreed time');
select test.ok(test.affected($$update public.appointment_requests set status = 'confirmed', scheduled_for = now() + interval '2 days'$$) = 1,
               'a request is confirmed with an agreed time');
select test.ok((select confirmed_by from public.appointment_requests) = 'a1111111-1111-4111-8111-111111111111'
               and (select confirmed_at from public.appointment_requests) is not null,
               'confirmation records who confirmed and when');
select test.throws($$update public.appointment_requests set status = 'new'$$, '23514', 'a confirmed request cannot go back to new');
:as_service
update public.appointment_requests set customer_notified_at = now() where organization_id = test.id('org_a');
:as_alice
update public.appointment_requests set scheduled_for = now() + interval '3 days';
select test.ok((select customer_notified_at from public.appointment_requests) is null,
               'changing the agreed time clears the earlier notification');
select test.ok(test.affected($$update public.appointment_requests set status = 'cancelled'$$) = 1, 'a confirmed request can be cancelled');
select test.throws($$update public.appointment_requests set status = 'confirmed'$$, '23514', 'a cancelled request is final');
select test.throws($$insert into public.appointment_requests (organization_id, customer_name, customer_phone, source) values (test.id('org_a'), 'Walk In', '+966500000033', 'whatsapp')$$,
                   '42501', 'staff cannot create requests that pretend to come from a channel');
select test.lives($$insert into public.appointment_requests (organization_id, customer_name, customer_phone) values (test.id('org_a'), 'Walk In', '+966500000033')$$,
                  'staff can log a request by hand');
select test.throws($$insert into public.appointment_requests (organization_id, customer_name, customer_phone) values (test.id('org_a'), 'Bad Phone', '12ab')$$,
                   '23514', 'phone numbers are validated');

-- ─────────────────────── 6. audit trail ───────────────────────

:as_alice
select test.ok(test.n($$select * from public.audit_logs where action = 'appointment_requests.update' and actor_user_id = 'a1111111-1111-4111-8111-111111111111'$$) >= 1,
               'status changes are audited with the actor');
select test.ok(test.n($$select * from public.audit_logs where details::text like '%Patient%' or details::text like '%9665%'$$) = 0,
               'audit entries carry no names or phone numbers');
select test.throws($$delete from public.audit_logs$$, '42501', 'staff cannot delete audit entries');
:as_super
select test.throws($$delete from public.audit_logs$$, '42501', 'even the database owner cannot delete audit entries outside the purge');
select test.throws($$update public.audit_logs set action = 'x'$$, '42501', 'audit entries cannot be edited');

-- ─────────────────────── 7. metrics and entitlements ───────────────────────

:as_alice
select test.ok((public.dashboard_metrics(test.id('org_a')) ->> 'total_conversations')::int = 1, 'metrics count only Clinic A conversations');
select test.ok((public.org_entitlements(test.id('org_a')) ->> 'is_active')::boolean, 'a new clinic is on an active trial');
select test.ok((public.org_entitlements(test.id('org_a')) ->> 'ai_replies_limit')::int = 300, 'trial AI allowance is capped');
select test.ok((public.org_entitlements(test.id('org_a')) ->> 'seats_used')::int = 3, 'entitlements count seats');
:as_service
update public.subscription_records set trial_ends_at = now() - interval '1 minute' where organization_id = test.id('org_b');
select test.ok(not (public.org_entitlements(test.id('org_b')) ->> 'is_active')::boolean, 'an expired trial is inactive');
select public.record_ai_usage(test.id('org_a'), 1200, 300, false);
select public.record_ai_usage(test.id('org_a'), 800, 200, true);
select test.ok((public.org_entitlements(test.id('org_a')) ->> 'ai_replies_used')::int = 2, 'AI usage (including tests) is counted');

-- ─────────────────────── 8. WhatsApp ingest and receipts ───────────────────────

:as_service
select test.ok((select not is_duplicate from public.ingest_whatsapp_inbound(test.id('org_a'), '966500000055', 'New Patient', 'wamid.AAA', 'السلام عليكم')),
               'first delivery of a WhatsApp message is stored');
select test.ok((select is_duplicate from public.ingest_whatsapp_inbound(test.id('org_a'), '966500000055', 'New Patient', 'wamid.AAA', 'السلام عليكم')),
               'a retried delivery is recognised as a duplicate');
select test.ok(test.n($$select * from public.messages where wa_message_id = 'wamid.AAA'$$) = 1, 'the retried message is stored once');
select test.ok((select not is_duplicate from public.ingest_whatsapp_inbound(test.id('org_a'), '966500000055', null, 'wamid.BBB', 'second')),
               'a second message is stored');
select test.ok(test.n($$select * from public.conversations where customer_wa_id = '966500000055'$$) = 1,
               'messages from one number share one conversation');
select test.ok((select customer_name from public.conversations where customer_wa_id = '966500000055') = 'New Patient',
               'a missing profile name does not erase the stored one');
select test.ok((select last_message_direction from public.conversations where customer_wa_id = '966500000055') = 'inbound',
               'the conversation shows it is waiting for a reply');

insert into public.messages (organization_id, conversation_id, direction, sender, body, status, wa_message_id)
select organization_id, id, 'outbound', 'assistant', 'أهلاً', 'sent', 'wamid.OUT1'
  from public.conversations where customer_wa_id = '966500000055';
select test.ok((select first_response_at is not null from public.conversations where customer_wa_id = '966500000055'),
               'first response time is recorded');
select test.ok(public.apply_whatsapp_status('wamid.OUT1', 'delivered'), 'delivered receipt applies');
select test.ok(public.apply_whatsapp_status('wamid.OUT1', 'read'), 'read receipt applies');
select test.ok(not public.apply_whatsapp_status('wamid.OUT1', 'delivered'), 'a late delivered receipt does not move read backwards');
select test.ok(not public.apply_whatsapp_status('wamid.OUT1', 'failed', '131047', 'x'), 'a read message cannot become failed');

-- ─────────────────────── 9. rate limiting ───────────────────────

select test.ok(public.consume_rate_limit('test:key', 2, 60), 'rate limit: first hit allowed');
select test.ok(public.consume_rate_limit('test:key', 2, 60), 'rate limit: second hit allowed');
select test.ok(not public.consume_rate_limit('test:key', 2, 60), 'rate limit: third hit refused');

-- ─────────────────────── 10. retention ───────────────────────

:as_super
update public.messages set created_at = now() - interval '400 days' where wa_message_id = 'wamid.AAA';
:as_service
select public.purge_expired_data();
select test.ok(test.n($$select * from public.messages where wa_message_id = 'wamid.AAA'$$) = 0, 'messages older than the retention period are purged');
select test.ok(test.n($$select * from public.messages where wa_message_id = 'wamid.BBB'$$) = 1, 'recent messages are kept');
select test.ok(test.n($$select * from public.audit_logs where action = 'retention.purge'$$) = 1, 'the purge is audited');

-- ─────────────────────── 11. clinic deletion ───────────────────────

:as_alice
select test.throws($$select public.delete_organization(test.id('org_a'), 'wrong-slug')$$, '22023', 'deletion requires typing the clinic link');
:as_bob
select test.lives($$select public.delete_organization(test.id('org_b'), 'clinic-b')$$, 'the owner can delete their clinic');
:as_super
select test.ok(test.n($$select * from public.messages where organization_id = test.id('org_b')$$) = 0, 'deleting a clinic removes its messages');
select test.ok(test.n($$select * from public.conversations where organization_id = test.id('org_b')$$) = 0, 'deleting a clinic removes its conversations');
select test.ok(test.n($$select * from public.integration_credentials where organization_id = test.id('org_b')$$) = 0, 'deleting a clinic removes its credentials');
select test.ok(test.n($$select * from public.audit_logs where organization_id = test.id('org_b') and action = 'organizations.delete'$$) = 1,
               'the deletion itself stays on record');
select test.ok(test.n('select * from public.organizations') = 1, 'the other clinic is untouched');

-- ─────────────────────── 12. account limits ───────────────────────

:as_eve
select test.throws($$select public.create_organization('Clash', 'clinic-a')$$, '23505', 'clinic links are unique');
select public.create_organization('Eve 1', 'eve-one');
select public.create_organization('Eve 2', 'eve-two');
select public.create_organization('Eve 3', 'eve-three');
select test.throws($$select public.create_organization('Eve 4', 'eve-four')$$, '23514', 'one account cannot create unlimited clinics');
