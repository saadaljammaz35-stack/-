import { createVersionSchema } from "@/lib/api/schemas";
import { createVersion, getProfile, listVersions } from "@/lib/ai/models/service";
import { withUser } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { json, parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ scope: "models:read" }, async ({ auth, url }) => {
  const id = url.searchParams.get("modelProfileId");
  if (!id) throw new AppError("VALIDATION_FAILED", "modelProfileId is required");
  const profileId = parseId(id, "Model");
  return withUser(auth.userId, async (db) => {
    await getProfile(db, profileId);
    const versions = await listVersions(db, profileId);
    const evals = await db.query(
      `SELECT DISTINCT ON (model_version_id) model_version_id, id, status, score, passed_count, total_count, skipped_count, completed_at
         FROM ai_evaluation_runs WHERE model_version_id = ANY($1::uuid[]) AND evaluation_type = 'full'
        ORDER BY model_version_id, created_at DESC`,
      [versions.map((v) => v.id)],
    );
    const byVersion = new Map(evals.rows.map((e) => [e.model_version_id, e]));
    return { versions: versions.map((v) => ({ ...v, latestEvaluation: byVersion.get(v.id) ?? null })) };
  });
});

export const POST = route.auth({ sessionOnly: true, body: createVersionSchema }, async ({ auth, body, requestId, ip }) =>
  json(await withUser(auth.userId, (db) => createVersion(db, { ...auth, requestId, ip }, body.modelProfileId, body)), { status: 201 }),
);
