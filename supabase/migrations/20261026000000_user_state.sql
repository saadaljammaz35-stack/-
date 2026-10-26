-- «مع الله» optional account sync.
-- One row per user holding the app's synced state (bookmarks, khatmas, adhkar favourites,
-- tasbih, fasting log, settings). Row Level Security restricts every row to its owner.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "own row: select" on public.user_state
  for select using (auth.uid() = user_id);
create policy "own row: insert" on public.user_state
  for insert with check (auth.uid() = user_id);
create policy "own row: update" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row: delete" on public.user_state
  for delete using (auth.uid() = user_id);

-- Lets a signed-in user delete their own account and all of its data.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from public.user_state where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
