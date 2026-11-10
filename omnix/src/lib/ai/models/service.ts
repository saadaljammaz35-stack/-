import "server-only";
import { audit } from "@/lib/audit";
import type { AuthContext, ReqCtx } from "@/lib/auth/session";
import type { Db } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { log } from "@/lib/log";
import {
  FIRST_VERSION,
  MODEL_FAMILY,
  profileFromRow,
  slugify,
  type ModelProfile,
  type ProfileFields,
} from "../identity/model-config";
import { defaultBaseSelection, loadProvider, syncPlatformProviders } from "../providers/registry";

export const MODEL_ROLES = ["default", "coding", "reasoning", "arabic", "personal_assistant"] as const;
export type ModelRole = (typeof MODEL_ROLES)[number];

export interface ModelVersion {
  id: string;
  modelProfileId: string;
  version: string;
  baseModel: string;
  baseModelRevision: string | null;
  providerId: string;
  providerModel: string;
  adapterPath: string | null;
  adapterName: string | null;
  trainingJobId: string | null;
  status: "draft" | "ready" | "deployed" | "retired" | "failed";
  evaluationStatus: "not_evaluated" | "running" | "passed" | "failed";
  notes: string | null;
  createdAt: string;
  deployedAt: string | null;
}

export function versionFromRow(r: Record<string, unknown>): ModelVersion {
  return {
    id: r.id as string,
    modelProfileId: r.model_profile_id as string,
    version: r.version as string,
    baseModel: r.base_model as string,
    baseModelRevision: (r.base_model_revision as string | null) ?? null,
    providerId: r.provider_id as string,
    providerModel: r.provider_model as string,
    adapterPath: (r.adapter_path as string | null) ?? null,
    adapterName: (r.adapter_name as string | null) ?? null,
    trainingJobId: (r.training_job_id as string | null) ?? null,
    status: r.status as ModelVersion["status"],
    evaluationStatus: r.evaluation_status as ModelVersion["evaluationStatus"],
    notes: (r.notes as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    deployedAt: r.deployed_at ? new Date(r.deployed_at as string).toISOString() : null,
  };
}

function profileParams(f: Partial<ProfileFields>) {
  return {
    display_name: f.displayName,
    description: f.description,
    default_language: f.defaultLanguage,
    personality: f.personality,
    system_prompt: f.systemPrompt,
    temperature: f.temperature,
    precision_mode: f.precisionMode,
    response_length: f.responseLength,
    max_output_tokens: f.maxOutputTokens,
    knowledge_mode: f.knowledgeMode,
    memory_enabled: f.memoryEnabled,
    max_tool_calls: f.maxToolCalls,
    configuration: f.configuration,
    slug: f.slug,
  };
}

export async function createProfile(
  db: Db,
  ctx: ReqCtx,
  fields: ProfileFields,
): Promise<{ profile: ModelProfile; version: ModelVersion }> {
  const base = await defaultBaseSelection(db);
  const slug = fields.slug ?? slugify(fields.displayName);
  const p = profileParams({ ...fields, slug });
  const r = await db.query(
    `INSERT INTO ai_model_profiles
       (owner_id, workspace_id, display_name, slug, description, model_family, default_language, personality, system_prompt,
        temperature, precision_mode, response_length, max_output_tokens, knowledge_mode, memory_enabled, max_tool_calls, configuration)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
    [
      ctx.userId, ctx.workspaceId, p.display_name, p.slug, p.description, MODEL_FAMILY, p.default_language, p.personality,
      p.system_prompt, p.temperature, p.precision_mode, p.response_length, p.max_output_tokens, p.knowledge_mode,
      p.memory_enabled, p.max_tool_calls, p.configuration,
    ],
  );
  const profile = profileFromRow(r.rows[0]);
  const v = await db.query(
    `INSERT INTO ai_model_versions
       (model_profile_id, owner_id, version, base_model, provider_id, provider_model, model_config, status, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', $8, $2) RETURNING *`,
    [
      profile.id, ctx.userId, FIRST_VERSION, base.baseModel, base.providerId, base.providerModel, identitySnapshot(profile),
      `Base model ${base.baseModel} via ${base.providerType}; not fine-tuned.`,
    ],
  );
  // The first model in a workspace becomes the user's default role automatically.
  await db.query(
    `INSERT INTO ai_model_roles (workspace_id, owner_id, role, model_profile_id) VALUES ($1, $2, 'default', $3)
     ON CONFLICT (workspace_id, owner_id, role) DO NOTHING`,
    [ctx.workspaceId, ctx.userId, profile.id],
  );
  await audit(db, ctx, "model.created", "model_profile", profile.id, { slug: profile.slug, baseModel: base.baseModel });
  return { profile, version: versionFromRow(v.rows[0]) };
}

export function identitySnapshot(p: ModelProfile): Record<string, unknown> {
  return {
    displayName: p.displayName,
    defaultLanguage: p.defaultLanguage,
    temperature: p.temperature,
    precisionMode: p.precisionMode,
    responseLength: p.responseLength,
    maxOutputTokens: p.maxOutputTokens,
    knowledgeMode: p.knowledgeMode,
    memoryEnabled: p.memoryEnabled,
    systemPromptChars: p.systemPrompt.length,
  };
}

export async function updateProfile(db: Db, ctx: ReqCtx, id: string, fields: Partial<ProfileFields>): Promise<ModelProfile> {
  const p = profileParams(fields);
  const sets: string[] = [];
  const vals: unknown[] = [id];
  for (const [col, val] of Object.entries(p)) {
    if (val === undefined) continue;
    vals.push(val);
    sets.push(`${col} = $${vals.length}`);
  }
  if (!sets.length) return getProfile(db, id);
  const r = await db.query(`UPDATE ai_model_profiles SET ${sets.join(", ")} WHERE id = $1 RETURNING *`, vals);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "Model not found");
  await audit(db, ctx, "model.updated", "model_profile", id, { fields: Object.keys(fields) });
  return profileFromRow(r.rows[0]);
}

export async function getProfile(db: Db, id: string): Promise<ModelProfile> {
  const r = await db.query("SELECT * FROM ai_model_profiles WHERE id = $1", [id]);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "Model not found");
  return profileFromRow(r.rows[0]);
}

export async function listProfiles(db: Db, workspaceId: string): Promise<ModelProfile[]> {
  const r = await db.query("SELECT * FROM ai_model_profiles WHERE workspace_id = $1 AND status = 'active' ORDER BY created_at", [workspaceId]);
  return r.rows.map(profileFromRow);
}

export async function listVersions(db: Db, profileId: string): Promise<ModelVersion[]> {
  const r = await db.query("SELECT * FROM ai_model_versions WHERE model_profile_id = $1 ORDER BY created_at DESC", [profileId]);
  return r.rows.map(versionFromRow);
}

export async function getVersion(db: Db, versionId: string): Promise<ModelVersion> {
  const r = await db.query("SELECT * FROM ai_model_versions WHERE id = $1", [versionId]);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "Model version not found");
  return versionFromRow(r.rows[0]);
}

export function bumpVersion(v: string, part: "major" | "minor" | "patch"): string {
  const [a, b, c] = v.split(".").map(Number) as [number, number, number];
  if (part === "major") return `${a + 1}.0.0`;
  if (part === "minor") return `${a}.${b + 1}.0`;
  return `${a}.${b}.${c + 1}`;
}

/** New version on a different base model / provider (no training). */
export async function createVersion(
  db: Db,
  ctx: ReqCtx,
  profileId: string,
  input: { baseModel: string; providerId: string; providerModel: string; baseModelRevision?: string | null; bump: "major" | "minor" | "patch"; notes?: string },
): Promise<ModelVersion> {
  const profile = await getProfile(db, profileId);
  await syncPlatformProviders(db);
  const prov = await db.query("SELECT id FROM ai_model_providers WHERE id = $1", [input.providerId]);
  if (!prov.rowCount) throw new AppError("NOT_FOUND", "Model provider not found");
  const latest = await db.query<{ version: string }>(
    `SELECT version FROM ai_model_versions WHERE model_profile_id = $1
      ORDER BY string_to_array(version, '.')::int[] DESC LIMIT 1`,
    [profileId],
  );
  const next = bumpVersion(latest.rows[0]?.version ?? "0.0.0", input.bump);
  const r = await db.query(
    `INSERT INTO ai_model_versions
       (model_profile_id, owner_id, version, base_model, base_model_revision, provider_id, provider_model, model_config, status, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ready', $9, $2) RETURNING *`,
    [profileId, ctx.userId, next, input.baseModel, input.baseModelRevision ?? null, input.providerId, input.providerModel, identitySnapshot(profile), input.notes ?? null],
  );
  await audit(db, ctx, "model.version_created", "model_version", r.rows[0].id, { version: next, baseModel: input.baseModel });
  return versionFromRow(r.rows[0]);
}

/**
 * Deploys a version. The database refuses unless a full evaluation run for
 * this version passed (omnix_enforce_deploy_gate). The previously deployed
 * version returns to 'ready' so it can be rolled back to.
 */
export async function deployVersion(db: Db, ctx: ReqCtx, profileId: string, versionId: string): Promise<ModelVersion> {
  const target = await getVersion(db, versionId);
  if (target.modelProfileId !== profileId) throw new AppError("NOT_FOUND", "Model version not found");
  if (target.status === "deployed") return target;
  if (target.status === "failed" || target.status === "retired") {
    throw new AppError("PRECONDITION_FAILED", `A ${target.status} version cannot be deployed`);
  }
  const prev = await db.query("UPDATE ai_model_versions SET status = 'ready' WHERE model_profile_id = $1 AND status = 'deployed' RETURNING id, version", [profileId]);
  const r = await db.query("UPDATE ai_model_versions SET status = 'deployed' WHERE id = $1 RETURNING *", [versionId]);
  const deployed = versionFromRow(r.rows[0]);
  if (deployed.adapterName && deployed.adapterPath) {
    const { provider } = await loadProvider(db, deployed.providerId);
    const caps = await provider.getCapabilities(deployed.providerModel);
    if (caps.loraAdapters) {
      await provider.loadModel(deployed.providerModel, { adapterName: deployed.adapterName, adapterPath: deployed.adapterPath });
    } else {
      log.warn("deploy.adapter_not_loadable", { versionId, provider: provider.name });
    }
  }
  await audit(db, ctx, "model.version_deployed", "model_version", versionId, {
    version: deployed.version,
    replaced: prev.rows[0]?.version ?? null,
  });
  return deployed;
}

export async function undeploy(db: Db, ctx: ReqCtx, profileId: string): Promise<void> {
  const r = await db.query("UPDATE ai_model_versions SET status = 'ready' WHERE model_profile_id = $1 AND status = 'deployed' RETURNING id, version", [profileId]);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "No deployed version");
  await audit(db, ctx, "model.version_undeployed", "model_version", r.rows[0].id, { version: r.rows[0].version });
}

export interface ResolvedModel {
  profile: ModelProfile;
  version: ModelVersion;
  /** True when no deployed version exists and the newest ready version is used (owner preview). */
  preview: boolean;
  role: ModelRole | null;
  roleOverride: { temperature: number | null; maxOutputTokens: number | null; responseLength: ModelProfile["responseLength"] | null } | null;
}

/**
 * Picks the profile and version for a request:
 *   explicit version → role-pinned version → deployed version → newest ready version (preview).
 * API keys may only use deployed (or role-pinned deployed) versions.
 */
export async function resolveModel(
  db: Db,
  ctx: AuthContext,
  req: { modelProfileId?: string; modelVersionId?: string; role?: ModelRole },
): Promise<ResolvedModel> {
  let profileId = req.modelProfileId;
  let pinned: string | null = null;
  let roleOverride: ResolvedModel["roleOverride"] = null;
  const role = req.role ?? (profileId ? null : "default");
  if (!profileId && role) {
    const rr = await db.query(
      "SELECT * FROM ai_model_roles WHERE workspace_id = $1 AND owner_id = $2 AND role = $3",
      [ctx.workspaceId, ctx.userId, role],
    );
    const row = rr.rows[0];
    if (!row) {
      throw new AppError("NOT_FOUND", role === "default" ? "Create your personal model first" : `No model is assigned to the '${role}' role`);
    }
    profileId = row.model_profile_id as string;
    pinned = (row.model_version_id as string | null) ?? null;
    roleOverride = {
      temperature: row.temperature === null ? null : Number(row.temperature),
      maxOutputTokens: row.max_output_tokens === null ? null : Number(row.max_output_tokens),
      responseLength: row.response_length ?? null,
    };
  }
  const profile = await getProfile(db, profileId!);
  if (profile.workspaceId !== ctx.workspaceId) throw new AppError("NOT_FOUND", "Model not found");
  if (profile.status !== "active") throw new AppError("PRECONDITION_FAILED", "This model is archived");

  const wanted = req.modelVersionId ?? pinned;
  let version: ModelVersion | null = null;
  if (wanted) {
    version = await getVersion(db, wanted);
    if (version.modelProfileId !== profile.id) throw new AppError("NOT_FOUND", "Model version not found");
  } else {
    const r = await db.query(
      `SELECT * FROM ai_model_versions WHERE model_profile_id = $1 AND status IN ('deployed', 'ready')
        ORDER BY (status = 'deployed') DESC, string_to_array(version, '.')::int[] DESC LIMIT 1`,
      [profile.id],
    );
    version = r.rows[0] ? versionFromRow(r.rows[0]) : null;
  }
  if (!version) throw new AppError("PRECONDITION_FAILED", "This model has no usable version");
  if (!["deployed", "ready"].includes(version.status)) throw new AppError("PRECONDITION_FAILED", `Version ${version.version} is ${version.status}`);
  if (ctx.via === "api_key" && version.status !== "deployed") {
    throw new AppError("PRECONDITION_FAILED", "External API access requires a deployed version (evaluate and deploy one first)");
  }
  return { profile, version, preview: version.status !== "deployed", role: role ?? null, roleOverride };
}

export async function setRole(
  db: Db,
  ctx: ReqCtx,
  role: ModelRole,
  input: { modelProfileId: string; modelVersionId?: string | null; temperature?: number | null; maxOutputTokens?: number | null; responseLength?: ModelProfile["responseLength"] | null },
): Promise<void> {
  const profile = await getProfile(db, input.modelProfileId);
  if (profile.workspaceId !== ctx.workspaceId) throw new AppError("NOT_FOUND", "Model not found");
  if (input.modelVersionId) {
    const v = await getVersion(db, input.modelVersionId);
    if (v.modelProfileId !== profile.id) throw new AppError("NOT_FOUND", "Model version not found");
  }
  await db.query(
    `INSERT INTO ai_model_roles (workspace_id, owner_id, role, model_profile_id, model_version_id, temperature, max_output_tokens, response_length)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (workspace_id, owner_id, role) DO UPDATE
       SET model_profile_id = EXCLUDED.model_profile_id, model_version_id = EXCLUDED.model_version_id,
           temperature = EXCLUDED.temperature, max_output_tokens = EXCLUDED.max_output_tokens, response_length = EXCLUDED.response_length`,
    [ctx.workspaceId, ctx.userId, role, profile.id, input.modelVersionId ?? null, input.temperature ?? null, input.maxOutputTokens ?? null, input.responseLength ?? null],
  );
  await audit(db, ctx, "model.role_assigned", "model_profile", profile.id, { role });
}

export async function listRoles(db: Db, ctx: AuthContext) {
  const r = await db.query(
    `SELECT r.*, p.display_name, v.version FROM ai_model_roles r
       JOIN ai_model_profiles p ON p.id = r.model_profile_id
       LEFT JOIN ai_model_versions v ON v.id = r.model_version_id
      WHERE r.workspace_id = $1 AND r.owner_id = $2 ORDER BY r.role`,
    [ctx.workspaceId, ctx.userId],
  );
  return r.rows.map((x) => ({
    role: x.role as ModelRole,
    modelProfileId: x.model_profile_id as string,
    displayName: x.display_name as string,
    modelVersionId: (x.model_version_id as string | null) ?? null,
    pinnedVersion: (x.version as string | null) ?? null,
    temperature: x.temperature === null ? null : Number(x.temperature),
    maxOutputTokens: x.max_output_tokens ?? null,
    responseLength: x.response_length ?? null,
  }));
}
