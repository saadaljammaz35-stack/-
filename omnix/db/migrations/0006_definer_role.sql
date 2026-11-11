-- 0006_definer_role — SECURITY DEFINER functions no longer depend on the
-- schema owner having BYPASSRLS.
--
-- The pre-authentication functions (login, session and API-key lookup,
-- workspace membership, background-work discovery) run as their owner.
-- With FORCE ROW LEVEL SECURITY, an owner without BYPASSRLS sees no rows, so
-- on hosts where the migration role lacks that attribute nobody could sign
-- in. Verified on PostgreSQL 16 with a CREATEROLE, non-BYPASSRLS owner.
--
-- Fix: a dedicated NOLOGIN role owns exactly these functions and has
-- explicit, narrow grants and policies on exactly the tables they touch.
-- No login role is a member of it, so nothing else can act as it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'omnix_definer') THEN
    CREATE ROLE omnix_definer NOLOGIN;
  END IF;
  -- PostgreSQL 16+: a CREATEROLE (non-superuser) owner must hold SET on a
  -- role to transfer ownership to it.
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)
     AND NOT pg_has_role(current_user, 'omnix_definer', 'SET') THEN
    BEGIN
      IF current_setting('server_version_num')::int >= 160000 THEN
        EXECUTE format('GRANT omnix_definer TO %I WITH SET TRUE', current_user);
      ELSE
        EXECUTE format('GRANT omnix_definer TO %I', current_user);
      END IF;
    EXCEPTION WHEN insufficient_privilege OR invalid_grant_operation THEN
      -- Roles are cluster-wide: on a server shared by several OMNIX
      -- databases the role may have been created by another owner.
      RAISE EXCEPTION 'role omnix_definer exists but % cannot use it', current_user
        USING HINT = format('As an administrator run: GRANT omnix_definer TO %I WITH SET TRUE; then migrate again.', current_user);
    END;
  END IF;
END
$$;

-- CREATE is required to own the functions; no login role can act as this role.
GRANT USAGE, CREATE ON SCHEMA public TO omnix_definer;
GRANT SELECT ON users, workspace_members, sessions, ai_api_keys TO omnix_definer;
GRANT UPDATE (failed_login_count, locked_until) ON users TO omnix_definer;
GRANT SELECT, INSERT, UPDATE ON ai_model_providers TO omnix_definer;
GRANT SELECT, UPDATE ON ai_knowledge_documents, ai_evaluation_runs TO omnix_definer;

CREATE POLICY definer_users_read ON users FOR SELECT TO omnix_definer USING (true);
CREATE POLICY definer_users_lockout ON users FOR UPDATE TO omnix_definer USING (true) WITH CHECK (true);
CREATE POLICY definer_members_read ON workspace_members FOR SELECT TO omnix_definer USING (true);
CREATE POLICY definer_sessions_read ON sessions FOR SELECT TO omnix_definer USING (true);
CREATE POLICY definer_api_keys_read ON ai_api_keys FOR SELECT TO omnix_definer USING (true);
CREATE POLICY definer_providers ON ai_model_providers FOR ALL TO omnix_definer USING (true) WITH CHECK (true);
CREATE POLICY definer_documents ON ai_knowledge_documents FOR ALL TO omnix_definer USING (true) WITH CHECK (true);
CREATE POLICY definer_eval_runs ON ai_evaluation_runs FOR ALL TO omnix_definer USING (true) WITH CHECK (true);

ALTER FUNCTION omnix_is_platform_admin() OWNER TO omnix_definer;
ALTER FUNCTION omnix_workspace_role(uuid) OWNER TO omnix_definer;
ALTER FUNCTION omnix_auth_lookup(text) OWNER TO omnix_definer;
ALTER FUNCTION omnix_auth_record_failure(uuid) OWNER TO omnix_definer;
ALTER FUNCTION omnix_auth_record_success(uuid) OWNER TO omnix_definer;
ALTER FUNCTION omnix_session_lookup(bytea) OWNER TO omnix_definer;
ALTER FUNCTION omnix_api_key_lookup(bytea) OWNER TO omnix_definer;
ALTER FUNCTION omnix_upsert_platform_provider(text, text, text, jsonb) OWNER TO omnix_definer;
ALTER FUNCTION omnix_record_provider_health(uuid, text, text, integer) OWNER TO omnix_definer;
ALTER FUNCTION omnix_pending_work(integer) OWNER TO omnix_definer;
ALTER FUNCTION omnix_requeue_stale_work() OWNER TO omnix_definer;
