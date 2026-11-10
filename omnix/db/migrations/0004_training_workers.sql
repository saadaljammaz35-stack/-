-- 0004_training_workers — registry of fine-tuning workers and their
-- hardware, so the platform can say truthfully, before a job is queued,
-- whether GPU infrastructure exists ("Training unavailable — GPU
-- infrastructure required") and show live GPU utilisation.
CREATE TABLE ai_training_workers (
  worker_id         text PRIMARY KEY CHECK (length(worker_id) BETWEEN 1 AND 200),
  hostname          text CHECK (length(hostname) <= 200),
  cuda_available    boolean NOT NULL,
  gpus              jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(gpus) = 'array'),
  software          jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(software) = 'object'),
  current_job_id    uuid REFERENCES ai_training_jobs (id) ON DELETE SET NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_training_workers_heartbeat_idx ON ai_training_workers (last_heartbeat_at DESC);
CREATE INDEX ai_training_workers_job_idx ON ai_training_workers (current_job_id);

-- Contains hardware facts only (no user data). Every signed-in user may read it.
GRANT SELECT ON ai_training_workers TO omnix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_training_workers TO omnix_worker;
ALTER TABLE ai_training_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_workers FORCE ROW LEVEL SECURITY;
CREATE POLICY workers_read ON ai_training_workers FOR SELECT TO omnix_app USING (omnix_current_user_id() IS NOT NULL);
CREATE POLICY workers_self ON ai_training_workers FOR ALL TO omnix_worker USING (true) WITH CHECK (true);
