-- MUBAYN — initial schema.
--
-- Conventions
--   * Customer-owned rows carry user_id so every query can be scoped to the
--     owner. The application never reads a customer row without that filter.
--   * Evidence, AI responses and reports are append-only in spirit: a new
--     analysis produces a new report version; old versions are kept and marked
--     superseded so every report stays traceable to the evidence it used.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ── accounts ────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              citext UNIQUE,                 -- NULL once the account is deleted
  password_hash      text,                          -- NULL once deleted
  full_name          text,
  locale             text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  role               text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted')),
  email_verified_at  timestamptz,
  mfa_secret_enc     text,                          -- AES-256-GCM, see lib/crypto.ts
  mfa_enabled_at     timestamptz,
  failed_logins      integer NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE TABLE sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     bytea NOT NULL UNIQUE,             -- sha256(token); the token itself is never stored
  mfa_verified   boolean NOT NULL DEFAULT false,
  ip             inet,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE email_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose      text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash   bytea NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_user_idx ON email_tokens (user_id, purpose);

-- Outbound e-mail log. Lets the owner see whether a reset e-mail was actually
-- accepted by the provider instead of guessing.
CREATE TABLE email_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  to_address    text NOT NULL,
  template      text NOT NULL,
  provider      text NOT NULL,
  provider_id   text,
  status        text NOT NULL CHECK (status IN ('sent', 'failed')),
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── settings ────────────────────────────────────────────────────────────────

-- Operator-controlled limits. The service is free to customers, but every
-- analysis costs real money at the AI provider, so the owner sets quotas.
CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
  ('limits', '{"maxImages": 20, "maxVideos": 1, "maxVideoSeconds": 60, "monthlyInspectionsPerUser": 3, "dailyAnalysesGlobal": 50, "signupsOpen": true, "submissionsOpen": true}');

-- ── inspections & evidence ──────────────────────────────────────────────────

CREATE TABLE inspections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN
                     ('draft', 'queued', 'analyzing', 'completed', 'failed', 'canceled')),
  device_category  text NOT NULL CHECK (device_category IN
                     ('phone', 'tablet', 'laptop', 'smartwatch', 'console', 'camera', 'headphones', 'other')),
  brand            text NOT NULL,
  model            text NOT NULL,
  storage          text,
  color            text,
  purchase_context text NOT NULL DEFAULT 'buying' CHECK (purchase_context IN ('buying', 'selling', 'owner')),
  seller_claims    text,          -- what the listing / seller says about the device
  asking_price     text,
  report_language  text NOT NULL DEFAULT 'ar' CHECK (report_language IN ('ar', 'en')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  submitted_at     timestamptz,
  completed_at     timestamptz
);
CREATE INDEX inspections_user_idx ON inspections (user_id, created_at DESC);
CREATE INDEX inspections_status_idx ON inspections (status);

CREATE TABLE evidence (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id       uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                text NOT NULL CHECK (kind IN ('image', 'video', 'video_frame')),
  parent_evidence_id  uuid REFERENCES evidence(id) ON DELETE CASCADE,
  storage_key         text NOT NULL UNIQUE,
  declared_mime       text NOT NULL,
  detected_mime       text,
  bytes               bigint,
  sha256              text,
  width               integer,
  height              integer,
  duration_ms         integer,
  frame_time_ms       integer,       -- for video_frame: position inside the parent video
  original_filename   text,
  label               text,          -- optional customer caption, e.g. "back cover"
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'rejected')),
  rejected_reason     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  verified_at         timestamptz
);
CREATE INDEX evidence_inspection_idx ON evidence (inspection_id, kind);

-- ── AI analysis ─────────────────────────────────────────────────────────────

CREATE TABLE analysis_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id  uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead', 'canceled')),
  trigger        text NOT NULL CHECK (trigger IN ('submission', 'customer_retry', 'admin_retry', 'admin_reanalyze')),
  attempts       integer NOT NULL DEFAULT 0,
  max_attempts   integer NOT NULL DEFAULT 3,
  next_run_at    timestamptz NOT NULL DEFAULT now(),
  locked_at      timestamptz,
  locked_by      text,
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz
);
CREATE INDEX analysis_jobs_pick_idx ON analysis_jobs (status, next_run_at);
-- At most one live job per inspection.
CREATE UNIQUE INDEX analysis_jobs_one_live ON analysis_jobs (inspection_id)
  WHERE status IN ('queued', 'running');

CREATE TABLE analysis_attempts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            uuid NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  inspection_id     uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  attempt_no        integer NOT NULL,
  provider          text NOT NULL,
  model             text NOT NULL,
  prompt_version    text NOT NULL,
  evidence_manifest jsonb NOT NULL,       -- [{ref, evidence_id, sha256 of exact bytes sent, ...}]
  request_id        text,                 -- provider request id, for support tickets
  response_raw      jsonb,                -- complete provider response body
  stop_reason       text,
  input_tokens      integer,
  output_tokens     integer,
  cost_usd_micros   bigint,
  outcome           text NOT NULL DEFAULT 'running' CHECK (outcome IN ('running', 'succeeded', 'failed')),
  error_kind        text,
  error_message     text,
  http_status       integer,
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  UNIQUE (job_id, attempt_no)
);
CREATE INDEX analysis_attempts_inspection_idx ON analysis_attempts (inspection_id, started_at DESC);

CREATE TABLE reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id         uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version               integer NOT NULL,
  status                text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'superseded', 'withdrawn')),
  analysis_attempt_id   uuid NOT NULL REFERENCES analysis_attempts(id) ON DELETE CASCADE,
  language              text NOT NULL,
  overall_condition     text NOT NULL,
  condition_score       integer NOT NULL CHECK (condition_score BETWEEN 0 AND 100),
  confidence            text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  body                  jsonb NOT NULL,     -- validated structured output (summary, limitations, checks ...)
  pdf_storage_key       text,
  pdf_sha256            text,
  pdf_generated_at      timestamptz,
  reviewed_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,
  review_note           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, version)
);
CREATE INDEX reports_user_idx ON reports (user_id, created_at DESC);

CREATE TABLE findings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  position      integer NOT NULL,
  area          text NOT NULL,
  severity      text NOT NULL CHECK (severity IN ('info', 'minor', 'moderate', 'major', 'critical')),
  title         text NOT NULL,
  detail        text NOT NULL,
  confidence    text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  evidence_ids  uuid[] NOT NULL CHECK (cardinality(evidence_ids) >= 1),
  UNIQUE (report_id, position)
);

-- ── operations ──────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  action       text NOT NULL,
  target_type  text,
  target_id    text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_target_idx ON audit_log (target_type, target_id);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);

-- Application errors, grouped by fingerprint so the owner sees one row per
-- distinct problem with a counter, and can mark it resolved.
CREATE TABLE error_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint  text NOT NULL UNIQUE,
  source       text NOT NULL,
  message      text NOT NULL,
  stack        text,
  context      jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurrences  integer NOT NULL DEFAULT 1,
  first_seen   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE rate_limits (
  bucket        text NOT NULL,
  window_start  timestamptz NOT NULL,
  hits          integer NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket, window_start)
);

CREATE TABLE contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  name        text NOT NULL,
  email       text NOT NULL,
  subject     text NOT NULL,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
