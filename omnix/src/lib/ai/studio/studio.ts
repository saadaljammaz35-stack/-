import "server-only";
import { randomBytes } from "node:crypto";
import { audit } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/session";
import { withAnon, withUser, type Db } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { log } from "@/lib/log";
import { signValue, verifySignedValue } from "@/lib/security/secrets";
import { estimateTokens } from "../tokens";
import { findCandidate } from "../models/catalog";
import { resolveModel, type ResolvedModel } from "../models/service";
import { loadProvider, syncPlatformProviders } from "../providers/registry";
import { ProviderError, type ChatMessage, type Usage } from "../providers/types";
import { checkFiles, entryFile, StudioOutputParser, type AppFiles } from "./files";

export interface AppProject {
  id: string;
  name: string;
  description: string;
  currentVersionId: string | null;
  publishedSlug: string | null;
  publishedVersionId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppVersionMeta {
  id: string;
  versionNo: number;
  summary: string;
  source: "ai" | "restore" | "manual";
  createdAt: string;
  fileCount: number;
}

export interface AppMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "cancelled" | "error";
  versionId: string | null;
  createdAt: string;
}

function projectFromRow(r: Record<string, unknown>): AppProject {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    currentVersionId: (r.current_version_id as string | null) ?? null,
    publishedSlug: (r.published_slug as string | null) ?? null,
    publishedVersionId: (r.published_version_id as string | null) ?? null,
    publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

function messageFromRow(r: Record<string, unknown>): AppMessage {
  return {
    id: r.id as string,
    role: r.role as AppMessage["role"],
    content: r.content as string,
    status: r.status as AppMessage["status"],
    versionId: (r.version_id as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Preview links: /preview/<versionId>.<ownerId>.<expiry>.<signature>/index.html
// The token is a capability for one immutable version; the files are still
// read under the owner's row level security.
// ---------------------------------------------------------------------------

const PREVIEW_TTL_SECONDS = 24 * 3600;

export function previewToken(ownerId: string, versionId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + PREVIEW_TTL_SECONDS;
  const payload = `${versionId}.${ownerId}.${exp}`;
  return `${payload}.${signValue("app-preview", payload)}`;
}

export function verifyPreviewToken(token: string, now = Date.now()): { versionId: string; ownerId: string } | null {
  const m = /^([0-9a-f-]{36})\.([0-9a-f-]{36})\.(\d{10})\.([A-Za-z0-9_-]{32})$/.exec(token);
  if (!m) return null;
  const [, versionId, ownerId, exp, sig] = m;
  if (Number(exp) * 1000 < now) return null;
  if (!verifySignedValue("app-preview", `${versionId}.${ownerId}.${exp}`, sig!)) return null;
  return { versionId: versionId!, ownerId: ownerId! };
}

export function previewUrl(ownerId: string, versionId: string, files: AppFiles): string | null {
  const entry = entryFile(files);
  return entry ? `/preview/${previewToken(ownerId, versionId)}/${entry}` : null;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProject(db: Db, ctx: AuthContext & { requestId?: string; ip?: string | null }, input: { name: string; description?: string }): Promise<AppProject> {
  const r = await db.query(
    `INSERT INTO ai_app_projects (owner_id, workspace_id, name, description) VALUES ($1, $2, $3, $4) RETURNING *`,
    [ctx.userId, ctx.workspaceId, input.name.trim(), input.description?.trim() ?? ""],
  );
  await audit(db, ctx, "app.created", "app_project", r.rows[0].id, {});
  return projectFromRow(r.rows[0]);
}

export async function listProjects(db: Db, workspaceId: string): Promise<(AppProject & { versions: number })[]> {
  const r = await db.query(
    `SELECT p.*, (SELECT count(*) FROM ai_app_versions v WHERE v.project_id = p.id)::int AS versions
       FROM ai_app_projects p WHERE p.workspace_id = $1 ORDER BY p.updated_at DESC LIMIT 200`,
    [workspaceId],
  );
  return r.rows.map((row) => ({ ...projectFromRow(row), versions: row.versions as number }));
}

export async function getProject(db: Db, id: string): Promise<AppProject> {
  const r = await db.query("SELECT * FROM ai_app_projects WHERE id = $1", [id]);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "App not found");
  return projectFromRow(r.rows[0]);
}

export async function listVersions(db: Db, projectId: string): Promise<AppVersionMeta[]> {
  const r = await db.query(
    `SELECT id, version_no, summary, source, created_at, (SELECT count(*) FROM jsonb_object_keys(files))::int AS file_count
       FROM ai_app_versions WHERE project_id = $1 ORDER BY version_no DESC LIMIT 200`,
    [projectId],
  );
  return r.rows.map((x) => ({
    id: x.id,
    versionNo: x.version_no,
    summary: x.summary,
    source: x.source,
    createdAt: new Date(x.created_at).toISOString(),
    fileCount: x.file_count,
  }));
}

export async function getVersionFiles(db: Db, projectId: string, versionId: string): Promise<AppFiles> {
  const r = await db.query("SELECT files FROM ai_app_versions WHERE id = $1 AND project_id = $2", [versionId, projectId]);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "Version not found");
  return r.rows[0].files as AppFiles;
}

export async function listMessages(db: Db, projectId: string, limit = 100): Promise<AppMessage[]> {
  const r = await db.query(
    `SELECT * FROM (SELECT * FROM ai_app_messages WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2) t ORDER BY created_at ASC`,
    [projectId, limit],
  );
  return r.rows.map(messageFromRow);
}

/** Everything the studio screen needs in one call. */
export async function projectDetail(db: Db, ownerId: string, id: string) {
  const project = await getProject(db, id);
  const [versions, messages] = await Promise.all([listVersions(db, id), listMessages(db, id)]);
  const files = project.currentVersionId ? await getVersionFiles(db, id, project.currentVersionId) : {};
  return {
    project,
    versions,
    messages,
    files,
    previewUrl: project.currentVersionId ? previewUrl(ownerId, project.currentVersionId, files) : null,
  };
}

export async function updateProject(db: Db, id: string, fields: { name?: string; description?: string }): Promise<AppProject> {
  const r = await db.query(
    `UPDATE ai_app_projects SET name = coalesce($2, name), description = coalesce($3, description) WHERE id = $1 RETURNING *`,
    [id, fields.name?.trim() ?? null, fields.description?.trim() ?? null],
  );
  if (!r.rowCount) throw new AppError("NOT_FOUND", "App not found");
  return projectFromRow(r.rows[0]);
}

export async function deleteProject(db: Db, ctx: AuthContext & { requestId?: string; ip?: string | null }, id: string): Promise<void> {
  const r = await db.query("DELETE FROM ai_app_projects WHERE id = $1", [id]);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "App not found");
  await audit(db, ctx, "app.deleted", "app_project", id, {});
}

async function insertVersion(
  db: Db,
  ownerId: string,
  projectId: string,
  files: AppFiles,
  meta: { summary: string; source: "ai" | "restore" | "manual"; modelVersionId?: string | null },
): Promise<{ id: string; versionNo: number }> {
  // Serialise version numbers per project.
  await db.query("SELECT 1 FROM ai_app_projects WHERE id = $1 FOR UPDATE", [projectId]);
  const r = await db.query(
    `INSERT INTO ai_app_versions (project_id, owner_id, version_no, files, summary, source, model_version_id)
     VALUES ($1, $2, (SELECT coalesce(max(version_no), 0) + 1 FROM ai_app_versions WHERE project_id = $1), $3, $4, $5, $6)
     RETURNING id, version_no`,
    [projectId, ownerId, JSON.stringify(files), meta.summary.slice(0, 4000), meta.source, meta.modelVersionId ?? null],
  );
  await db.query("UPDATE ai_app_projects SET current_version_id = $2 WHERE id = $1", [projectId, r.rows[0].id]);
  return { id: r.rows[0].id, versionNo: r.rows[0].version_no };
}

/** Makes an older version current again by copying it into a new version (history is never rewritten). */
export async function restoreVersion(db: Db, ctx: AuthContext, projectId: string, versionId: string) {
  await getProject(db, projectId);
  const r = await db.query("SELECT files, version_no FROM ai_app_versions WHERE id = $1 AND project_id = $2", [versionId, projectId]);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "Version not found");
  const v = await insertVersion(db, ctx.userId, projectId, r.rows[0].files, { summary: `Restored version ${r.rows[0].version_no}`, source: "restore" });
  return { ...v, previewUrl: previewUrl(ctx.userId, v.id, r.rows[0].files) };
}

export async function publishProject(db: Db, ctx: AuthContext & { requestId?: string; ip?: string | null }, projectId: string, versionId?: string) {
  const p = await getProject(db, projectId);
  const target = versionId ?? p.currentVersionId;
  if (!target) throw new AppError("PRECONDITION_FAILED", "Build the app before publishing it");
  const files = await getVersionFiles(db, projectId, target);
  if (!entryFile(files)) throw new AppError("PRECONDITION_FAILED", "The app has no HTML page to open");
  const slug = p.publishedSlug ?? randomBytes(10).toString("hex").slice(0, 14);
  const r = await db.query(
    `UPDATE ai_app_projects SET published_slug = $2, published_version_id = $3, published_at = now() WHERE id = $1 RETURNING *`,
    [projectId, slug, target],
  );
  await audit(db, ctx, "app.published", "app_project", projectId, { versionId: target });
  return projectFromRow(r.rows[0]);
}

export async function unpublishProject(db: Db, ctx: AuthContext & { requestId?: string; ip?: string | null }, projectId: string) {
  await getProject(db, projectId);
  const r = await db.query(
    `UPDATE ai_app_projects SET published_slug = NULL, published_version_id = NULL, published_at = NULL WHERE id = $1 RETURNING *`,
    [projectId],
  );
  await audit(db, ctx, "app.unpublished", "app_project", projectId, {});
  return projectFromRow(r.rows[0]);
}

/** Files of a published app, by its public slug (no session). */
export async function publishedApp(slug: string): Promise<{ name: string; files: AppFiles } | null> {
  if (!/^[a-z0-9]{12,32}$/.test(slug)) return null;
  const r = await withAnon((db) => db.query("SELECT name, files FROM omnix_published_app($1)", [slug]));
  return r.rows[0] ? { name: r.rows[0].name, files: r.rows[0].files } : null;
}

/** Files of one version for a valid preview token, read as the owner. */
export async function previewFiles(token: string): Promise<AppFiles | null> {
  const t = verifyPreviewToken(token);
  if (!t) return null;
  const r = await withUser(t.ownerId, (db) => db.query("SELECT files FROM ai_app_versions WHERE id = $1", [t.versionId]));
  return r.rows[0] ? (r.rows[0].files as AppFiles) : null;
}

// ---------------------------------------------------------------------------
// One build turn
// ---------------------------------------------------------------------------

export type StudioEvent =
  | { type: "meta"; userMessageId: string; model: { displayName: string; provider: string; providerModel: string } }
  | { type: "delta"; text: string }
  | { type: "file"; path: string; status: "writing" | "done" | "deleted"; bytes?: number }
  | { type: "warning"; message: string }
  | {
      type: "done";
      message: AppMessage;
      version: { id: string; versionNo: number } | null;
      previewUrl: string | null;
      changed: string[];
      deleted: string[];
      usage: Usage;
    }
  | { type: "error"; code: string; message: string };

export function studioSystemPrompt(language: "ar" | "en" | "auto"): string {
  const lang = language === "ar" ? "Arabic" : language === "en" ? "English" : "the language the user writes in";
  return `You are the app builder of OMNIX App Studio. You build complete, working web apps that run directly in a browser, with no build step.

OUTPUT FORMAT — follow it exactly:
1. First write one to three short sentences in ${lang} saying what you are building or changing.
2. Then write every file you create or change like this:
<omnix-file path="index.html">
…the complete content of the file…
</omnix-file>
3. Always write the COMPLETE file. Never write a diff, never write "rest unchanged" or "…".
4. Only output files you create or change; unchanged files stay as they are. To remove a file write: <omnix-delete path="old.js" />
5. Never put Markdown code fences (\`\`\`) around or inside files. Write nothing after the last file.

TECHNICAL RULES:
- The app opens at index.html. Link local files with relative paths (style.css, app.js, src/utils.js).
- Prefer plain HTML, CSS and JavaScript. ES modules are fine: <script type="module" src="main.js"></script> with relative imports.
- For React, load pinned versions from https://unpkg.com (react@18.3.1/umd/react.production.min.js, react-dom@18.3.1/umd/react-dom.production.min.js, @babel/standalone@7.26.4/babel.min.js) and use <script type="text/babel" src="app.jsx"></script>.
- Public CDNs (unpkg.com, cdn.jsdelivr.net, fonts.googleapis.com) and public APIs are allowed. There is no server-side code and no database: keep data in localStorage (it may reset in the preview).
- Make it look polished and work well on phones. For Arabic content use <html lang="ar" dir="rtl"> and an Arabic-friendly font.
- Allowed file types: html, css, js, mjs, jsx, json, svg, md, txt. At most 40 files, 150 KB each. No images other than inline SVG.
- Never put API keys, passwords or other secrets in the code.`;
}

function renderFiles(files: AppFiles): string {
  const paths = Object.keys(files).sort();
  if (!paths.length) return "The project is empty; create it from scratch.";
  return `Current project files (${paths.length}):\n\n${paths.map((p) => `<omnix-file path="${p}">\n${files[p]}</omnix-file>`).join("\n\n")}`;
}

async function resolveStudioModel(db: Db, ctx: AuthContext): Promise<ResolvedModel> {
  // A model bound to the "coding" role builds apps; otherwise the default model.
  try {
    return await resolveModel(db, ctx, { role: "coding" });
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") return resolveModel(db, ctx, { role: "default" });
    throw err;
  }
}

function mapError(err: unknown): { code: string; message: string } {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  if (err instanceof ProviderError) {
    const code =
      err.code === "timeout" ? "PROVIDER_TIMEOUT" : err.code === "context_length" ? "CONTEXT_TOO_LONG" : err.code === "unavailable" ? "PROVIDER_UNAVAILABLE" : "PROVIDER_ERROR";
    return { code, message: err.message };
  }
  return { code: "INTERNAL", message: "The model could not finish building" };
}

export async function* runStudioTurn(input: {
  auth: AuthContext & { requestId: string; ip?: string | null };
  projectId: string;
  message: string;
  signal: AbortSignal;
}): AsyncGenerator<StudioEvent> {
  const ctx = input.auth;
  const started = Date.now();

  const prep = await withUser(ctx.userId, async (db) => {
    const project = await getProject(db, input.projectId);
    const files = project.currentVersionId ? await getVersionFiles(db, project.id, project.currentVersionId) : {};
    const history = await listMessages(db, project.id, 12);
    await syncPlatformProviders(db);
    const resolved = await resolveStudioModel(db, ctx);
    const um = await db.query(
      `INSERT INTO ai_app_messages (project_id, owner_id, role, content) VALUES ($1, $2, 'user', $3) RETURNING *`,
      [project.id, ctx.userId, input.message],
    );
    await db.query("UPDATE ai_app_projects SET updated_at = now() WHERE id = $1", [project.id]);
    const { record, provider } = await loadProvider(db, resolved.version.providerId);
    return { project, files, history, resolved, record, provider, userMessage: messageFromRow(um.rows[0]) };
  });

  const { resolved, record, provider, files } = prep;
  const { profile, version } = resolved;
  yield {
    type: "meta",
    userMessageId: prep.userMessage.id,
    model: { displayName: profile.displayName, provider: record.providerName, providerModel: version.providerModel },
  };

  const messages: ChatMessage[] = [{ role: "system", content: studioSystemPrompt(profile.defaultLanguage) }];
  for (const m of prep.history) {
    if (m.status === "error" || !m.content.trim()) continue;
    messages.push({ role: m.role, content: m.content.slice(0, 4000) });
  }
  messages.push({ role: "user", content: `${renderFiles(files)}\n\nRequest:\n${input.message}` });

  let contextLength = await provider
    .getModelInfo(version.providerModel)
    .then((i) => i.contextLength)
    .catch(() => null);
  contextLength ??= findCandidate(version.baseModel)?.contextLength ?? 32_768;
  const inputTokens = messages.reduce((n, m) => n + estimateTokens(m.content) + 4, 0);
  const maxTokens = Math.min(16_384, contextLength - inputTokens - 256);

  const parser = new StudioOutputParser();
  const changed = new Map<string, string>();
  const deleted = new Set<string>();
  let explanation = "";
  let usage: Usage = { inputTokens: 0, outputTokens: 0, source: "estimate" };
  let status: AppMessage["status"] = "complete";
  let failure: { code: string; message: string } | null = null;

  const handle = function* (events: ReturnType<StudioOutputParser["push"]>): Generator<StudioEvent> {
    for (const ev of events) {
      if (ev.type === "text") {
        explanation += ev.text;
        yield { type: "delta", text: ev.text };
      } else if (ev.type === "file_start") {
        yield { type: "file", path: ev.path, status: "writing" };
      } else if (ev.type === "file_progress") {
        yield { type: "file", path: ev.path, status: "writing", bytes: ev.bytes };
      } else if (ev.type === "file_done") {
        changed.set(ev.path, ev.content);
        deleted.delete(ev.path);
        yield { type: "file", path: ev.path, status: "done", bytes: ev.content.length };
      } else if (ev.type === "file_delete") {
        deleted.add(ev.path);
        changed.delete(ev.path);
        yield { type: "file", path: ev.path, status: "deleted" };
      } else {
        yield { type: "warning", message: ev.message };
      }
    }
  };

  try {
    if (maxTokens < 2048) {
      throw new AppError("CONTEXT_TOO_LONG", "This app is too large for the model's context window; start a new app or remove files");
    }
    for await (const ev of provider.stream({
      model: version.providerModel,
      adapter: version.adapterName,
      messages,
      temperature: 0.2,
      maxTokens,
      signal: input.signal,
      firstTokenTimeoutMs: 120_000,
      // Stay inside a 300 s serverless function.
      totalTimeoutMs: 270_000,
    })) {
      if (ev.type === "delta") yield* handle(parser.push(ev.text));
      else if (ev.type === "done") usage = ev.result.usage;
    }
    yield* handle(parser.end());
  } catch (err) {
    yield* handle(parser.end());
    if (input.signal.aborted || (err instanceof ProviderError && err.code === "cancelled")) {
      status = "cancelled";
    } else {
      status = "error";
      failure = mapError(err);
      log.warn("studio.generation_failed", { requestId: ctx.requestId, code: failure.code, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // A version is created only from a complete answer that changed something.
  let next: AppFiles | null = null;
  if (status === "complete" && (changed.size || deleted.size)) {
    next = { ...files };
    for (const p of deleted) delete next[p];
    for (const [p, c] of changed) next[p] = c;
    try {
      checkFiles(next);
    } catch (err) {
      status = "error";
      failure = { code: "VALIDATION_FAILED", message: (err as Error).message };
      next = null;
    }
  }

  const summary = explanation.trim() || (changed.size ? `Updated ${[...changed.keys()].join(", ")}` : "");
  const content =
    status === "error"
      ? `${summary}${summary ? "\n\n" : ""}⚠ ${failure!.message}`.slice(0, 100_000)
      : (summary || (status === "cancelled" ? "" : "No files were changed.")).slice(0, 100_000);
  const latencyMs = Date.now() - started;

  const saved = await withUser(ctx.userId, async (db) => {
    const v = next ? await insertVersion(db, ctx.userId, prep.project.id, next, { summary, source: "ai", modelVersionId: version.id }) : null;
    const am = await db.query(
      `INSERT INTO ai_app_messages (project_id, owner_id, role, content, status, version_id) VALUES ($1, $2, 'assistant', $3, $4, $5) RETURNING *`,
      [prep.project.id, ctx.userId, content, status, v?.id ?? null],
    );
    await db.query(
      `INSERT INTO ai_usage_events (owner_id, workspace_id, model_profile_id, model_version_id, operation, provider_type,
                                    input_tokens, output_tokens, usage_source, latency_ms, request_id)
       VALUES ($1, $2, $3, $4, 'chat', $5, $6, $7, $8, $9, $10)`,
      [ctx.userId, ctx.workspaceId, profile.id, version.id, record.providerType, usage.inputTokens || inputTokens, usage.outputTokens, usage.source, latencyMs, ctx.requestId],
    );
    return { version: v, message: messageFromRow(am.rows[0]) };
  });

  if (status === "error") {
    yield { type: "error", code: failure!.code, message: failure!.message };
    return;
  }
  yield {
    type: "done",
    message: saved.message,
    version: saved.version,
    previewUrl: saved.version && next ? previewUrl(ctx.userId, saved.version.id, next) : null,
    changed: [...changed.keys()],
    deleted: [...deleted],
    usage,
  };
}
