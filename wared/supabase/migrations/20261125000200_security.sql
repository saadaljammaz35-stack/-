-- وارد — Row Level Security, grants and privileged functions.
--
-- Model:
--   * anon / authenticated visitors can only SELECT content that is live (published or scheduled with a
--     publish time in the past) and public settings.
--   * Staff (profiles.role not null, is_active) read everything and write according to roles.permissions.
--   * Public form submissions, analytics and listening progress are written by the Next.js server with the
--     service role after validation and rate limiting. There are deliberately NO anon insert policies, so the
--     public anon key cannot be used to bypass the server's checks.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.media_assets enable row level security;
alter table public.podcasts enable row level security;
alter table public.episodes enable row level security;
alter table public.episode_chapters enable row level security;
alter table public.transcripts enable row level security;
alter table public.guests enable row level security;
alter table public.episode_guests enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.clips enable row level security;
alter table public.subscribers enable row level security;
alter table public.sponsorship_requests enable row level security;
alter table public.contact_messages enable row level security;
alter table public.listening_progress enable row level security;
alter table public.analytics_events enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Grants (defence in depth on top of RLS)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Public read surface.
grant select on public.podcasts, public.episodes, public.episode_chapters, public.transcripts, public.guests,
  public.episode_guests, public.categories, public.articles, public.clips, public.media_assets,
  public.site_settings to anon, authenticated;

-- Staff write surface (still filtered by RLS).
grant select on public.roles, public.profiles to authenticated;
grant update (full_name, avatar_url, role, is_active, last_sign_in_at) on public.profiles to authenticated;
grant insert, update, delete on public.podcasts, public.episodes, public.episode_chapters, public.transcripts,
  public.guests, public.episode_guests, public.categories, public.articles, public.clips to authenticated;
grant insert, delete on public.media_assets to authenticated;
grant update (alt, alt_en, credit) on public.media_assets to authenticated;
grant select, update, delete on public.subscribers, public.sponsorship_requests, public.contact_messages to authenticated;
grant select on public.analytics_events, public.listening_progress, public.audit_logs to authenticated;
grant update (value, updated_by) on public.site_settings to authenticated;
-- rate_limits: no grants. Only the service role touches it.

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- roles / profiles
drop policy if exists roles_staff_read on public.roles;
create policy roles_staff_read on public.roles for select to authenticated
  using ((select public.is_staff()));

drop policy if exists profiles_self_or_staff_read on public.profiles;
create policy profiles_self_or_staff_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.has_permission('users.manage')))
  with check (id = (select auth.uid()) or (select public.has_permission('users.manage')));

-- media_assets: metadata is public (the files themselves live in public buckets), edits for staff.
drop policy if exists media_public_read on public.media_assets;
create policy media_public_read on public.media_assets for select to anon, authenticated using (true);

drop policy if exists media_staff_insert on public.media_assets;
create policy media_staff_insert on public.media_assets for insert to authenticated
  with check ((select public.has_permission('media.upload')) and uploaded_by = (select auth.uid()));

drop policy if exists media_staff_delete on public.media_assets;
create policy media_staff_delete on public.media_assets for delete to authenticated
  using ((select public.has_permission('media.delete')));

drop policy if exists media_staff_update on public.media_assets;
create policy media_staff_update on public.media_assets for update to authenticated
  using ((select public.has_permission('media.upload')))
  with check ((select public.has_permission('media.upload')));

-- podcasts
drop policy if exists podcasts_read on public.podcasts;
create policy podcasts_read on public.podcasts for select to anon, authenticated
  using (public.is_live(status, published_at) or (select public.has_permission('content.read_all')));

drop policy if exists podcasts_insert on public.podcasts;
create policy podcasts_insert on public.podcasts for insert to authenticated
  with check ((select public.has_permission('content.edit_any'))
              and (status in ('draft', 'review') or (select public.has_permission('content.publish'))));

drop policy if exists podcasts_update on public.podcasts;
create policy podcasts_update on public.podcasts for update to authenticated
  using ((select public.has_permission('content.edit_any')))
  with check (status in ('draft', 'review') or (select public.has_permission('content.publish')));

drop policy if exists podcasts_delete on public.podcasts;
create policy podcasts_delete on public.podcasts for delete to authenticated
  using ((select public.has_permission('content.delete')));

-- episodes: live only when the parent program is live too.
drop policy if exists episodes_read on public.episodes;
create policy episodes_read on public.episodes for select to anon, authenticated
  using (
    (public.is_live(status, published_at)
      and exists (select 1 from public.podcasts p where p.id = podcast_id and public.is_live(p.status, p.published_at)))
    or (select public.has_permission('content.read_all'))
  );

drop policy if exists episodes_insert on public.episodes;
create policy episodes_insert on public.episodes for insert to authenticated
  with check ((select public.has_permission('content.edit_any'))
              and (status in ('draft', 'review') or (select public.has_permission('content.publish'))));

drop policy if exists episodes_update on public.episodes;
create policy episodes_update on public.episodes for update to authenticated
  using ((select public.has_permission('content.edit_any')))
  with check (status in ('draft', 'review') or (select public.has_permission('content.publish')));

drop policy if exists episodes_delete on public.episodes;
create policy episodes_delete on public.episodes for delete to authenticated
  using ((select public.has_permission('content.delete')));

-- Children of episodes inherit visibility from the episode row (RLS on episodes applies inside EXISTS).
drop policy if exists chapters_read on public.episode_chapters;
create policy chapters_read on public.episode_chapters for select to anon, authenticated
  using (exists (select 1 from public.episodes e where e.id = episode_id));

drop policy if exists chapters_write on public.episode_chapters;
create policy chapters_write on public.episode_chapters for all to authenticated
  using ((select public.has_permission('content.edit_any')))
  with check ((select public.has_permission('content.edit_any')));

drop policy if exists transcripts_read on public.transcripts;
create policy transcripts_read on public.transcripts for select to anon, authenticated
  using (exists (select 1 from public.episodes e where e.id = episode_id));

drop policy if exists transcripts_write on public.transcripts;
create policy transcripts_write on public.transcripts for all to authenticated
  using ((select public.has_permission('content.edit_any')))
  with check ((select public.has_permission('content.edit_any')));

-- guests
drop policy if exists guests_read on public.guests;
create policy guests_read on public.guests for select to anon, authenticated
  using (public.is_live(status, published_at) or (select public.has_permission('content.read_all')));

drop policy if exists guests_insert on public.guests;
create policy guests_insert on public.guests for insert to authenticated
  with check ((select public.has_permission('content.edit_any'))
              and (status in ('draft', 'review') or (select public.has_permission('content.publish'))));

drop policy if exists guests_update on public.guests;
create policy guests_update on public.guests for update to authenticated
  using ((select public.has_permission('content.edit_any')))
  with check (status in ('draft', 'review') or (select public.has_permission('content.publish')));

drop policy if exists guests_delete on public.guests;
create policy guests_delete on public.guests for delete to authenticated
  using ((select public.has_permission('content.delete')));

drop policy if exists episode_guests_read on public.episode_guests;
create policy episode_guests_read on public.episode_guests for select to anon, authenticated
  using (exists (select 1 from public.episodes e where e.id = episode_id)
         and exists (select 1 from public.guests g where g.id = guest_id));

drop policy if exists episode_guests_write on public.episode_guests;
create policy episode_guests_write on public.episode_guests for all to authenticated
  using ((select public.has_permission('content.edit_any')))
  with check ((select public.has_permission('content.edit_any')));

-- categories
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to anon, authenticated using (true);

drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all to authenticated
  using ((select public.has_permission('content.edit_any')))
  with check ((select public.has_permission('content.edit_any')));

-- articles: writers create and edit their own drafts; editors and above manage everything.
drop policy if exists articles_read on public.articles;
create policy articles_read on public.articles for select to anon, authenticated
  using (public.is_live(status, published_at) or (select public.has_permission('content.read_all')));

drop policy if exists articles_insert on public.articles;
create policy articles_insert on public.articles for insert to authenticated
  with check (
    (select public.has_permission('content.create'))
    and created_by = (select auth.uid())
    and (status in ('draft', 'review') or (select public.has_permission('content.publish')))
  );

drop policy if exists articles_update on public.articles;
create policy articles_update on public.articles for update to authenticated
  using (
    (select public.has_permission('content.edit_any'))
    or (created_by = (select auth.uid()) and status in ('draft', 'review') and (select public.has_permission('content.create')))
  )
  with check (
    status in ('draft', 'review') or (select public.has_permission('content.publish'))
  );

drop policy if exists articles_delete on public.articles;
create policy articles_delete on public.articles for delete to authenticated
  using (
    (select public.has_permission('content.delete'))
    or (created_by = (select auth.uid()) and status = 'draft')
  );

-- clips
drop policy if exists clips_read on public.clips;
create policy clips_read on public.clips for select to anon, authenticated
  using (public.is_live(status, published_at) or (select public.has_permission('content.read_all')));

drop policy if exists clips_insert on public.clips;
create policy clips_insert on public.clips for insert to authenticated
  with check ((select public.has_permission('content.edit_any'))
              and (status in ('draft', 'review') or (select public.has_permission('content.publish'))));

drop policy if exists clips_update on public.clips;
create policy clips_update on public.clips for update to authenticated
  using ((select public.has_permission('content.edit_any')))
  with check (status in ('draft', 'review') or (select public.has_permission('content.publish')));

drop policy if exists clips_delete on public.clips;
create policy clips_delete on public.clips for delete to authenticated
  using ((select public.has_permission('content.delete')));

-- subscribers, inbox
drop policy if exists subscribers_manage on public.subscribers;
create policy subscribers_manage on public.subscribers for all to authenticated
  using ((select public.has_permission('subscribers.manage')))
  with check ((select public.has_permission('subscribers.manage')));

drop policy if exists sponsorship_manage on public.sponsorship_requests;
create policy sponsorship_manage on public.sponsorship_requests for all to authenticated
  using ((select public.has_permission('inbox.manage')))
  with check ((select public.has_permission('inbox.manage')));

drop policy if exists contact_manage on public.contact_messages;
create policy contact_manage on public.contact_messages for all to authenticated
  using ((select public.has_permission('inbox.manage')))
  with check ((select public.has_permission('inbox.manage')));

-- analytics, progress, audit: read-only for the right staff.
drop policy if exists analytics_read on public.analytics_events;
create policy analytics_read on public.analytics_events for select to authenticated
  using ((select public.has_permission('analytics.read')));

drop policy if exists progress_read on public.listening_progress;
create policy progress_read on public.listening_progress for select to authenticated
  using ((select public.has_permission('analytics.read')));

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
  using ((select public.has_permission('audit.read')));

-- settings
drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings for select to anon, authenticated
  using (is_public or (select public.has_permission('settings.manage')));

drop policy if exists settings_update on public.site_settings;
create policy settings_update on public.site_settings for update to authenticated
  using ((select public.has_permission('settings.manage')))
  with check ((select public.has_permission('settings.manage')));

-- ---------------------------------------------------------------------------
-- Privileged functions
-- ---------------------------------------------------------------------------

-- Fixed-window rate limiter used by the server (service role only).
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  current_count int;
begin
  if p_limit < 1 or p_window_seconds < 1 or char_length(p_key) > 200 then
    raise exception 'invalid rate limit arguments';
  end if;

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, bucket, 1)
  on conflict (key, window_start) do update set count = rl.count + 1
  returning count into current_count;

  -- Opportunistic cleanup of old windows (cheap, indexed by primary key prefix scan is not needed here).
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return current_count <= p_limit;
end;
$$;

-- Unified public search across live content. Visibility is enforced by RLS of the caller (security invoker).
create or replace function public.search_content(q text, max_results int default 30)
returns table (
  kind text,
  id uuid,
  slug text,
  title text,
  title_en text,
  excerpt text,
  published_at timestamptz,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with query as (
    select public.build_prefix_tsquery(left(q, 120)) as tsq,
           '%' || public.normalize_ar(left(q, 120)) || '%' as pattern
  ),
  results as (
    select 'episode'::text as kind, e.id, e.slug, e.title, e.title_en, e.summary as excerpt, e.published_at,
           ts_rank(e.search_vector, query.tsq) + case when public.normalize_ar(e.title) like query.pattern then 1 else 0 end as rank
    from public.episodes e, query
    where query.tsq is not null and (e.search_vector @@ query.tsq or public.normalize_ar(e.title) like query.pattern)
    union all
    select 'episode', e.id, e.slug, e.title, e.title_en, e.summary, e.published_at,
           ts_rank(t.search_vector, query.tsq) * 0.5
    from public.transcripts t
    join public.episodes e on e.id = t.episode_id, query
    where query.tsq is not null and t.search_vector @@ query.tsq
    union all
    select 'article', a.id, a.slug, a.title, a.title_en, a.dek, a.published_at,
           ts_rank(a.search_vector, query.tsq) + case when public.normalize_ar(a.title) like query.pattern then 1 else 0 end
    from public.articles a, query
    where query.tsq is not null and (a.search_vector @@ query.tsq or public.normalize_ar(a.title) like query.pattern)
    union all
    select 'guest', g.id, g.slug, g.name, g.name_en, g.headline, g.published_at,
           ts_rank(g.search_vector, query.tsq) + case when public.normalize_ar(g.name) like query.pattern then 1 else 0 end
    from public.guests g, query
    where query.tsq is not null and (g.search_vector @@ query.tsq or public.normalize_ar(g.name) like query.pattern)
    union all
    select 'program', p.id, p.slug, p.title, p.title_en, p.tagline, p.published_at, ts_rank(p.search_vector, query.tsq)
    from public.podcasts p, query
    where query.tsq is not null and p.search_vector @@ query.tsq
    union all
    select 'clip', c.id, c.slug, c.title, c.title_en, c.description, c.published_at, ts_rank(c.search_vector, query.tsq)
    from public.clips c, query
    where query.tsq is not null and c.search_vector @@ query.tsq
  )
  select distinct on (r.kind, r.id) r.kind, r.id, r.slug, r.title, r.title_en, r.excerpt, r.published_at, r.rank::real
  from results r
  order by r.kind, r.id, r.rank desc
  limit greatest(1, least(max_results, 50));
$$;

-- Dashboard analytics. Raises unless the caller may read analytics.
create or replace function public.analytics_overview(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz;
  result jsonb;
begin
  if not public.has_permission('analytics.read') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  since := date_trunc('day', now()) - make_interval(days => greatest(1, least(p_days, 365)) - 1);

  with ev as (
    select * from public.analytics_events where created_at >= since
  ),
  days as (
    select generate_series(since, date_trunc('day', now()), interval '1 day') as day
  )
  select jsonb_build_object(
    'since', since,
    'totals', jsonb_build_object(
      'page_views', (select count(*) from ev where event_type = 'page_view'),
      'plays', (select count(*) from ev where event_type = 'play_start'),
      'completions', (select count(*) from ev where event_type = 'play_complete'),
      'listeners', (select count(distinct listener_id) from ev where event_type = 'play_start' and listener_id is not null),
      'shares', (select count(*) from ev where event_type = 'share'),
      'newsletter_signups', (select count(*) from ev where event_type = 'newsletter_signup')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'page_views', (select count(*) from ev where event_type = 'page_view' and date_trunc('day', created_at) = d.day),
        'plays', (select count(*) from ev where event_type = 'play_start' and date_trunc('day', created_at) = d.day)
      ) order by d.day), '[]'::jsonb)
      from days d
    ),
    'top_episodes', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select e.id, e.slug, e.title,
               count(*) filter (where ev.event_type = 'play_start') as plays,
               count(*) filter (where ev.event_type = 'play_complete') as completions
        from ev join public.episodes e on e.id = ev.episode_id
        group by e.id, e.slug, e.title
        order by plays desc
        limit 10
      ) t
    ),
    'top_paths', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select path, count(*) as views from ev where event_type = 'page_view' and path is not null
        group by path order by views desc limit 10
      ) t
    ),
    'devices', (
      select coalesce(jsonb_object_agg(coalesce(device, 'other'), c), '{}'::jsonb) from (
        select device, count(*) as c from ev where event_type = 'page_view' group by device
      ) t
    ),
    'referrers', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select referrer_host as host, count(*) as visits from ev
        where event_type = 'page_view' and referrer_host is not null
        group by referrer_host order by visits desc limit 10
      ) t
    )
  ) into result;

  return result;
end;
$$;

-- Lock down function execution. Supabase grants EXECUTE to public by default.
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;
revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.analytics_overview(int) from public, anon;
grant execute on function public.analytics_overview(int) to authenticated;
grant execute on function public.search_content(text, int) to anon, authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.current_staff_role() to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.hit_rate_limit(text, int, int) to service_role;
  end if;
end $$;
