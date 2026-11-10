-- 0001_core — OMNIX core identity: users, workspaces, sessions, API keys.
--
-- Created because no OMNIX database existed (see AI_MODEL_ARCHITECTURE.md §1).
-- If this schema is ever merged into an existing OMNIX database that already
-- has users/workspaces, map these tables onto the existing ones instead of
-- applying this file (AI_MODEL_DATABASE.md §6).
--
-- Security model
--   * Tables are owned by the migration role. The application connects as a
--     LOGIN role that is a member of `omnix_app`, which owns nothing, so row
--     level security always applies to it.
--   * Every request runs in a transaction that does
--       SELECT set_config('app.user_id', <uuid>, true)
--     and every policy is written against omnix_current_user_id().
--   * The few lookups that must happen before the user is known (login,
--     session and API-key resolution) are narrow SECURITY DEFINER functions.

-- ---------------------------------------------------------------------------
-- Roles (no LOGIN: deployments create login users that inherit these)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'omnix_app') THEN
    CREATE ROLE omnix_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'omnix_worker') THEN
    CREATE ROLE omnix_worker NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO omnix_app, omnix_worker;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE FUNCTION omnix_current_user_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE FUNCTION omnix_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL
                     CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254 AND position('@' IN email) > 1),
  password_hash      text NOT NULL CHECK (length(password_hash) BETWEEN 20 AND 512),
  display_name       text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
  locale             text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  theme              text NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  is_platform_admin  boolean NOT NULL DEFAULT false,
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until       timestamptz,
  disabled_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (email);
CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

CREATE FUNCTION omnix_is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT coalesce((SELECT is_platform_admin FROM users WHERE id = omnix_current_user_id() AND disabled_at IS NULL), false)
$$;

-- ---------------------------------------------------------------------------
-- workspaces + membership
-- ---------------------------------------------------------------------------
CREATE TABLE workspaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  owner_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspaces_owner_idx ON workspaces (owner_id);
CREATE TRIGGER workspaces_touch BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

CREATE TABLE workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON workspace_members (user_id);

-- SECURITY DEFINER so policies can consult membership without recursing
-- through workspace_members' own policies.
CREATE FUNCTION omnix_workspace_role(ws uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT role FROM workspace_members WHERE workspace_id = ws AND user_id = omnix_current_user_id()
$$;

CREATE FUNCTION omnix_is_member(ws uuid) RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT omnix_workspace_role(ws) IS NOT NULL $$;

CREATE FUNCTION omnix_can_write(ws uuid) RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT omnix_workspace_role(ws) IN ('owner', 'admin', 'member') $$;

CREATE FUNCTION omnix_is_workspace_admin(ws uuid) RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT omnix_workspace_role(ws) IN ('owner', 'admin') $$;

-- ---------------------------------------------------------------------------
-- sessions (web) — only a SHA-256 of the token is stored
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL CHECK (length(token_hash) = 32),
  user_agent   text CHECK (length(user_agent) <= 512),
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX sessions_token_hash_key ON sessions (token_hash);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- ---------------------------------------------------------------------------
-- API keys for external applications and OMNIX modules
-- ---------------------------------------------------------------------------
CREATE TABLE ai_api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  prefix       text NOT NULL CHECK (prefix ~ '^omx_[a-z0-9]{8}$'),
  token_hash   bytea NOT NULL CHECK (length(token_hash) = 32),
  scopes       text[] NOT NULL
               CHECK (cardinality(scopes) > 0
                      AND scopes <@ ARRAY['chat', 'models:read', 'knowledge:read', 'knowledge:write', 'usage:read']::text[]),
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_api_keys_token_hash_key ON ai_api_keys (token_hash);
CREATE INDEX ai_api_keys_owner_idx ON ai_api_keys (owner_id, created_at DESC);
CREATE INDEX ai_api_keys_workspace_idx ON ai_api_keys (workspace_id);

-- ---------------------------------------------------------------------------
-- Rate limiting (shared across instances). Holds no personal data beyond an
-- opaque key; not subject to RLS.
-- ---------------------------------------------------------------------------
CREATE TABLE rate_limit_buckets (
  bucket_key   text NOT NULL CHECK (length(bucket_key) <= 200),
  window_start timestamptz NOT NULL,
  hits         integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX rate_limit_buckets_window_idx ON rate_limit_buckets (window_start);

-- ---------------------------------------------------------------------------
-- Pre-authentication lookups (SECURITY DEFINER, minimal surface)
-- ---------------------------------------------------------------------------
CREATE FUNCTION omnix_auth_lookup(p_email text)
RETURNS TABLE (user_id uuid, password_hash text, disabled_at timestamptz, locked_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id, password_hash, disabled_at, locked_until FROM users WHERE email = lower(p_email)
$$;

-- Exponential lockout: 5 failures → 1 min, doubling, capped at 1 hour.
CREATE FUNCTION omnix_auth_record_failure(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE n integer;
BEGIN
  UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = p_user
  RETURNING failed_login_count INTO n;
  IF n IS NOT NULL AND n >= 5 THEN
    UPDATE users
       SET locked_until = now() + least(interval '1 hour', interval '1 minute' * power(2, n - 5))
     WHERE id = p_user;
  END IF;
END
$$;

CREATE FUNCTION omnix_auth_record_success(p_user uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = p_user $$;

CREATE FUNCTION omnix_session_lookup(p_token_hash bytea)
RETURNS TABLE (session_id uuid, user_id uuid, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.user_id, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
   WHERE s.token_hash = p_token_hash
     AND s.revoked_at IS NULL
     AND s.expires_at > now()
     AND u.disabled_at IS NULL
$$;

CREATE FUNCTION omnix_api_key_lookup(p_token_hash bytea)
RETURNS TABLE (key_id uuid, owner_id uuid, workspace_id uuid, scopes text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT k.id, k.owner_id, k.workspace_id, k.scopes
    FROM ai_api_keys k JOIN users u ON u.id = k.owner_id
   WHERE k.token_hash = p_token_hash
     AND k.revoked_at IS NULL
     AND (k.expires_at IS NULL OR k.expires_at > now())
     AND u.disabled_at IS NULL
$$;

REVOKE ALL ON FUNCTION omnix_auth_lookup(text), omnix_auth_record_failure(uuid), omnix_auth_record_success(uuid),
  omnix_session_lookup(bytea), omnix_api_key_lookup(bytea), omnix_workspace_role(uuid), omnix_is_platform_admin()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION omnix_auth_lookup(text), omnix_auth_record_failure(uuid), omnix_auth_record_success(uuid),
  omnix_session_lookup(bytea), omnix_api_key_lookup(bytea)
  TO omnix_app;
GRANT EXECUTE ON FUNCTION omnix_workspace_role(uuid), omnix_is_platform_admin() TO omnix_app, omnix_worker;

-- ---------------------------------------------------------------------------
-- Grants + row level security
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT ON users TO omnix_app;
GRANT UPDATE (display_name, locale, theme, password_hash) ON users TO omnix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON workspaces, workspace_members, sessions, ai_api_keys TO omnix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_buckets TO omnix_app;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_self_select ON users FOR SELECT TO omnix_app USING (id = omnix_current_user_id());
-- Registration: the app generates the id and sets app.user_id to it first.
CREATE POLICY users_self_insert ON users FOR INSERT TO omnix_app
  WITH CHECK (id = omnix_current_user_id() AND is_platform_admin = false);
CREATE POLICY users_self_update ON users FOR UPDATE TO omnix_app
  USING (id = omnix_current_user_id()) WITH CHECK (id = omnix_current_user_id());

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY workspaces_read ON workspaces FOR SELECT TO omnix_app
  USING (owner_id = omnix_current_user_id() OR omnix_is_member(id));
CREATE POLICY workspaces_create ON workspaces FOR INSERT TO omnix_app WITH CHECK (owner_id = omnix_current_user_id());
CREATE POLICY workspaces_update ON workspaces FOR UPDATE TO omnix_app
  USING (omnix_is_workspace_admin(id)) WITH CHECK (omnix_is_workspace_admin(id));
CREATE POLICY workspaces_delete ON workspaces FOR DELETE TO omnix_app USING (owner_id = omnix_current_user_id());

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members FORCE ROW LEVEL SECURITY;
CREATE POLICY members_read ON workspace_members FOR SELECT TO omnix_app
  USING (user_id = omnix_current_user_id() OR omnix_is_member(workspace_id));
CREATE POLICY members_bootstrap_owner ON workspace_members FOR INSERT TO omnix_app
  WITH CHECK (
    (user_id = omnix_current_user_id() AND role = 'owner'
       AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND w.owner_id = omnix_current_user_id()))
    OR (omnix_is_workspace_admin(workspace_id) AND role <> 'owner')
  );
CREATE POLICY members_admin_update ON workspace_members FOR UPDATE TO omnix_app
  USING (omnix_is_workspace_admin(workspace_id) AND role <> 'owner')
  WITH CHECK (omnix_is_workspace_admin(workspace_id) AND role <> 'owner');
CREATE POLICY members_admin_delete ON workspace_members FOR DELETE TO omnix_app
  USING (omnix_is_workspace_admin(workspace_id) AND role <> 'owner');

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY sessions_own ON sessions FOR ALL TO omnix_app
  USING (user_id = omnix_current_user_id()) WITH CHECK (user_id = omnix_current_user_id());

ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_api_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY api_keys_own ON ai_api_keys FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id() AND omnix_is_member(workspace_id));
