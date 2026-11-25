-- WARD OS — core schema.
--
-- Everything lives in the dedicated `ward` schema so this migration never touches
-- tables that already exist in the database (public schema, auth schema, other apps).
-- The schema is NOT exposed through Supabase's REST API (only `public` is by default),
-- so the anon/authenticated keys cannot reach it. The Next.js server is the only client.
--
-- Isolation model
--   * The application connects as the database owner, then for every request runs
--     `SET LOCAL ROLE ward_app` + `set_config('app.org_id', …, true)` inside a transaction.
--   * `ward_app` is not the table owner and has no BYPASSRLS, so every policy below applies.
--   * Owner-level ("system") access is used only for: migrations, login/session lookup,
--     rate limiting, the job queue claim and the scheduler tick.

-- gen_random_uuid() is built into Postgres 13+; no extension required.

create schema if not exists ward;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ward_app') then
    create role ward_app nologin nobypassrls;
  end if;
end
$$;

grant ward_app to current_user;

create table if not exists ward.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create or replace function ward.current_org() returns uuid
language sql stable as $$ select nullif(current_setting('app.org_id', true), '')::uuid $$;

create or replace function ward.current_user_id() returns uuid
language sql stable as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create or replace function ward.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── Organizations & people ─────────────────────────

create table ward.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table ward.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and position('@' in email) > 1),
  name text not null check (length(name) between 1 and 120),
  password_hash text not null,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table ward.organization_members (
  org_id uuid not null references ward.organizations(id) on delete cascade,
  user_id uuid not null references ward.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on ward.organization_members (user_id);

create table ward.sessions (
  id text primary key,                     -- sha256(token); the raw token only ever lives in the cookie
  user_id uuid not null references ward.users(id) on delete cascade,
  org_id uuid not null references ward.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  ip text,
  user_agent text,
  revoked_at timestamptz
);
create index on ward.sessions (user_id);

create table ward.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);

-- ───────────────────────── Settings & integrations ─────────────────────────

create table ward.system_settings (
  org_id uuid not null references ward.organizations(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_.]{2,64}$'),
  value jsonb not null,
  updated_by uuid references ward.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

create table ward.integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini', 'deepseek', 'ollama', 'resend', 'site')),
  status text not null default 'unknown' check (status in ('unknown', 'configured', 'missing', 'ok', 'error')),
  config jsonb not null default '{}'::jsonb,       -- non-secret configuration only; keys stay in env
  last_checked_at timestamptz,
  last_error text,
  unique (org_id, provider)
);

-- ───────────────────────── Files ─────────────────────────

create table ward.stored_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 255),
  mime text not null,
  size integer not null check (size > 0 and size <= 15728640),
  sha256 text not null,
  data bytea not null,
  purpose text not null default 'attachment' check (purpose in ('knowledge', 'logo', 'attachment', 'episode', 'agreement')),
  is_private boolean not null default true,
  uploaded_by uuid references ward.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on ward.stored_files (org_id, purpose);

-- ───────────────────────── AI team ─────────────────────────

create table ward.ai_agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z]{2,32}$'),
  name text not null,
  title_ar text not null,
  title_en text not null,
  description text not null default '',
  instructions text not null,
  status text not null default 'idle' check (status in ('idle', 'working', 'paused', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);
create trigger ai_agents_touch before update on ward.ai_agents for each row execute function ward.touch_updated_at();

create table ward.agent_configs (
  agent_id uuid primary key references ward.ai_agents(id) on delete cascade,
  org_id uuid not null references ward.organizations(id) on delete cascade,
  provider text check (provider in ('openai', 'anthropic', 'gemini', 'deepseek', 'ollama')),
  model text,
  economy_model text,
  temperature numeric(3,2) not null default 0.4 check (temperature between 0 and 2),
  max_tool_iterations integer not null default 6 check (max_tool_iterations between 1 and 12),
  max_output_tokens integer not null default 2048 check (max_output_tokens between 256 and 16384),
  allowed_tools text[] not null default '{}',
  daily_budget_usd numeric(12,4) check (daily_budget_usd is null or daily_budget_usd >= 0),
  updated_at timestamptz not null default now()
);
create trigger agent_configs_touch before update on ward.agent_configs for each row execute function ward.touch_updated_at();

create table ward.agent_memories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  agent_id uuid not null references ward.ai_agents(id) on delete cascade,
  kind text not null default 'fact' check (kind in ('fact', 'preference', 'lesson', 'context')),
  content text not null check (length(content) between 1 and 4000),
  source_run_id uuid,
  created_at timestamptz not null default now()
);
create index on ward.agent_memories (org_id, agent_id, created_at desc);

-- ───────────────────────── Orchestration ─────────────────────────

create table ward.workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  command text not null check (length(command) between 3 and 4000),
  title text,
  status text not null default 'queued' check (status in
    ('queued', 'planning', 'running', 'reviewing', 'awaiting_approval', 'completed', 'failed', 'cancelled')),
  source text not null default 'founder' check (source in ('founder', 'automation', 'meeting')),
  plan jsonb,
  review jsonb,
  report text,
  error text,
  cost_usd numeric(14,6) not null default 0,
  cost_limit_usd numeric(14,6) not null check (cost_limit_usd > 0),
  model_calls integer not null default 0,
  max_model_calls integer not null default 40 check (max_model_calls between 1 and 200),
  review_round integer not null default 0,
  automation_id uuid,
  lease_owner text,                                  -- one worker advances a workflow at a time
  lease_until timestamptz,
  created_by uuid references ward.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on ward.workflows (org_id, status, created_at desc);
create trigger workflows_touch before update on ward.workflows for each row execute function ward.touch_updated_at();

create table ward.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  workflow_id uuid not null references ward.workflows(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_-]{1,40}$'),
  agent_id uuid not null references ward.ai_agents(id),
  title text not null,
  instructions text not null,
  depends_on text[] not null default '{}',
  complexity text not null default 'standard' check (complexity in ('simple', 'standard')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  output text,
  error text,
  review_feedback text,
  attempts integer not null default 0,
  max_attempts integer not null default 2 check (max_attempts between 1 and 5),
  position integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  unique (workflow_id, key)
);
create index on ward.workflow_steps (workflow_id, status);

create table ward.workflow_events (
  id bigserial primary key,
  org_id uuid not null references ward.organizations(id) on delete cascade,
  workflow_id uuid not null references ward.workflows(id) on delete cascade,
  step_key text,
  kind text not null,
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);
create index on ward.workflow_events (workflow_id, id);

create table ward.meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  topic text not null check (length(topic) between 3 and 2000),
  agent_ids uuid[] not null check (cardinality(agent_ids) between 2 and 9),
  rounds integer not null default 2 check (rounds between 1 and 3),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  summary text,
  recommendations jsonb not null default '[]'::jsonb,
  disagreements jsonb not null default '[]'::jsonb,
  proposed_decisions jsonb not null default '[]'::jsonb,
  cost_usd numeric(14,6) not null default 0,
  cost_limit_usd numeric(14,6) not null check (cost_limit_usd > 0),
  error text,
  lease_owner text,
  lease_until timestamptz,
  created_by uuid references ward.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on ward.meetings (org_id, created_at desc);

create table ward.agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  agent_id uuid not null references ward.ai_agents(id),
  workflow_id uuid references ward.workflows(id) on delete cascade,
  step_id uuid references ward.workflow_steps(id) on delete cascade,
  meeting_id uuid references ward.meetings(id) on delete cascade,
  purpose text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'cancelled')),
  provider text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(14,6) not null default 0,
  iterations integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on ward.agent_runs (org_id, agent_id, started_at desc);
create index on ward.agent_runs (workflow_id);

create table ward.agent_messages (
  id bigserial primary key,
  org_id uuid not null references ward.organizations(id) on delete cascade,
  agent_run_id uuid not null references ward.agent_runs(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content text not null default '',
  tool_calls jsonb,
  tool_call_id text,
  created_at timestamptz not null default now()
);
create index on ward.agent_messages (agent_run_id, id);

create table ward.meeting_messages (
  id bigserial primary key,
  org_id uuid not null references ward.organizations(id) on delete cascade,
  meeting_id uuid not null references ward.meetings(id) on delete cascade,
  agent_id uuid references ward.ai_agents(id),
  round integer not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index on ward.meeting_messages (meeting_id, id);

create table ward.decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  details text not null default '',
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'superseded')),
  source text not null default 'founder' check (source in ('founder', 'meeting', 'workflow')),
  meeting_id uuid references ward.meetings(id) on delete set null,
  workflow_id uuid references ward.workflows(id) on delete set null,
  decided_by uuid references ward.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index on ward.decisions (org_id, status);

-- ───────────────────────── Knowledge (RAG) ─────────────────────────

create table ward.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  category text not null check (category in
    ('identity', 'goals', 'decisions', 'episodes', 'guests', 'sponsorships', 'marketing',
     'meetings', 'files', 'budget', 'policies', 'reports')),
  source text not null default 'manual' check (source in ('manual', 'upload', 'system', 'agent')),
  content text not null default '',
  file_id uuid references ward.stored_files(id) on delete set null,
  verified boolean not null default false,          -- founder-confirmed facts rank higher
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references ward.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on ward.knowledge_documents (org_id, category);
create trigger knowledge_documents_touch before update on ward.knowledge_documents for each row execute function ward.touch_updated_at();

create table ward.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  document_id uuid not null references ward.knowledge_documents(id) on delete cascade,
  ord integer not null,
  content text not null,
  search_text text not null,                         -- normalized (Arabic letter forms, no diacritics)
  tsv tsvector generated always as (to_tsvector('simple', search_text)) stored,
  unique (document_id, ord)
);
create index knowledge_chunks_tsv on ward.knowledge_chunks using gin (tsv);
create index on ward.knowledge_chunks (org_id);

-- ───────────────────────── Production ─────────────────────────

create table ward.guests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  channel text,
  bio text not null default '',
  topics text[] not null default '{}',
  contact jsonb not null default '{}'::jsonb,        -- private: never sent to an AI provider unredacted
  status text not null default 'proposed' check (status in ('proposed', 'contacted', 'interested', 'confirmed', 'declined')),
  is_minor boolean,                                  -- unknown until confirmed; minors need guardian consent
  guardian_consent boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger guests_touch before update on ward.guests for each row execute function ward.touch_updated_at();

create table ward.episodes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  number integer,
  title text not null check (length(title) between 1 and 200),
  topic text not null default '',
  description text not null default '',
  status text not null default 'idea' check (status in
    ('idea', 'research', 'preparation', 'guest_confirmation', 'ready_to_shoot', 'shooting',
     'editing', 'review', 'ready_to_publish', 'published')),
  guest_id uuid references ward.guests(id) on delete set null,
  guest_confirmed boolean not null default false,    -- only the founder may set this (enforced in API)
  questions jsonb not null default '[]'::jsonb,
  script text not null default '',
  shoot_at timestamptz,
  publish_at timestamptz,
  estimated_cost numeric(14,2) check (estimated_cost is null or estimated_cost >= 0),
  marketing jsonb not null default '{}'::jsonb,
  approval_status text not null default 'draft' check (approval_status in ('draft', 'pending', 'approved', 'rejected')),
  publish_links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint episode_published_needs_approval check (status <> 'published' or approval_status = 'approved')
);
create index on ward.episodes (org_id, status);
create index on ward.episodes (org_id, shoot_at);
create trigger episodes_touch before update on ward.episodes for each row execute function ward.touch_updated_at();

alter table ward.stored_files add column episode_id uuid references ward.episodes(id) on delete set null;

-- ───────────────────────── Sponsorships ─────────────────────────

create table ward.sponsors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  name_pending boolean not null default false,
  logo_file_id uuid references ward.stored_files(id) on delete set null,
  category text,                                     -- e.g. episode sponsor / content partner / founding partner
  sponsorship_type text check (sponsorship_type is null or sponsorship_type in ('cash', 'in_kind', 'mixed')),
  contact jsonb not null default '{}'::jsonb,
  agreement_start date,
  agreement_end date,
  value_amount numeric(14,2) check (value_amount is null or value_amount >= 0),
  currency text not null default 'SAR',
  visibility_rights text not null default '',
  logo_use_approved boolean not null default false,
  status text not null default 'pending_verification' check (status in
    ('pending_verification', 'in_discussion', 'verified', 'active', 'ended', 'declined')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (agreement_end is null or agreement_start is null or agreement_end >= agreement_start)
);
create index on ward.sponsors (org_id, status);
create trigger sponsors_touch before update on ward.sponsors for each row execute function ward.touch_updated_at();

alter table ward.stored_files add column sponsor_id uuid references ward.sponsors(id) on delete set null;

create table ward.episode_sponsors (
  org_id uuid not null references ward.organizations(id) on delete cascade,
  episode_id uuid not null references ward.episodes(id) on delete cascade,
  sponsor_id uuid not null references ward.sponsors(id) on delete cascade,
  placement text not null default '',
  primary key (episode_id, sponsor_id)
);

create table ward.sponsorship_agreements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  sponsor_id uuid not null references ward.sponsors(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'under_review', 'approved', 'signed', 'expired', 'cancelled')),
  starts_on date,
  ends_on date,
  value_amount numeric(14,2) check (value_amount is null or value_amount >= 0),
  currency text not null default 'SAR',
  terms text not null default '',
  file_id uuid references ward.stored_files(id) on delete set null,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agreement_signed_has_timestamp check (status <> 'signed' or signed_at is not null)
);

create table ward.sponsorship_deliverables (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  sponsor_id uuid not null references ward.sponsors(id) on delete cascade,
  agreement_id uuid references ward.sponsorship_agreements(id) on delete set null,
  episode_id uuid references ward.episodes(id) on delete set null,
  title text not null,
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'verified', 'missed')),
  proof_url text,
  created_at timestamptz not null default now()
);
create index on ward.sponsorship_deliverables (org_id, due_at);

-- ───────────────────────── Approvals ─────────────────────────

create table ward.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  action_type text not null check (action_type in
    ('publish_content', 'send_external_message', 'sign_agreement', 'spend_money',
     'delete_data', 'modify_live_site', 'share_private_file', 'change_permissions')),
  title text not null,
  summary text not null default '',
  target text not null default '',
  payload jsonb not null default '{}'::jsonb,
  estimated_cost numeric(14,2),
  currency text not null default 'SAR',
  requested_by_agent_id uuid references ward.ai_agents(id) on delete set null,
  requested_by_user_id uuid references ward.users(id) on delete set null,
  workflow_id uuid references ward.workflows(id) on delete set null,
  agent_run_id uuid references ward.agent_runs(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  decided_by uuid references ward.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  execution_result jsonb,
  created_at timestamptz not null default now(),
  constraint approval_decision_recorded check (status = 'pending' or (decided_by is not null and decided_at is not null))
);
create index on ward.approvals (org_id, status, created_at desc);

create table ward.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  agent_run_id uuid not null references ward.agent_runs(id) on delete cascade,
  agent_id uuid not null references ward.ai_agents(id),
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null check (status in ('ok', 'error', 'denied', 'approval_requested')),
  approval_id uuid references ward.approvals(id) on delete set null,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index on ward.agent_tool_calls (agent_run_id);

-- ───────────────────────── Tasks ─────────────────────────

create table ward.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  description text not null default '',
  status text not null default 'todo' check (status in ('backlog', 'todo', 'in_progress', 'review', 'done', 'blocked')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  assignee_agent_id uuid references ward.ai_agents(id) on delete set null,
  assignee_user_id uuid references ward.users(id) on delete set null,
  parent_id uuid references ward.tasks(id) on delete cascade,
  episode_id uuid references ward.episodes(id) on delete set null,
  workflow_id uuid references ward.workflows(id) on delete set null,
  meeting_id uuid references ward.meetings(id) on delete set null,
  created_by_user_id uuid references ward.users(id) on delete set null,
  created_by_agent_id uuid references ward.ai_agents(id) on delete set null,
  position double precision not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (assignee_agent_id is not null and assignee_user_id is not null)),
  check (parent_id is null or parent_id <> id)
);
create index on ward.tasks (org_id, status, position);
create index on ward.tasks (org_id, due_at);
create index on ward.tasks (parent_id);
create trigger tasks_touch before update on ward.tasks for each row execute function ward.touch_updated_at();

alter table ward.stored_files add column task_id uuid references ward.tasks(id) on delete set null;

create table ward.task_dependencies (
  org_id uuid not null references ward.organizations(id) on delete cascade,
  task_id uuid not null references ward.tasks(id) on delete cascade,
  depends_on_id uuid not null references ward.tasks(id) on delete cascade,
  primary key (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

create table ward.task_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  task_id uuid not null references ward.tasks(id) on delete cascade,
  author_user_id uuid references ward.users(id) on delete set null,
  author_agent_id uuid references ward.ai_agents(id) on delete set null,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index on ward.task_comments (task_id, created_at);

create table ward.task_events (
  id bigserial primary key,
  org_id uuid not null references ward.organizations(id) on delete cascade,
  task_id uuid not null references ward.tasks(id) on delete cascade,
  actor text not null,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index on ward.task_events (task_id, id);

-- ───────────────────────── Finance ─────────────────────────

create table ward.budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  name text not null,
  category text not null default 'general',
  period_start date not null,
  period_end date not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'SAR',
  episode_id uuid references ward.episodes(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table ward.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  budget_id uuid references ward.budgets(id) on delete set null,
  episode_id uuid references ward.episodes(id) on delete set null,
  sponsor_id uuid references ward.sponsors(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'SAR',
  category text not null default 'general',
  description text not null,
  incurred_on date not null default current_date,
  status text not null default 'approved' check (status in ('pending_approval', 'approved', 'rejected', 'paid')),
  approval_id uuid references ward.approvals(id) on delete set null,
  receipt_file_id uuid references ward.stored_files(id) on delete set null,
  created_by_user_id uuid references ward.users(id) on delete set null,
  created_by_agent_id uuid references ward.ai_agents(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on ward.expenses (org_id, incurred_on);
create index on ward.expenses (episode_id);

create table ward.revenues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  source text not null default 'sponsorship' check (source in ('sponsorship', 'ads', 'services', 'other')),
  sponsor_id uuid references ward.sponsors(id) on delete set null,
  episode_id uuid references ward.episodes(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'SAR',
  is_cash boolean not null default true,             -- in-kind sponsorship is never counted as cash income
  status text not null default 'expected' check (status in ('expected', 'received', 'cancelled')),
  received_on date,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table ward.model_usage (
  id bigserial primary key,
  org_id uuid not null references ward.organizations(id) on delete cascade,
  agent_run_id uuid references ward.agent_runs(id) on delete set null,
  workflow_id uuid references ward.workflows(id) on delete set null,
  meeting_id uuid references ward.meetings(id) on delete set null,
  provider text not null,
  model text not null,
  purpose text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(14,6) not null default 0,
  price_is_estimate boolean not null default true,
  latency_ms integer,
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);
create index on ward.model_usage (org_id, created_at desc);

-- ───────────────────────── Marketing, notifications, audit ─────────────────────────

create table ward.content_calendar (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  title text not null,
  platform text not null default 'youtube' check (platform in ('youtube', 'podcast', 'instagram', 'tiktok', 'x', 'website', 'other')),
  scheduled_at timestamptz,
  status text not null default 'idea' check (status in ('idea', 'draft', 'ready', 'scheduled', 'published', 'cancelled')),
  content text not null default '',
  episode_id uuid references ward.episodes(id) on delete set null,
  created_by_agent_id uuid references ward.ai_agents(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on ward.content_calendar (org_id, scheduled_at);

create table ward.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  kind text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text not null default '',
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, dedupe_key)
);
create index on ward.notifications (org_id, read_at, created_at desc);

create table ward.audit_logs (
  id bigserial primary key,
  org_id uuid not null references ward.organizations(id) on delete cascade,
  actor_type text not null check (actor_type in ('user', 'agent', 'system')),
  actor_id text,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index on ward.audit_logs (org_id, created_at desc);

-- ───────────────────────── Durable jobs & automations ─────────────────────────

create table ward.automations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references ward.organizations(id) on delete cascade,
  kind text not null check (kind in
    ('morning_report', 'weekly_report', 'shoot_schedule_review', 'sponsor_rights_followup',
     'episode_ideas', 'expense_review', 'deadline_alerts', 'error_monitor')),
  enabled boolean not null default false,             -- every automation is opt-in
  cron text not null,
  timezone text not null default 'Asia/Riyadh',
  uses_ai boolean not null default false,
  max_cost_usd numeric(12,4) not null default 0.5 check (max_cost_usd >= 0),
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  unique (org_id, kind)
);

create table ward.jobs (
  id bigserial primary key,
  org_id uuid not null references ward.organizations(id) on delete cascade,
  kind text not null check (kind in ('workflow.advance', 'meeting.run', 'automation.run', 'knowledge.index')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'dead', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_ready on ward.jobs (run_at) where status in ('queued', 'running');

-- ───────────────────────── Privileges & row-level security ─────────────────────────

revoke all on schema ward from public;
grant usage on schema ward to ward_app;
grant select, insert, update, delete on all tables in schema ward to ward_app;
grant usage, select on all sequences in schema ward to ward_app;

-- System-only tables: the request role never touches them.
revoke all on ward.sessions, ward.rate_limits, ward.schema_migrations from ward_app;
-- The audit trail is append-only for the application.
revoke update, delete on ward.audit_logs from ward_app;
-- Users are managed through system context (founder bootstrap, member admin).
-- (a column-level revoke is a no-op while a table-level grant exists, so re-grant narrowly).
revoke insert, update, delete on ward.users from ward_app;
grant update (name) on ward.users to ward_app;

do $$
declare r text;
begin
  -- Supabase API roles must never reach this schema, even if it is exposed later by mistake.
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on schema ward from %I', r);
      execute format('revoke all on all tables in schema ward from %I', r);
    end if;
  end loop;
end
$$;

alter table ward.organizations enable row level security;
create policy org_self on ward.organizations for all to ward_app
  using (id = ward.current_org()) with check (id = ward.current_org());

alter table ward.users enable row level security;
create policy users_in_org on ward.users for select to ward_app
  using (exists (select 1 from ward.organization_members m where m.user_id = users.id and m.org_id = ward.current_org()));
create policy users_self_update on ward.users for update to ward_app
  using (id = ward.current_user_id()) with check (id = ward.current_user_id());

alter table ward.sessions enable row level security;        -- no policy: denied to ward_app
alter table ward.rate_limits enable row level security;     -- no policy: denied to ward_app

do $$
declare t text;
begin
  foreach t in array array[
    'organization_members', 'system_settings', 'integrations', 'stored_files', 'ai_agents', 'agent_configs',
    'agent_memories', 'workflows', 'workflow_steps', 'workflow_events', 'meetings', 'agent_runs',
    'agent_messages', 'meeting_messages', 'decisions', 'knowledge_documents', 'knowledge_chunks',
    'guests', 'episodes', 'sponsors', 'episode_sponsors', 'sponsorship_agreements',
    'sponsorship_deliverables', 'approvals', 'agent_tool_calls', 'tasks', 'task_dependencies',
    'task_comments', 'task_events', 'budgets', 'expenses', 'revenues', 'model_usage',
    'content_calendar', 'notifications', 'audit_logs', 'automations', 'jobs'
  ] loop
    execute format('alter table ward.%I enable row level security', t);
    execute format(
      'create policy org_isolation on ward.%I for all to ward_app using (org_id = ward.current_org()) with check (org_id = ward.current_org())',
      t);
  end loop;
end
$$;
