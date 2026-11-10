-- Rollback for 0002_ai_model. DESTROYS all AI data. The migration runner
-- refuses to run this in production without an explicit flag and takes a
-- pg_dump backup first when pg_dump is available.
DROP TABLE IF EXISTS
  ai_audit_events, ai_usage_events, ai_messages, ai_conversations,
  ai_evaluation_cases, ai_evaluation_runs, ai_memories,
  ai_knowledge_chunks, ai_knowledge_documents,
  ai_training_metrics, ai_training_logs,
  ai_dataset_items, ai_datasets, ai_model_roles
  CASCADE;
ALTER TABLE IF EXISTS ai_model_versions DROP CONSTRAINT IF EXISTS ai_model_versions_training_job_fk;
DROP TABLE IF EXISTS ai_training_jobs, ai_model_versions, ai_model_profiles, ai_model_connections, ai_model_providers CASCADE;
DROP FUNCTION IF EXISTS omnix_enforce_deploy_gate();
DROP FUNCTION IF EXISTS omnix_message_owner();
DROP FUNCTION IF EXISTS omnix_audit_append_only();
DROP FUNCTION IF EXISTS omnix_upsert_platform_provider(text, text, text, jsonb);
DROP FUNCTION IF EXISTS omnix_record_provider_health(uuid, text, text, integer);
-- The `vector` extension is left installed: other schemas may depend on it.
