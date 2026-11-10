-- 0002_ai_model — the personal AI model: identity, versions, providers,
-- knowledge (pgvector), memory, datasets, training, evaluation, chat, usage
-- and audit.
--
-- Requires the `vector` extension (pgvector >= 0.5 for HNSW). The migration
-- runner checks pg_available_extensions first and stops with a clear message
-- if it is missing, instead of failing half-way.
CREATE EXTENSION IF NOT EXISTS vector;

-- ===========================================================================
-- Providers and connections
-- ===========================================================================
CREATE TABLE ai_model_providers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL owner = platform provider, configured by operators from server env.
  owner_id          uuid REFERENCES users (id) ON DELETE CASCADE,
  workspace_id      uuid REFERENCES workspaces (id) ON DELETE CASCADE,
  provider_name     text NOT NULL CHECK (length(btrim(provider_name)) BETWEEN 1 AND 80),
  provider_type     text NOT NULL
                    CHECK (provider_type IN ('ollama', 'vllm', 'openai_compatible', 'huggingface', 'local_onnx')),
  endpoint          text CHECK (endpoint IS NULL OR (endpoint ~ '^https?://' AND length(endpoint) <= 500)),
  capabilities      jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(capabilities) = 'object'),
  status            text NOT NULL DEFAULT 'unknown'
                    CHECK (status IN ('unknown', 'healthy', 'degraded', 'down', 'disabled')),
  last_health_at    timestamptz,
  last_health_error text CHECK (length(last_health_error) <= 2000),
  last_latency_ms   integer CHECK (last_latency_ms >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK ((owner_id IS NULL) = (workspace_id IS NULL)),
  CHECK (provider_type = 'local_onnx' OR endpoint IS NOT NULL),
  -- User-registered endpoints must be HTTPS (internal http servers are platform-only).
  CHECK (owner_id IS NULL OR endpoint ~ '^https://')
);
CREATE UNIQUE INDEX ai_model_providers_platform_name_key ON ai_model_providers (provider_name) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX ai_model_providers_ws_name_key ON ai_model_providers (workspace_id, provider_name) WHERE owner_id IS NOT NULL;
CREATE INDEX ai_model_providers_owner_idx ON ai_model_providers (owner_id);
CREATE TRIGGER ai_model_providers_touch BEFORE UPDATE ON ai_model_providers FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

CREATE TABLE ai_model_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  provider_id       uuid NOT NULL REFERENCES ai_model_providers (id) ON DELETE CASCADE,
  -- Never a raw key. Either a pointer to a server environment variable
  -- (platform admins only) or an AES-256-GCM sealed value whose key lives
  -- outside the database (OMNIX_SECRETS_KEY).
  secret_reference  text NOT NULL
                    CHECK (secret_reference ~ '^(env:OMNIX_PROVIDER_SECRET_[A-Z0-9_]{1,64}|enc:v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+)$'),
  secret_hint       text CHECK (length(secret_hint) <= 12),
  connection_status text NOT NULL DEFAULT 'unverified' CHECK (connection_status IN ('unverified', 'ok', 'failed')),
  last_error        text CHECK (length(last_error) <= 2000),
  last_checked_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, provider_id)
);
CREATE INDEX ai_model_connections_provider_idx ON ai_model_connections (provider_id);
CREATE INDEX ai_model_connections_workspace_idx ON ai_model_connections (workspace_id);
CREATE TRIGGER ai_model_connections_touch BEFORE UPDATE ON ai_model_connections FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

-- ===========================================================================
-- Model identity
-- ===========================================================================
CREATE TABLE ai_model_profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  display_name      text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 80),
  slug              text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 64),
  description       text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  model_family      text NOT NULL DEFAULT 'OMNIX Personal Intelligence' CHECK (length(model_family) <= 80),
  default_language  text NOT NULL DEFAULT 'ar' CHECK (default_language IN ('ar', 'en', 'auto')),
  personality       text NOT NULL DEFAULT '' CHECK (length(personality) <= 4000),
  system_prompt     text NOT NULL DEFAULT '' CHECK (length(system_prompt) <= 16000),
  temperature       numeric(3, 2) NOT NULL DEFAULT 0.40 CHECK (temperature BETWEEN 0 AND 2),
  precision_mode    text NOT NULL DEFAULT 'balanced' CHECK (precision_mode IN ('strict', 'balanced', 'creative')),
  response_length   text NOT NULL DEFAULT 'balanced' CHECK (response_length IN ('short', 'balanced', 'detailed')),
  max_output_tokens integer NOT NULL DEFAULT 1024 CHECK (max_output_tokens BETWEEN 16 AND 32768),
  knowledge_mode    text NOT NULL DEFAULT 'assist' CHECK (knowledge_mode IN ('off', 'assist', 'strict')),
  memory_enabled    boolean NOT NULL DEFAULT true,
  max_tool_calls    integer NOT NULL DEFAULT 3 CHECK (max_tool_calls BETWEEN 0 AND 10),
  -- Secondary settings (tool allow-list, retrieval tuning). Validated by the
  -- zod schema in src/lib/ai/identity/model-config.ts.
  configuration     jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(configuration) = 'object'),
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug),
  UNIQUE (id, owner_id)
);
CREATE INDEX ai_model_profiles_owner_idx ON ai_model_profiles (owner_id, created_at DESC);
CREATE TRIGGER ai_model_profiles_touch BEFORE UPDATE ON ai_model_profiles FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

CREATE TABLE ai_model_versions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_profile_id    uuid NOT NULL,
  owner_id            uuid NOT NULL,
  version             text NOT NULL CHECK (version ~ '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$'),
  base_model          text NOT NULL CHECK (length(base_model) BETWEEN 1 AND 200),
  base_model_revision text CHECK (length(base_model_revision) <= 100),
  provider_id         uuid NOT NULL REFERENCES ai_model_providers (id) ON DELETE RESTRICT,
  provider_model      text NOT NULL CHECK (length(provider_model) BETWEEN 1 AND 200),
  adapter_path        text CHECK (length(adapter_path) <= 1000),
  adapter_name        text CHECK (adapter_name ~ '^[a-zA-Z0-9._-]{1,100}$'),
  training_job_id     uuid,
  model_config        jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(model_config) = 'object'),
  status              text NOT NULL DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'deployed', 'retired', 'failed')),
  evaluation_status   text NOT NULL DEFAULT 'not_evaluated'
                      CHECK (evaluation_status IN ('not_evaluated', 'running', 'passed', 'failed')),
  notes               text CHECK (length(notes) <= 4000),
  created_by          uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  deployed_at         timestamptz,
  retired_at          timestamptz,
  UNIQUE (model_profile_id, version),
  FOREIGN KEY (model_profile_id, owner_id) REFERENCES ai_model_profiles (id, owner_id) ON DELETE CASCADE,
  CHECK ((adapter_path IS NULL) = (adapter_name IS NULL))
);
-- At most one deployed version per model.
CREATE UNIQUE INDEX ai_model_versions_one_deployed ON ai_model_versions (model_profile_id) WHERE status = 'deployed';
CREATE INDEX ai_model_versions_profile_idx ON ai_model_versions (model_profile_id, created_at DESC);
CREATE INDEX ai_model_versions_provider_idx ON ai_model_versions (provider_id);
CREATE INDEX ai_model_versions_owner_idx ON ai_model_versions (owner_id);

-- Model roles: what "the coding model" means for a user in a workspace.
CREATE TABLE ai_model_roles (
  workspace_id      uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role              text NOT NULL CHECK (role IN ('default', 'coding', 'reasoning', 'arabic', 'personal_assistant')),
  model_profile_id  uuid NOT NULL,
  model_version_id  uuid REFERENCES ai_model_versions (id) ON DELETE SET NULL,
  temperature       numeric(3, 2) CHECK (temperature BETWEEN 0 AND 2),
  max_output_tokens integer CHECK (max_output_tokens BETWEEN 16 AND 32768),
  response_length   text CHECK (response_length IN ('short', 'balanced', 'detailed')),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, owner_id, role),
  FOREIGN KEY (model_profile_id, owner_id) REFERENCES ai_model_profiles (id, owner_id) ON DELETE CASCADE
);
CREATE INDEX ai_model_roles_profile_idx ON ai_model_roles (model_profile_id);
CREATE INDEX ai_model_roles_version_idx ON ai_model_roles (model_version_id);
CREATE INDEX ai_model_roles_owner_idx ON ai_model_roles (owner_id);
CREATE TRIGGER ai_model_roles_touch BEFORE UPDATE ON ai_model_roles FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

-- ===========================================================================
-- Datasets
-- ===========================================================================
CREATE TABLE ai_datasets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id       uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description        text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  dataset_type       text NOT NULL CHECK (dataset_type IN ('sft_chat', 'sft_instruction')),
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validating', 'valid', 'invalid', 'archived')),
  record_count       integer NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  valid_count        integer NOT NULL DEFAULT 0 CHECK (valid_count >= 0),
  -- The owner must confirm they have the right to train on this data.
  rights_statement   text CHECK (length(rights_statement) <= 2000),
  rights_confirmed_at timestamptz,
  last_validation    jsonb CHECK (last_validation IS NULL OR jsonb_typeof(last_validation) = 'object'),
  snapshot_hash      text CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_datasets_owner_idx ON ai_datasets (owner_id, created_at DESC);
CREATE INDEX ai_datasets_workspace_idx ON ai_datasets (workspace_id);
CREATE TRIGGER ai_datasets_touch BEFORE UPDATE ON ai_datasets FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

CREATE TABLE ai_dataset_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id        uuid NOT NULL REFERENCES ai_datasets (id) ON DELETE CASCADE,
  -- {"messages":[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}
  content           jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object' AND pg_column_size(content) <= 65536),
  item_hash         text NOT NULL CHECK (item_hash ~ '^[0-9a-f]{64}$'),
  source            text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'manual', 'conversation')),
  -- Conversation-derived items require explicit, recorded consent.
  consent_recorded  boolean NOT NULL DEFAULT false,
  metadata          jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  validation_status text NOT NULL DEFAULT 'pending'
                    CHECK (validation_status IN ('pending', 'valid', 'invalid', 'duplicate', 'pii_flagged')),
  validation_errors text[] NOT NULL DEFAULT '{}',
  split             text CHECK (split IN ('train', 'validation', 'test')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (source <> 'conversation' OR consent_recorded),
  CHECK (split IS NULL OR validation_status = 'valid')
);
CREATE INDEX ai_dataset_items_dataset_idx ON ai_dataset_items (dataset_id, created_at);
CREATE INDEX ai_dataset_items_hash_idx ON ai_dataset_items (dataset_id, item_hash);

-- ===========================================================================
-- Training
-- ===========================================================================
CREATE TABLE ai_training_jobs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_profile_id      uuid NOT NULL,
  owner_id              uuid NOT NULL,
  workspace_id          uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  dataset_id            uuid REFERENCES ai_datasets (id) ON DELETE SET NULL,
  -- Frozen at creation: the worker verifies the dataset still hashes to this.
  dataset_snapshot_hash text NOT NULL CHECK (dataset_snapshot_hash ~ '^[0-9a-f]{64}$'),
  dataset_snapshot      jsonb NOT NULL CHECK (jsonb_typeof(dataset_snapshot) = 'object'),
  base_model            text NOT NULL CHECK (length(base_model) BETWEEN 1 AND 200),
  base_model_revision   text CHECK (length(base_model_revision) <= 100),
  target_provider_id    uuid REFERENCES ai_model_providers (id) ON DELETE SET NULL,
  training_method       text NOT NULL CHECK (training_method IN ('lora', 'qlora')),
  configuration         jsonb NOT NULL CHECK (jsonb_typeof(configuration) = 'object'),
  status                text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'claimed', 'running', 'succeeded', 'failed', 'cancelled', 'unavailable')),
  status_reason         text CHECK (length(status_reason) <= 2000),
  progress              numeric(5, 4) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  metrics               jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metrics) = 'object'),
  hardware              jsonb CHECK (hardware IS NULL OR jsonb_typeof(hardware) = 'object'),
  worker_id             text CHECK (length(worker_id) <= 200),
  heartbeat_at          timestamptz,
  artifact_uri          text CHECK (length(artifact_uri) <= 1000),
  result_version_id     uuid REFERENCES ai_model_versions (id) ON DELETE SET NULL,
  cancel_requested_at   timestamptz,
  created_by            uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  started_at            timestamptz,
  completed_at          timestamptz,
  FOREIGN KEY (model_profile_id, owner_id) REFERENCES ai_model_profiles (id, owner_id) ON DELETE CASCADE,
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at),
  CHECK (status <> 'succeeded' OR (artifact_uri IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX ai_training_jobs_owner_idx ON ai_training_jobs (owner_id, created_at DESC);
CREATE INDEX ai_training_jobs_profile_idx ON ai_training_jobs (model_profile_id);
CREATE INDEX ai_training_jobs_dataset_idx ON ai_training_jobs (dataset_id);
CREATE INDEX ai_training_jobs_queue_idx ON ai_training_jobs (created_at) WHERE status = 'queued';
CREATE INDEX ai_training_jobs_provider_idx ON ai_training_jobs (target_provider_id);
CREATE INDEX ai_training_jobs_result_idx ON ai_training_jobs (result_version_id);
CREATE INDEX ai_training_jobs_workspace_idx ON ai_training_jobs (workspace_id);

ALTER TABLE ai_model_versions
  ADD CONSTRAINT ai_model_versions_training_job_fk
  FOREIGN KEY (training_job_id) REFERENCES ai_training_jobs (id) ON DELETE SET NULL;
CREATE INDEX ai_model_versions_training_job_idx ON ai_model_versions (training_job_id);

CREATE TABLE ai_training_logs (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id     uuid NOT NULL REFERENCES ai_training_jobs (id) ON DELETE CASCADE,
  level      text NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error')),
  message    text NOT NULL CHECK (length(message) <= 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_training_logs_job_idx ON ai_training_logs (job_id, id);

CREATE TABLE ai_training_metrics (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id          uuid NOT NULL REFERENCES ai_training_jobs (id) ON DELETE CASCADE,
  step            integer NOT NULL CHECK (step >= 0),
  epoch           double precision CHECK (epoch >= 0),
  train_loss      double precision,
  eval_loss       double precision,
  learning_rate   double precision CHECK (learning_rate >= 0),
  grad_norm       double precision,
  gpu_utilization double precision CHECK (gpu_utilization BETWEEN 0 AND 100),
  gpu_memory_mb   integer CHECK (gpu_memory_mb >= 0),
  recorded_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_training_metrics_job_idx ON ai_training_metrics (job_id, step);

-- ===========================================================================
-- Knowledge base (RAG)
-- ===========================================================================
CREATE TABLE ai_knowledge_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  filename          text NOT NULL CHECK (length(filename) BETWEEN 1 AND 255),
  title             text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 255),
  mime_type         text NOT NULL CHECK (mime_type IN (
                      'application/pdf',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'text/plain', 'text/markdown', 'application/json', 'application/x-ndjson')),
  byte_size         integer NOT NULL CHECK (byte_size BETWEEN 1 AND 26214400),
  sha256            text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path      text NOT NULL CHECK (length(storage_path) <= 500),
  category          text CHECK (length(category) <= 80),
  tags              text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 20),
  processing_status text NOT NULL DEFAULT 'pending'
                    CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed')),
  processing_error  text CHECK (length(processing_error) <= 2000),
  chunk_count       integer NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
  embedding_model   text CHECK (length(embedding_model) <= 200),
  revision          integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, sha256)
);
CREATE INDEX ai_knowledge_documents_ws_idx ON ai_knowledge_documents (workspace_id, created_at DESC);
CREATE INDEX ai_knowledge_documents_owner_idx ON ai_knowledge_documents (owner_id);
CREATE INDEX ai_knowledge_documents_pending_idx ON ai_knowledge_documents (created_at) WHERE processing_status = 'pending';
CREATE INDEX ai_knowledge_documents_tags_idx ON ai_knowledge_documents USING gin (tags);
CREATE TRIGGER ai_knowledge_documents_touch BEFORE UPDATE ON ai_knowledge_documents FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

CREATE TABLE ai_knowledge_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES ai_knowledge_documents (id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  chunk_index     integer NOT NULL CHECK (chunk_index >= 0),
  content         text NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  -- Arabic-normalised, lower-cased text used for keyword search.
  search_text     text NOT NULL,
  search_tsv      tsvector GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED,
  token_count     integer NOT NULL CHECK (token_count >= 0),
  metadata        jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  -- Dimension-agnostic column. Every row records which model produced it and
  -- its dimension; each model gets its own partial, dimension-cast HNSW index
  -- below, so vectors of different sizes are never compared.
  embedding       vector,
  embedding_model text,
  embedding_dims  integer CHECK (embedding_dims BETWEEN 1 AND 2000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index),
  CHECK ((embedding IS NULL) = (embedding_model IS NULL) AND (embedding IS NULL) = (embedding_dims IS NULL)),
  CHECK (embedding IS NULL OR vector_dims(embedding) = embedding_dims)
);
CREATE INDEX ai_knowledge_chunks_ws_idx ON ai_knowledge_chunks (workspace_id);
CREATE INDEX ai_knowledge_chunks_tsv_idx ON ai_knowledge_chunks USING gin (search_tsv);
CREATE INDEX ai_knowledge_chunks_e5_small_hnsw ON ai_knowledge_chunks
  USING hnsw ((embedding::vector(384)) vector_cosine_ops)
  WHERE embedding_model = 'intfloat/multilingual-e5-small';
CREATE INDEX ai_knowledge_chunks_bge_m3_hnsw ON ai_knowledge_chunks
  USING hnsw ((embedding::vector(1024)) vector_cosine_ops)
  WHERE embedding_model = 'BAAI/bge-m3';

-- ===========================================================================
-- Memory (separate from the knowledge base)
-- ===========================================================================
CREATE TABLE ai_memories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  model_profile_id uuid,
  kind             text NOT NULL CHECK (kind IN ('preference', 'fact', 'project')),
  content          text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 2000),
  -- 'explicit' = the user saved it; 'approved' = suggested by the model and approved.
  source           text NOT NULL CHECK (source IN ('explicit', 'approved')),
  embedding        vector,
  embedding_model  text,
  embedding_dims   integer CHECK (embedding_dims BETWEEN 1 AND 2000),
  last_used_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (model_profile_id, owner_id) REFERENCES ai_model_profiles (id, owner_id) ON DELETE CASCADE,
  CHECK ((embedding IS NULL) = (embedding_model IS NULL) AND (embedding IS NULL) = (embedding_dims IS NULL)),
  CHECK (embedding IS NULL OR vector_dims(embedding) = embedding_dims)
);
CREATE INDEX ai_memories_owner_idx ON ai_memories (owner_id, workspace_id, created_at DESC);
CREATE INDEX ai_memories_profile_idx ON ai_memories (model_profile_id);
CREATE INDEX ai_memories_workspace_idx ON ai_memories (workspace_id);
CREATE TRIGGER ai_memories_touch BEFORE UPDATE ON ai_memories FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

-- ===========================================================================
-- Evaluation
-- ===========================================================================
CREATE TABLE ai_evaluation_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid NOT NULL REFERENCES ai_model_versions (id) ON DELETE CASCADE,
  owner_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  evaluation_type  text NOT NULL CHECK (evaluation_type IN (
                     'full', 'arabic_quality', 'saudi_dialect', 'english_quality', 'coding', 'reasoning',
                     'instruction_following', 'retrieval', 'hallucination', 'tool_calling', 'latency')),
  suite_version    text NOT NULL CHECK (length(suite_version) <= 40),
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'passed', 'failed', 'error')),
  results          jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(results) = 'object'),
  total_count      integer NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  passed_count     integer NOT NULL DEFAULT 0 CHECK (passed_count >= 0 AND passed_count <= total_count),
  skipped_count    integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  score            numeric(6, 4) CHECK (score BETWEEN 0 AND 1),
  error            text CHECK (length(error) <= 2000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz
);
CREATE INDEX ai_evaluation_runs_version_idx ON ai_evaluation_runs (model_version_id, created_at DESC);
CREATE INDEX ai_evaluation_runs_owner_idx ON ai_evaluation_runs (owner_id, created_at DESC);
CREATE INDEX ai_evaluation_runs_queue_idx ON ai_evaluation_runs (created_at) WHERE status = 'queued';

CREATE TABLE ai_evaluation_cases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_run_id uuid NOT NULL REFERENCES ai_evaluation_runs (id) ON DELETE CASCADE,
  case_key          text NOT NULL CHECK (length(case_key) <= 100),
  category          text NOT NULL CHECK (length(category) <= 40),
  input             text NOT NULL,
  expected_output   text,
  actual_output     text,
  score             numeric(6, 4) CHECK (score BETWEEN 0 AND 1),
  passed            boolean,          -- NULL = skipped (capability absent), never counted as a pass
  latency_ms        integer CHECK (latency_ms >= 0),
  detail            jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(detail) = 'object'),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_run_id, case_key)
);

-- Deploy gate, enforced by the database: a version can only become
-- 'deployed' if a full evaluation run for it passed and recorded its cases.
CREATE FUNCTION omnix_enforce_deploy_gate() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'deployed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'deployed') THEN
    IF NOT EXISTS (
      SELECT 1 FROM ai_evaluation_runs r
       WHERE r.model_version_id = NEW.id
         AND r.evaluation_type = 'full'
         AND r.status = 'passed'
         AND r.total_count > 0
         AND (SELECT count(*) FROM ai_evaluation_cases c WHERE c.evaluation_run_id = r.id) = r.total_count
    ) THEN
      RAISE EXCEPTION 'version % has no passed full evaluation run', NEW.version
        USING ERRCODE = 'check_violation', HINT = 'omnix_deploy_gate';
    END IF;
    NEW.deployed_at := now();
    NEW.evaluation_status := 'passed';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER ai_model_versions_deploy_gate
  BEFORE INSERT OR UPDATE OF status ON ai_model_versions
  FOR EACH ROW EXECUTE FUNCTION omnix_enforce_deploy_gate();

-- ===========================================================================
-- Conversations
-- ===========================================================================
CREATE TABLE ai_conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  model_profile_id uuid NOT NULL,
  title            text NOT NULL DEFAULT '' CHECK (length(title) <= 200),
  archived_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (model_profile_id, owner_id) REFERENCES ai_model_profiles (id, owner_id) ON DELETE CASCADE
);
CREATE INDEX ai_conversations_owner_idx ON ai_conversations (owner_id, updated_at DESC);
CREATE INDEX ai_conversations_profile_idx ON ai_conversations (model_profile_id);
CREATE INDEX ai_conversations_workspace_idx ON ai_conversations (workspace_id);
CREATE TRIGGER ai_conversations_touch BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

CREATE TABLE ai_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES ai_conversations (id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL,      -- set by trigger from the conversation; cannot be spoofed
  role              text NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content           text NOT NULL CHECK (length(content) <= 200000),
  status            text NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'streaming', 'cancelled', 'error')),
  model_version_id  uuid REFERENCES ai_model_versions (id) ON DELETE SET NULL,
  parent_message_id uuid REFERENCES ai_messages (id) ON DELETE SET NULL,
  sources           jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(sources) = 'array'),
  usage_metadata    jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(usage_metadata) = 'object'),
  rating            smallint CHECK (rating IN (-1, 1)),
  feedback          text CHECK (length(feedback) <= 2000),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_conversation_idx ON ai_messages (conversation_id, created_at);
CREATE INDEX ai_messages_owner_idx ON ai_messages (owner_id);
CREATE INDEX ai_messages_version_idx ON ai_messages (model_version_id);
CREATE INDEX ai_messages_parent_idx ON ai_messages (parent_message_id);

CREATE FUNCTION omnix_message_owner() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT owner_id INTO NEW.owner_id FROM ai_conversations WHERE id = NEW.conversation_id;
  IF NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER ai_messages_owner BEFORE INSERT ON ai_messages FOR EACH ROW EXECUTE FUNCTION omnix_message_owner();

-- ===========================================================================
-- Usage and audit
-- ===========================================================================
CREATE TABLE ai_usage_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  model_profile_id uuid REFERENCES ai_model_profiles (id) ON DELETE SET NULL,
  model_version_id uuid REFERENCES ai_model_versions (id) ON DELETE SET NULL,
  operation        text NOT NULL CHECK (operation IN ('chat', 'embedding', 'evaluation', 'training', 'ingestion')),
  provider_type    text CHECK (length(provider_type) <= 40),
  input_tokens     integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens    integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  usage_source     text NOT NULL DEFAULT 'estimate' CHECK (usage_source IN ('provider', 'estimate')),
  latency_ms       integer CHECK (latency_ms >= 0),
  -- NULL when no price is configured for the provider. Never guessed.
  estimated_cost   numeric(14, 6) CHECK (estimated_cost >= 0),
  request_id       text CHECK (length(request_id) <= 100),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_events_owner_idx ON ai_usage_events (owner_id, created_at DESC);
CREATE INDEX ai_usage_events_profile_idx ON ai_usage_events (model_profile_id, created_at DESC);
CREATE INDEX ai_usage_events_version_idx ON ai_usage_events (model_version_id);
CREATE INDEX ai_usage_events_workspace_idx ON ai_usage_events (workspace_id);

-- Append-only. actor_id deliberately has no foreign key so that audit history
-- survives user deletion (retention is governed by policy, not by CASCADE).
CREATE TABLE ai_audit_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid,
  workspace_id  uuid,
  action        text NOT NULL CHECK (action ~ '^[a-z_]+(\.[a-z_]+)+$' AND length(action) <= 80),
  resource_type text NOT NULL CHECK (length(resource_type) <= 60),
  resource_id   text CHECK (length(resource_id) <= 100),
  request_id    text CHECK (length(request_id) <= 100),
  ip            inet,
  metadata      jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_audit_events_actor_idx ON ai_audit_events (actor_id, created_at DESC);
CREATE INDEX ai_audit_events_workspace_idx ON ai_audit_events (workspace_id, created_at DESC);
CREATE INDEX ai_audit_events_resource_idx ON ai_audit_events (resource_type, resource_id);

CREATE FUNCTION omnix_audit_append_only() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ai_audit_events is append-only' USING ERRCODE = 'insufficient_privilege';
END
$$;
CREATE TRIGGER ai_audit_events_no_update BEFORE UPDATE OR DELETE ON ai_audit_events
  FOR EACH ROW EXECUTE FUNCTION omnix_audit_append_only();
CREATE TRIGGER ai_audit_events_no_truncate BEFORE TRUNCATE ON ai_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION omnix_audit_append_only();

-- ===========================================================================
-- Platform provider registry (operators configure providers in server env;
-- the app syncs them through this narrow function at start-up).
-- ===========================================================================
CREATE FUNCTION omnix_upsert_platform_provider(
  p_name text, p_type text, p_endpoint text, p_capabilities jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE pid uuid;
BEGIN
  INSERT INTO ai_model_providers (provider_name, provider_type, endpoint, capabilities)
  VALUES (p_name, p_type, p_endpoint, coalesce(p_capabilities, '{}'))
  ON CONFLICT (provider_name) WHERE owner_id IS NULL
  DO UPDATE SET provider_type = EXCLUDED.provider_type,
                endpoint = EXCLUDED.endpoint,
                capabilities = EXCLUDED.capabilities,
                status = CASE WHEN ai_model_providers.status = 'disabled' THEN 'unknown' ELSE ai_model_providers.status END
  RETURNING id INTO pid;
  RETURN pid;
END
$$;

CREATE FUNCTION omnix_record_provider_health(p_id uuid, p_status text, p_error text, p_latency integer) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  UPDATE ai_model_providers
     SET status = p_status, last_health_error = left(p_error, 2000), last_latency_ms = p_latency, last_health_at = now()
   WHERE id = p_id
     AND (owner_id IS NULL OR owner_id = omnix_current_user_id())
$$;

REVOKE ALL ON FUNCTION omnix_upsert_platform_provider(text, text, text, jsonb),
  omnix_record_provider_health(uuid, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION omnix_upsert_platform_provider(text, text, text, jsonb),
  omnix_record_provider_health(uuid, text, text, integer) TO omnix_app;

-- ===========================================================================
-- Grants
-- ===========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON
  ai_model_providers, ai_model_connections, ai_model_profiles, ai_model_versions, ai_model_roles,
  ai_datasets, ai_dataset_items, ai_training_jobs, ai_knowledge_documents, ai_knowledge_chunks,
  ai_memories, ai_evaluation_runs, ai_evaluation_cases, ai_conversations, ai_messages
TO omnix_app;
GRANT SELECT ON ai_training_logs, ai_training_metrics TO omnix_app;
GRANT SELECT, INSERT ON ai_usage_events, ai_audit_events TO omnix_app;

-- The training worker sees only what training needs.
GRANT SELECT ON ai_datasets, ai_dataset_items, ai_model_profiles, ai_model_providers TO omnix_worker;
GRANT SELECT, UPDATE ON ai_training_jobs TO omnix_worker;
GRANT SELECT, INSERT ON ai_model_versions, ai_training_logs, ai_training_metrics TO omnix_worker;
GRANT INSERT ON ai_audit_events, ai_usage_events TO omnix_worker;

-- ===========================================================================
-- Row level security
-- ===========================================================================
ALTER TABLE ai_model_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_providers FORCE ROW LEVEL SECURITY;
CREATE POLICY providers_read ON ai_model_providers FOR SELECT TO omnix_app
  USING (owner_id IS NULL OR owner_id = omnix_current_user_id());
CREATE POLICY providers_own_write ON ai_model_providers FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id() AND omnix_can_write(workspace_id));
CREATE POLICY providers_worker ON ai_model_providers FOR SELECT TO omnix_worker USING (true);

ALTER TABLE ai_model_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY connections_own ON ai_model_connections FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id()
              AND omnix_can_write(workspace_id)
              AND (secret_reference LIKE 'enc:%' OR omnix_is_platform_admin()));

ALTER TABLE ai_model_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY profiles_own ON ai_model_profiles FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id() AND omnix_can_write(workspace_id));
CREATE POLICY profiles_worker ON ai_model_profiles FOR SELECT TO omnix_worker USING (true);

ALTER TABLE ai_model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY versions_own ON ai_model_versions FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id()) WITH CHECK (owner_id = omnix_current_user_id());
CREATE POLICY versions_worker_read ON ai_model_versions FOR SELECT TO omnix_worker USING (true);
-- The worker may only create un-deployed, un-evaluated versions.
CREATE POLICY versions_worker_insert ON ai_model_versions FOR INSERT TO omnix_worker
  WITH CHECK (status = 'ready' AND evaluation_status = 'not_evaluated' AND training_job_id IS NOT NULL);

ALTER TABLE ai_model_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY roles_own ON ai_model_roles FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id() AND omnix_is_member(workspace_id));

ALTER TABLE ai_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_datasets FORCE ROW LEVEL SECURITY;
CREATE POLICY datasets_own ON ai_datasets FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id() AND omnix_can_write(workspace_id));
CREATE POLICY datasets_worker ON ai_datasets FOR SELECT TO omnix_worker USING (true);

ALTER TABLE ai_dataset_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_dataset_items FORCE ROW LEVEL SECURITY;
CREATE POLICY dataset_items_own ON ai_dataset_items FOR ALL TO omnix_app
  USING (EXISTS (SELECT 1 FROM ai_datasets d WHERE d.id = dataset_id AND d.owner_id = omnix_current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM ai_datasets d WHERE d.id = dataset_id AND d.owner_id = omnix_current_user_id()));
CREATE POLICY dataset_items_worker ON ai_dataset_items FOR SELECT TO omnix_worker USING (true);

ALTER TABLE ai_training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY training_jobs_own ON ai_training_jobs FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id() AND omnix_can_write(workspace_id));
CREATE POLICY training_jobs_worker ON ai_training_jobs FOR ALL TO omnix_worker USING (true) WITH CHECK (true);

ALTER TABLE ai_training_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY training_logs_own ON ai_training_logs FOR SELECT TO omnix_app
  USING (EXISTS (SELECT 1 FROM ai_training_jobs j WHERE j.id = job_id AND j.owner_id = omnix_current_user_id()));
CREATE POLICY training_logs_worker ON ai_training_logs FOR ALL TO omnix_worker USING (true) WITH CHECK (true);

ALTER TABLE ai_training_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY training_metrics_own ON ai_training_metrics FOR SELECT TO omnix_app
  USING (EXISTS (SELECT 1 FROM ai_training_jobs j WHERE j.id = job_id AND j.owner_id = omnix_current_user_id()));
CREATE POLICY training_metrics_worker ON ai_training_metrics FOR ALL TO omnix_worker USING (true) WITH CHECK (true);

-- Knowledge is shared inside a workspace: members read, writers add, and
-- only the uploader or a workspace admin changes or deletes a document.
ALTER TABLE ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_docs_read ON ai_knowledge_documents FOR SELECT TO omnix_app USING (omnix_is_member(workspace_id));
CREATE POLICY knowledge_docs_insert ON ai_knowledge_documents FOR INSERT TO omnix_app
  WITH CHECK (owner_id = omnix_current_user_id() AND omnix_can_write(workspace_id));
CREATE POLICY knowledge_docs_update ON ai_knowledge_documents FOR UPDATE TO omnix_app
  USING (owner_id = omnix_current_user_id() OR omnix_is_workspace_admin(workspace_id))
  WITH CHECK (omnix_is_member(workspace_id));
CREATE POLICY knowledge_docs_delete ON ai_knowledge_documents FOR DELETE TO omnix_app
  USING (owner_id = omnix_current_user_id() OR omnix_is_workspace_admin(workspace_id));

ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_chunks_read ON ai_knowledge_chunks FOR SELECT TO omnix_app USING (omnix_is_member(workspace_id));
CREATE POLICY knowledge_chunks_write ON ai_knowledge_chunks FOR ALL TO omnix_app
  USING (EXISTS (SELECT 1 FROM ai_knowledge_documents d WHERE d.id = document_id
                   AND (d.owner_id = omnix_current_user_id() OR omnix_is_workspace_admin(d.workspace_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM ai_knowledge_documents d
                       WHERE d.id = ai_knowledge_chunks.document_id
                         AND d.workspace_id = ai_knowledge_chunks.workspace_id
                   AND (d.owner_id = omnix_current_user_id() OR omnix_is_workspace_admin(d.workspace_id))));

ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memories FORCE ROW LEVEL SECURITY;
CREATE POLICY memories_own ON ai_memories FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id() AND omnix_is_member(workspace_id));

ALTER TABLE ai_evaluation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evaluation_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY eval_runs_own ON ai_evaluation_runs FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id()
              AND EXISTS (SELECT 1 FROM ai_model_versions v WHERE v.id = model_version_id AND v.owner_id = omnix_current_user_id()));

ALTER TABLE ai_evaluation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evaluation_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY eval_cases_own ON ai_evaluation_cases FOR ALL TO omnix_app
  USING (EXISTS (SELECT 1 FROM ai_evaluation_runs r WHERE r.id = evaluation_run_id AND r.owner_id = omnix_current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM ai_evaluation_runs r WHERE r.id = evaluation_run_id AND r.owner_id = omnix_current_user_id()));

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY conversations_own ON ai_conversations FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id() AND omnix_is_member(workspace_id));

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY messages_own ON ai_messages FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id()) WITH CHECK (owner_id = omnix_current_user_id());

ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_events FORCE ROW LEVEL SECURITY;
CREATE POLICY usage_own_read ON ai_usage_events FOR SELECT TO omnix_app USING (owner_id = omnix_current_user_id());
CREATE POLICY usage_own_insert ON ai_usage_events FOR INSERT TO omnix_app WITH CHECK (owner_id = omnix_current_user_id());
CREATE POLICY usage_worker_insert ON ai_usage_events FOR INSERT TO omnix_worker WITH CHECK (operation = 'training');

ALTER TABLE ai_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON ai_audit_events FOR SELECT TO omnix_app
  USING (actor_id = omnix_current_user_id() OR (workspace_id IS NOT NULL AND omnix_is_workspace_admin(workspace_id)));
CREATE POLICY audit_insert ON ai_audit_events FOR INSERT TO omnix_app
  WITH CHECK (actor_id IS NULL OR actor_id = omnix_current_user_id());
CREATE POLICY audit_worker_insert ON ai_audit_events FOR INSERT TO omnix_worker WITH CHECK (actor_id IS NULL);
