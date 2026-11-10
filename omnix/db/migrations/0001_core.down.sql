-- Rollback for 0001_core. DESTROYS all users, workspaces, sessions, API keys.
DROP TABLE IF EXISTS rate_limit_buckets, ai_api_keys, sessions, workspace_members, workspaces, users CASCADE;
DROP FUNCTION IF EXISTS omnix_auth_lookup(text);
DROP FUNCTION IF EXISTS omnix_auth_record_failure(uuid);
DROP FUNCTION IF EXISTS omnix_auth_record_success(uuid);
DROP FUNCTION IF EXISTS omnix_session_lookup(bytea);
DROP FUNCTION IF EXISTS omnix_api_key_lookup(bytea);
DROP FUNCTION IF EXISTS omnix_is_workspace_admin(uuid);
DROP FUNCTION IF EXISTS omnix_can_write(uuid);
DROP FUNCTION IF EXISTS omnix_is_member(uuid);
DROP FUNCTION IF EXISTS omnix_workspace_role(uuid);
DROP FUNCTION IF EXISTS omnix_is_platform_admin();
DROP FUNCTION IF EXISTS omnix_touch_updated_at();
DROP FUNCTION IF EXISTS omnix_current_user_id();
REVOKE USAGE ON SCHEMA public FROM omnix_app, omnix_worker;
-- Roles are left in place: login users created by the deployment are members
-- of them, and dropping a role is a cluster-wide operation. Drop manually with
-- DROP ROLE omnix_app; DROP ROLE omnix_worker; once nothing references them.
