-- Ma Allah circles: «دائرة العائلة» (up to 20 people) and «رفيق الأذكار» (two people), shared by
-- a code like the group khatma. Each member shares, by choice, only whether they did a few good
-- things today (all five prayers, morning and evening adhkar, some Quran) — never what they
-- missed or any count — and can send a word of encouragement.
--
-- As with group khatmas: no accounts; each device has a random secret token; tables are closed
-- (RLS on, no policies) and reached only through the functions below, which never return a
-- token. Members are pointed at by a separate public id.
--
-- Also: an optional dedication on a group khatma («ختمة مهداة»), shown with the dua for the
-- deceased when it is complete.

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('family', 'buddy')),
  owner_token uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  member_token uuid not null,
  public_id uuid not null default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (circle_id, member_token),
  unique (public_id)
);

create table if not exists public.circle_days (
  circle_id uuid not null references public.circles (id) on delete cascade,
  member_token uuid not null,
  day date not null,
  prayers boolean not null default false,
  morning boolean not null default false,
  evening boolean not null default false,
  quran boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (circle_id, member_token, day)
);

create table if not exists public.circle_cheers (
  circle_id uuid not null references public.circles (id) on delete cascade,
  from_token uuid not null,
  to_public_id uuid not null,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (circle_id, from_token, to_public_id, day)
);

create index if not exists circle_members_token_idx on public.circle_members (member_token);
create index if not exists circles_owner_idx on public.circles (owner_token);

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_days enable row level security;
alter table public.circle_cheers enable row level security;
revoke all on public.circles from anon, authenticated;
revoke all on public.circle_members from anon, authenticated;
revoke all on public.circle_days from anon, authenticated;
revoke all on public.circle_cheers from anon, authenticated;

-- Consecutive days, ending on p_day (or the day before, while p_day is still in progress), on
-- which every member of a two-person circle did both the morning and the evening adhkar.
create or replace function public.cc_streak(p_circle uuid, p_day date)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_members integer;
  v_day date := p_day;
  v_n integer := 0;
  v_done integer;
begin
  select count(*) into v_members from public.circle_members where circle_id = p_circle;
  if v_members < 2 then
    return 0;
  end if;
  select count(*) into v_done from public.circle_days
   where circle_id = p_circle and day = v_day and morning and evening;
  if v_done < v_members then
    v_day := v_day - 1;
  end if;
  loop
    select count(*) into v_done from public.circle_days
     where circle_id = p_circle and day = v_day and morning and evening;
    exit when v_done < v_members or v_n >= 3650;
    v_n := v_n + 1;
    v_day := v_day - 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.cc_view(p_code text, p_day date, p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', c.code,
    'name', c.name,
    'kind', c.kind,
    'owner', c.owner_token = p_token,
    'member', exists (select 1 from public.circle_members m where m.circle_id = c.id and m.member_token = p_token),
    'streak', case when c.kind = 'buddy' then public.cc_streak(c.id, p_day) else null end,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.public_id,
        'name', m.name,
        'mine', m.member_token = p_token,
        'prayers', coalesce(d.prayers, false),
        'morning', coalesce(d.morning, false),
        'evening', coalesce(d.evening, false),
        'quran', coalesce(d.quran, false),
        'cheers', (select count(*) from public.circle_cheers h where h.circle_id = c.id and h.to_public_id = m.public_id and h.day = p_day),
        'cheered', exists (select 1 from public.circle_cheers h where h.circle_id = c.id and h.to_public_id = m.public_id and h.day = p_day and h.from_token = p_token)
      ) order by m.joined_at)
      from public.circle_members m
      left join public.circle_days d on d.circle_id = c.id and d.member_token = m.member_token and d.day = p_day
      where m.circle_id = c.id
    ), '[]'::jsonb)
  )
  from public.circles c
  where c.code = upper(p_code);
$$;

create or replace function public.cc_create(p_name text, p_kind text, p_member_name text, p_day date, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_id uuid;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if p_token is null then
    raise exception 'missing token';
  end if;
  if (select count(*) from public.circles where owner_token = p_token) >= 20 then
    raise exception 'too many circles';
  end if;
  loop
    select string_agg(substr(v_alphabet, 1 + get_byte(b.bytes, i) % length(v_alphabet), 1), '' order by i)
      into v_code
      from (select extensions.gen_random_bytes(8) as bytes) b, generate_series(0, 7) as i;
    exit when not exists (select 1 from public.circles where code = v_code);
  end loop;
  insert into public.circles (code, name, kind, owner_token) values (v_code, trim(p_name), p_kind, p_token) returning id into v_id;
  insert into public.circle_members (circle_id, member_token, name) values (v_id, p_token, trim(p_member_name));
  return public.cc_view(v_code, p_day, p_token);
end;
$$;

create or replace function public.cc_join(p_code text, p_member_name text, p_day date, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_kind text;
  v_count integer;
begin
  select id, kind into v_id, v_kind from public.circles where code = upper(p_code);
  if v_id is null then
    raise exception 'not found';
  end if;
  if p_token is null then
    raise exception 'missing token';
  end if;
  if exists (select 1 from public.circle_members where circle_id = v_id and member_token = p_token) then
    return public.cc_view(p_code, p_day, p_token);
  end if;
  select count(*) into v_count from public.circle_members where circle_id = v_id;
  if v_count >= case when v_kind = 'buddy' then 2 else 20 end then
    raise exception 'full';
  end if;
  insert into public.circle_members (circle_id, member_token, name) values (v_id, p_token, trim(p_member_name));
  return public.cc_view(p_code, p_day, p_token);
end;
$$;

create or replace function public.cc_report(p_code text, p_day date, p_prayers boolean, p_morning boolean, p_evening boolean, p_quran boolean, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select c.id into v_id from public.circles c
    join public.circle_members m on m.circle_id = c.id and m.member_token = p_token
   where c.code = upper(p_code);
  if v_id is null then
    raise exception 'not yours';
  end if;
  -- Only today and the two days before can be set.
  if p_day < current_date - 2 or p_day > current_date + 1 then
    raise exception 'bad day';
  end if;
  insert into public.circle_days (circle_id, member_token, day, prayers, morning, evening, quran)
  values (v_id, p_token, p_day, p_prayers, p_morning, p_evening, p_quran)
  on conflict (circle_id, member_token, day) do update
    set prayers = excluded.prayers, morning = excluded.morning, evening = excluded.evening, quran = excluded.quran, updated_at = now();
  return public.cc_view(p_code, p_day, p_token);
end;
$$;

create or replace function public.cc_cheer(p_code text, p_member uuid, p_day date, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select c.id into v_id from public.circles c
    join public.circle_members m on m.circle_id = c.id and m.member_token = p_token
   where c.code = upper(p_code);
  if v_id is null or not exists (select 1 from public.circle_members where circle_id = v_id and public_id = p_member) then
    raise exception 'not yours';
  end if;
  insert into public.circle_cheers (circle_id, from_token, to_public_id, day) values (v_id, p_token, p_member, p_day)
  on conflict do nothing;
  return public.cc_view(p_code, p_day, p_token);
end;
$$;

-- Leaving removes the member and what they shared; the creator leaving deletes the circle.
create or replace function public.cc_leave(p_code text, p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_owner uuid;
begin
  select id, owner_token into v_id, v_owner from public.circles where code = upper(p_code);
  if v_id is null then
    return;
  end if;
  if v_owner = p_token then
    delete from public.circles where id = v_id;
    return;
  end if;
  delete from public.circle_days where circle_id = v_id and member_token = p_token;
  delete from public.circle_cheers where circle_id = v_id and from_token = p_token;
  delete from public.circle_members where circle_id = v_id and member_token = p_token;
end;
$$;

revoke all on function public.cc_streak(uuid, date) from public;
revoke all on function public.cc_view(text, date, uuid) from public;
revoke all on function public.cc_create(text, text, text, date, uuid) from public;
revoke all on function public.cc_join(text, text, date, uuid) from public;
revoke all on function public.cc_report(text, date, boolean, boolean, boolean, boolean, uuid) from public;
revoke all on function public.cc_cheer(text, uuid, date, uuid) from public;
revoke all on function public.cc_leave(text, uuid) from public;
grant execute on function public.cc_view(text, date, uuid) to anon, authenticated;
grant execute on function public.cc_create(text, text, text, date, uuid) to anon, authenticated;
grant execute on function public.cc_join(text, text, date, uuid) to anon, authenticated;
grant execute on function public.cc_report(text, date, boolean, boolean, boolean, boolean, uuid) to anon, authenticated;
grant execute on function public.cc_cheer(text, uuid, date, uuid) to anon, authenticated;
grant execute on function public.cc_leave(text, uuid) to anon, authenticated;

-- «ختمة مهداة»: a group khatma dedicated to someone who has died.
alter table public.group_khatmas add column if not exists dedication text check (dedication is null or char_length(dedication) between 1 and 60);

create or replace function public.gk_view(p_code text, p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', k.code,
    'name', k.name,
    'dedication', k.dedication,
    'round', k.round,
    'completedRounds', k.completed_rounds,
    'createdAt', k.created_at,
    'owner', k.owner_token = p_token,
    'parts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'juz', p.juz,
        'name', p.member_name,
        'done', p.done,
        'mine', p.member_token = p_token,
        'claimedAt', p.claimed_at,
        'doneAt', p.done_at
      ) order by p.juz)
      from public.group_khatma_parts p
      where p.khatma_id = k.id
    ), '[]'::jsonb)
  )
  from public.group_khatmas k
  where k.code = upper(p_code);
$$;

create or replace function public.gk_create_dedicated(p_name text, p_dedication text, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_view jsonb;
begin
  v_view := public.gk_create(p_name, p_token);
  update public.group_khatmas set dedication = nullif(trim(p_dedication), '') where code = v_view ->> 'code';
  return public.gk_view(v_view ->> 'code', p_token);
end;
$$;

revoke all on function public.gk_create_dedicated(text, text, uuid) from public;
grant execute on function public.gk_create_dedicated(text, text, uuid) to anon, authenticated;
