-- 0007_app_studio — App Studio: the owner describes an app, their model
-- writes the files, every AI turn becomes an immutable version, and a version
-- can be published at an unguessable public link.
--
-- Files are stored as one jsonb object per version ({"index.html": "…"});
-- sizes are limited by the application (1 MB per version, 200 KB per file).

CREATE TABLE ai_app_projects (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id         uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  name                 text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description          text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  current_version_id   uuid,
  published_slug       text UNIQUE CHECK (published_slug ~ '^[a-z0-9]{12,32}$'),
  published_version_id uuid,
  published_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  CHECK ((published_slug IS NULL) = (published_version_id IS NULL))
);
CREATE INDEX ai_app_projects_owner_idx ON ai_app_projects (owner_id, updated_at DESC);
CREATE INDEX ai_app_projects_workspace_idx ON ai_app_projects (workspace_id);
CREATE TRIGGER ai_app_projects_touch BEFORE UPDATE ON ai_app_projects FOR EACH ROW EXECUTE FUNCTION omnix_touch_updated_at();

CREATE TABLE ai_app_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL,
  owner_id         uuid NOT NULL,
  version_no       integer NOT NULL CHECK (version_no >= 1),
  files            jsonb NOT NULL CHECK (jsonb_typeof(files) = 'object'),
  summary          text NOT NULL DEFAULT '' CHECK (length(summary) <= 4000),
  source           text NOT NULL CHECK (source IN ('ai', 'restore', 'manual')),
  model_version_id uuid REFERENCES ai_model_versions (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (project_id, owner_id) REFERENCES ai_app_projects (id, owner_id) ON DELETE CASCADE,
  UNIQUE (project_id, version_no),
  UNIQUE (id, project_id)
);
CREATE INDEX ai_app_versions_project_idx ON ai_app_versions (project_id, version_no DESC);
CREATE INDEX ai_app_versions_model_idx ON ai_app_versions (model_version_id);

-- A project can only point at its own versions.
ALTER TABLE ai_app_projects
  ADD CONSTRAINT ai_app_projects_current_version_fk FOREIGN KEY (current_version_id, id) REFERENCES ai_app_versions (id, project_id),
  ADD CONSTRAINT ai_app_projects_published_version_fk FOREIGN KEY (published_version_id, id) REFERENCES ai_app_versions (id, project_id);
CREATE INDEX ai_app_projects_current_idx ON ai_app_projects (current_version_id);
CREATE INDEX ai_app_projects_published_idx ON ai_app_projects (published_version_id);

CREATE TABLE ai_app_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  owner_id   uuid NOT NULL,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL CHECK (length(content) <= 100000),
  status     text NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'cancelled', 'error')),
  version_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (project_id, owner_id) REFERENCES ai_app_projects (id, owner_id) ON DELETE CASCADE,
  FOREIGN KEY (version_id, project_id) REFERENCES ai_app_versions (id, project_id)
);
CREATE INDEX ai_app_messages_project_idx ON ai_app_messages (project_id, created_at);
CREATE INDEX ai_app_messages_version_idx ON ai_app_messages (version_id);

-- Row level security: only the owner, only inside a workspace they belong to.
ALTER TABLE ai_app_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_app_projects FORCE ROW LEVEL SECURITY;
CREATE POLICY app_projects_own ON ai_app_projects FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id() AND omnix_is_member(workspace_id));

ALTER TABLE ai_app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_app_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY app_versions_own ON ai_app_versions FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id());

ALTER TABLE ai_app_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_app_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY app_messages_own ON ai_app_messages FOR ALL TO omnix_app
  USING (owner_id = omnix_current_user_id())
  WITH CHECK (owner_id = omnix_current_user_id());

-- Versions are immutable: no UPDATE grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_app_projects TO omnix_app;
GRANT SELECT, INSERT, DELETE ON ai_app_versions, ai_app_messages TO omnix_app;

-- Public links: the only way to read another user's app is through its
-- published slug, and only the published version.
GRANT SELECT ON ai_app_projects, ai_app_versions TO omnix_definer;
CREATE POLICY definer_app_projects_published ON ai_app_projects FOR SELECT TO omnix_definer
  USING (published_slug IS NOT NULL);
CREATE POLICY definer_app_versions_published ON ai_app_versions FOR SELECT TO omnix_definer
  USING (EXISTS (SELECT 1 FROM ai_app_projects p WHERE p.published_version_id = ai_app_versions.id));

CREATE FUNCTION omnix_published_app(p_slug text)
RETURNS TABLE (name text, files jsonb, published_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT p.name, v.files, p.published_at
    FROM ai_app_projects p
    JOIN ai_app_versions v ON v.id = p.published_version_id
    JOIN users u ON u.id = p.owner_id
   WHERE p.published_slug = p_slug
     AND u.disabled_at IS NULL
$$;
REVOKE ALL ON FUNCTION omnix_published_app(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION omnix_published_app(text) TO omnix_app;
ALTER FUNCTION omnix_published_app(text) OWNER TO omnix_definer;
