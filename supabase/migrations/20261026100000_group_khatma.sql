-- «مع الله» group khatma: a khatma shared by link among family or friends, each person
-- taking one or more of the thirty juz.
--
-- No accounts are needed. Each device keeps a random secret token; the database stores it
-- with the khatma it created and the juz it took, and only that token can change them.
-- The tables are closed to direct access (RLS on, no policies); everything goes through the
-- functions below, which never return a token.

create table if not exists public.group_khatmas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (char_length(name) between 1 and 60),
  owner_token uuid not null,
  round integer not null default 1,
  completed_rounds integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.group_khatma_parts (
  khatma_id uuid not null references public.group_khatmas (id) on delete cascade,
  juz smallint not null check (juz between 1 and 30),
  member_name text not null check (char_length(member_name) between 1 and 40),
  member_token uuid not null,
  done boolean not null default false,
  claimed_at timestamptz not null default now(),
  done_at timestamptz,
  primary key (khatma_id, juz)
);

create index if not exists group_khatmas_owner_idx on public.group_khatmas (owner_token);
create index if not exists group_khatma_parts_member_idx on public.group_khatma_parts (member_token);

alter table public.group_khatmas enable row level security;
alter table public.group_khatma_parts enable row level security;
revoke all on public.group_khatmas from anon, authenticated;
revoke all on public.group_khatma_parts from anon, authenticated;

-- The khatma as the app shows it; `mine` marks the caller's juz, `owner` the caller's khatma.
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

create or replace function public.gk_create(p_name text, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if p_token is null then
    raise exception 'missing token';
  end if;
  if (select count(*) from public.group_khatmas where owner_token = p_token) >= 20 then
    raise exception 'too many khatmas';
  end if;
  -- The code is the khatma's only secret, so it comes from a cryptographic source.
  loop
    select string_agg(substr(v_alphabet, 1 + get_byte(b.bytes, i) % length(v_alphabet), 1), '' order by i)
      into v_code
      from (select extensions.gen_random_bytes(8) as bytes) b, generate_series(0, 7) as i;
    exit when not exists (select 1 from public.group_khatmas where code = v_code);
  end loop;
  insert into public.group_khatmas (code, name, owner_token) values (v_code, trim(p_name), p_token);
  return public.gk_view(v_code, p_token);
end;
$$;

create or replace function public.gk_claim(p_code text, p_juz integer, p_name text, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.group_khatmas where code = upper(p_code);
  if v_id is null then
    raise exception 'not found';
  end if;
  if p_token is null then
    raise exception 'missing token';
  end if;
  insert into public.group_khatma_parts (khatma_id, juz, member_name, member_token)
  values (v_id, p_juz, trim(p_name), p_token)
  on conflict (khatma_id, juz) do nothing;
  if not found then
    raise exception 'taken';
  end if;
  return public.gk_view(p_code, p_token);
end;
$$;

create or replace function public.gk_set_done(p_code text, p_juz integer, p_done boolean, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.group_khatma_parts p
     set done = p_done, done_at = case when p_done then now() else null end
    from public.group_khatmas k
   where k.code = upper(p_code) and p.khatma_id = k.id and p.juz = p_juz and p.member_token = p_token;
  if not found then
    raise exception 'not yours';
  end if;
  return public.gk_view(p_code, p_token);
end;
$$;

-- A member can give back their own juz; the creator can free any juz (e.g. one left unread).
create or replace function public.gk_release(p_code text, p_juz integer, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.group_khatma_parts p
   using public.group_khatmas k
   where k.code = upper(p_code) and p.khatma_id = k.id and p.juz = p_juz
     and (p.member_token = p_token or k.owner_token = p_token);
  if not found then
    raise exception 'not yours';
  end if;
  return public.gk_view(p_code, p_token);
end;
$$;

-- When all thirty are read, the creator starts the next round with every juz free again.
create or replace function public.gk_new_round(p_code text, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.group_khatmas where code = upper(p_code) and owner_token = p_token;
  if v_id is null then
    raise exception 'not yours';
  end if;
  if (select count(*) from public.group_khatma_parts where khatma_id = v_id and done) < 30 then
    raise exception 'not finished';
  end if;
  delete from public.group_khatma_parts where khatma_id = v_id;
  update public.group_khatmas set round = round + 1, completed_rounds = completed_rounds + 1 where id = v_id;
  return public.gk_view(p_code, p_token);
end;
$$;

create or replace function public.gk_delete(p_code text, p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.group_khatmas where code = upper(p_code) and owner_token = p_token;
  if not found then
    raise exception 'not yours';
  end if;
end;
$$;

revoke all on function public.gk_view(text, uuid) from public;
revoke all on function public.gk_create(text, uuid) from public;
revoke all on function public.gk_claim(text, integer, text, uuid) from public;
revoke all on function public.gk_set_done(text, integer, boolean, uuid) from public;
revoke all on function public.gk_release(text, integer, uuid) from public;
revoke all on function public.gk_new_round(text, uuid) from public;
revoke all on function public.gk_delete(text, uuid) from public;
grant execute on function public.gk_view(text, uuid) to anon, authenticated;
grant execute on function public.gk_create(text, uuid) to anon, authenticated;
grant execute on function public.gk_claim(text, integer, text, uuid) to anon, authenticated;
grant execute on function public.gk_set_done(text, integer, boolean, uuid) to anon, authenticated;
grant execute on function public.gk_release(text, integer, uuid) to anon, authenticated;
grant execute on function public.gk_new_round(text, uuid) to anon, authenticated;
grant execute on function public.gk_delete(text, uuid) to anon, authenticated;
