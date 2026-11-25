-- WARD montage (automatic editing): media files kept in object storage, edit projects,
-- and the renders they produce. Video never goes into Postgres — only its storage key.

alter table ward.jobs drop constraint if exists jobs_kind_check;
alter table ward.jobs add constraint jobs_kind_check check (kind in (
  'workflow.advance', 'meeting.run', 'automation.run', 'knowledge.index',
  'montage.plan', 'montage.poll'
));

create table ward.media_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  episode_id uuid references ward.episodes(id) on delete set null,
  kind text not null check (kind in ('source', 'transcript', 'episode_render', 'short_render', 'thumbnail')),
  storage text not null check (storage in ('local', 'vercel-blob')),
  storage_key text not null check (length(storage_key) between 1 and 1024),
  name text not null check (length(name) between 1 and 255),
  mime text not null,
  size bigint not null check (size >= 0),
  duration_s numeric(10, 3),
  width integer,
  height integer,
  meta jsonb not null default '{}'::jsonb,
  uploaded_by uuid references ward.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage, storage_key)
);
create index on ward.media_assets (org_id, episode_id);

create table ward.montage_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  episode_id uuid not null references ward.episodes(id) on delete cascade,
  source_asset_id uuid not null references ward.media_assets(id) on delete restrict,
  transcript_asset_id uuid references ward.media_assets(id) on delete set null,
  status text not null default 'analyzing'
    check (status in ('analyzing', 'planning', 'review', 'rendering', 'done', 'failed', 'cancelled')),
  stage text,
  progress numeric(5, 2) not null default 0,
  transcript_source text not null default 'whisper' check (transcript_source in ('whisper', 'upload', 'none')),
  settings jsonb not null default '{}'::jsonb,
  probe jsonb,
  silences jsonb,
  transcript jsonb,
  plan jsonb,
  plan_run_id uuid references ward.agent_runs(id) on delete set null,
  cost_usd numeric(12, 6) not null default 0,
  cost_limit_usd numeric(12, 4) not null default 1.5 check (cost_limit_usd > 0),
  runner jsonb,
  error text,
  approved_by uuid references ward.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references ward.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on ward.montage_projects (org_id, episode_id, created_at desc);
create trigger montage_projects_touch before update on ward.montage_projects for each row execute function ward.touch_updated_at();

create table ward.montage_renders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  project_id uuid not null references ward.montage_projects(id) on delete cascade,
  kind text not null check (kind in ('episode', 'short')),
  name text not null check (name ~ '^[a-z0-9-]{1,40}$'),
  title text not null default '',
  spec jsonb not null default '{}'::jsonb,
  status text not null default 'rendering' check (status in ('rendering', 'done', 'failed')),
  asset_id uuid references ward.media_assets(id) on delete set null,
  thumbnail_asset_id uuid references ward.media_assets(id) on delete set null,
  duration_s numeric(10, 3),
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (project_id, name)
);

grant select, insert, update, delete on ward.media_assets, ward.montage_projects, ward.montage_renders to ward_app;

do $$
declare t text;
begin
  foreach t in array array['media_assets', 'montage_projects', 'montage_renders'] loop
    execute format('alter table ward.%I enable row level security', t);
    execute format(
      'create policy org_isolation on ward.%I for all to ward_app using (org_id = ward.current_org()) with check (org_id = ward.current_org())',
      t);
  end loop;
end
$$;
