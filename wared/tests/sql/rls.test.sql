-- Permission and RLS assertions for وارد. Run by scripts/test-migrations.sh against a throwaway database.
-- Each block raises "TEST FAILED: ..." on a broken expectation, which stops psql with a non-zero exit code.

\set owner_id '11111111-1111-1111-1111-111111111111'
\set admin_id '22222222-2222-2222-2222-222222222222'
\set editor_id '33333333-3333-3333-3333-333333333333'
\set writer_id '44444444-4444-4444-4444-444444444444'
\set outsider_id '55555555-5555-5555-5555-555555555555'

-- Fixtures (as superuser: auth.uid() is null, so role guards treat it as trusted SQL).
insert into auth.users (id, email, raw_user_meta_data) values
  (:'owner_id', 'owner@wared.test', '{"full_name": "Owner"}'),
  (:'admin_id', 'admin@wared.test', '{}'),
  (:'editor_id', 'editor@wared.test', '{}'),
  (:'writer_id', 'writer@wared.test', '{}'),
  (:'outsider_id', 'outsider@wared.test', '{}');

do $$ begin
  if (select count(*) from public.profiles) <> 5 then raise exception 'TEST FAILED: profiles not created by trigger'; end if;
  if exists (select 1 from public.profiles where role is not null) then raise exception 'TEST FAILED: new users must not get a role'; end if;
end $$;

update public.profiles set role = 'owner' where email = 'owner@wared.test';
update public.profiles set role = 'admin' where email = 'admin@wared.test';
update public.profiles set role = 'editor' where email = 'editor@wared.test';
update public.profiles set role = 'writer' where email = 'writer@wared.test';

insert into public.podcasts (id, slug, title, status, published_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'main-show', 'البرنامج', 'published', now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'hidden-show', 'برنامج مخفي', 'draft', null);

insert into public.episodes (id, podcast_id, slug, title, summary, status, published_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'ep-live', 'الحلقة الأولى عن القهوة', 'نقاش', 'published', now() - interval '1 day'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'ep-draft', 'مسودة', null, 'draft', null),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'ep-future', 'مجدولة', null, 'scheduled', now() + interval '1 day'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'ep-past-scheduled', 'مجدولة وصل وقتها', null, 'scheduled', now() - interval '1 minute'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000002', 'ep-hidden-parent', 'حلقة برنامج مخفي', null, 'published', now() - interval '1 day');

insert into public.episode_chapters (episode_id, start_seconds, title) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 0, 'مقدمة'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 0, 'فصل مسودة');

insert into public.transcripts (episode_id, plain_text, segments) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'تحدثنا عن الصحراء والنجوم', '[{"start":0,"text":"تحدثنا عن الصحراء والنجوم"}]');

insert into public.articles (id, slug, title, body, status, published_at, created_by) values
  ('cccccccc-0000-0000-0000-000000000001', 'editor-article', 'مقال المحرر', 'نص', 'published', now() - interval '1 hour', '33333333-3333-3333-3333-333333333333');

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '', false);

do $$ begin
  if (select count(*) from public.episodes) <> 2 then
    raise exception 'TEST FAILED: anon should see exactly 2 live episodes, saw %', (select count(*) from public.episodes);
  end if;
  if exists (select 1 from public.episodes where slug in ('ep-draft', 'ep-future', 'ep-hidden-parent')) then
    raise exception 'TEST FAILED: anon sees unpublished episodes';
  end if;
  if (select count(*) from public.episode_chapters) <> 1 then raise exception 'TEST FAILED: anon sees chapters of drafts'; end if;
  if (select count(*) from public.podcasts) <> 1 then raise exception 'TEST FAILED: anon sees draft programs'; end if;
  if exists (select 1 from public.site_settings where key = 'notifications') then
    raise exception 'TEST FAILED: anon sees private settings';
  end if;
  if (select count(*) from public.site_settings) < 4 then raise exception 'TEST FAILED: anon cannot read public settings'; end if;
end $$;

-- Arabic normalisation: "القهوه" (ه) must match "القهوة" (ة); transcript text is searchable.
do $$ begin
  if not exists (select 1 from public.search_content('القهوه') where slug = 'ep-live') then
    raise exception 'TEST FAILED: search did not match normalised title';
  end if;
  if not exists (select 1 from public.search_content('الصحرا') where slug = 'ep-live') then
    raise exception 'TEST FAILED: search did not match transcript prefix';
  end if;
  if exists (select 1 from public.search_content('مسودة')) then
    raise exception 'TEST FAILED: search leaks drafts';
  end if;
end $$;

do $$ begin
  begin
    insert into public.contact_messages (name, email, message) values ('x', 'x@example.com', 'hello there friend');
    raise exception 'TEST FAILED: anon could insert contact messages directly';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.subscribers (email, unsubscribe_token_hash) values ('x@example.com', 'h');
    raise exception 'TEST FAILED: anon could insert subscribers directly';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.analytics_events (event_type) values ('page_view');
    raise exception 'TEST FAILED: anon could write analytics directly';
  exception when insufficient_privilege then null; end;
  begin
    perform public.hit_rate_limit('k', 1, 60);
    raise exception 'TEST FAILED: anon could call hit_rate_limit';
  exception when insufficient_privilege then null; end;
  begin
    perform public.analytics_overview(30);
    raise exception 'TEST FAILED: anon could read analytics';
  exception when insufficient_privilege then null; end;
  begin
    update public.episodes set title = 'hacked';
    raise exception 'TEST FAILED: anon could update episodes';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Signed-in user without a staff role
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false);
do $$ begin
  if (select count(*) from public.episodes) <> 2 then raise exception 'TEST FAILED: outsider sees drafts'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'TEST FAILED: outsider sees other profiles'; end if;
  update public.profiles set role = 'owner' where id = auth.uid();
  raise exception 'TEST FAILED: outsider granted itself a role';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.articles (slug, title, created_by) values ('nope', 'nope', auth.uid());
  raise exception 'TEST FAILED: outsider created an article';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Writer
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', false);
do $$ begin
  if (select count(*) from public.episodes) <> 5 then raise exception 'TEST FAILED: writer should read all content'; end if;
  insert into public.articles (id, slug, title, status, created_by)
    values ('cccccccc-0000-0000-0000-000000000002', 'writer-draft', 'مسودة الكاتب', 'draft', auth.uid());
  update public.articles set status = 'review' where id = 'cccccccc-0000-0000-0000-000000000002';
end $$;
do $$ begin
  update public.articles set status = 'published', published_at = now() where id = 'cccccccc-0000-0000-0000-000000000002';
  raise exception 'TEST FAILED: writer published an article';
exception when insufficient_privilege then null;
end $$;
do $$ declare n int; begin
  update public.articles set title = 'تعديل' where id = 'cccccccc-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: writer edited someone else''s article'; end if;
end $$;
do $$ begin
  insert into public.media_assets (bucket, path, kind, mime_type, bytes, uploaded_by)
    values ('images', '2026/11/writer-photo.jpg', 'image', 'image/jpeg', 1024, auth.uid());
end $$;
do $$ begin
  insert into public.media_assets (bucket, path, kind, mime_type, bytes, uploaded_by)
    values ('images', '2026/11/spoofed.jpg', 'image', 'image/jpeg', 1024, '33333333-3333-3333-3333-333333333333');
  raise exception 'TEST FAILED: writer attributed an upload to someone else';
exception when insufficient_privilege then null;
end $$;
do $$ declare n int; begin
  delete from public.media_assets where path = '2026/11/writer-photo.jpg';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: writer deleted media'; end if;
end $$;
do $$ begin
  insert into public.episodes (podcast_id, slug, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'writer-ep', 'x');
  raise exception 'TEST FAILED: writer created an episode';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  if exists (select 1 from public.contact_messages) or exists (select 1 from public.subscribers) then
    raise exception 'TEST FAILED: writer reads the inbox';
  end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Editor
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);
do $$ begin
  update public.articles set status = 'published', published_at = now() where id = 'cccccccc-0000-0000-0000-000000000002';
  if not found then raise exception 'TEST FAILED: editor could not publish'; end if;
  insert into public.episodes (podcast_id, slug, title, status) values ('aaaaaaaa-0000-0000-0000-000000000001', 'editor-ep', 'حلقة المحرر', 'draft');
  perform public.analytics_overview(7);
end $$;
do $$ declare n int; begin
  -- RLS hides other profiles from the update, so nothing changes.
  update public.profiles set role = 'editor' where email = 'writer@wared.test';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: editor changed a role'; end if;
exception when insufficient_privilege then null;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Admin and owner
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
do $$ begin
  update public.profiles set role = 'editor' where email = 'writer@wared.test';
end $$;
do $$ begin
  update public.profiles set role = 'admin' where email = 'editor@wared.test';
  raise exception 'TEST FAILED: admin promoted someone to admin';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.profiles set role = 'writer' where email = 'owner@wared.test';
  raise exception 'TEST FAILED: admin demoted the owner';
exception when insufficient_privilege then null;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
do $$ begin
  update public.profiles set role = 'writer' where id = auth.uid();
  raise exception 'TEST FAILED: owner changed own role';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.profiles set role = 'admin' where email = 'editor@wared.test';
  if not exists (select 1 from public.audit_logs where entity_type = 'profiles' and actor_id = auth.uid()) then
    raise exception 'TEST FAILED: role change not audited with actor';
  end if;
  if (select count(*) from public.site_settings) <> 5 then raise exception 'TEST FAILED: owner cannot read all settings'; end if;
end $$;
reset role;

-- The last owner cannot be removed, even by trusted SQL.
do $$ begin
  update public.profiles set role = 'admin' where email = 'owner@wared.test';
  raise exception 'TEST FAILED: removed the last owner';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------------
-- Service role
-- ---------------------------------------------------------------------------
set role service_role;
do $$ begin
  if not public.hit_rate_limit('test:key', 2, 60) then raise exception 'TEST FAILED: first hit limited'; end if;
  if not public.hit_rate_limit('test:key', 2, 60) then raise exception 'TEST FAILED: second hit limited'; end if;
  if public.hit_rate_limit('test:key', 2, 60) then raise exception 'TEST FAILED: third hit not limited'; end if;
  insert into public.contact_messages (name, email, message) values ('سارة', 'sara@example.com', 'رسالة تجريبية للاختبار');
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.audit_logs where entity_type = 'episodes' and action = 'insert') then
    raise exception 'TEST FAILED: inserts are not audited';
  end if;
end $$;

select 'all RLS assertions passed' as result;
