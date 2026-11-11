import { evaluationSchema } from "@/lib/api/schemas";
import { audit } from "@/lib/audit";
import { createRun, runEvaluation } from "@/lib/ai/eval/runner";
import { withUser } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";
import { runInBackground } from "@/lib/jobs/background";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth, url }) => {
  const vid = url.searchParams.get("modelVersionId");
  return withUser(auth.userId, async (db) => {
    const r = await db.query(
      `SELECT r.id, r.model_version_id, r.evaluation_type, r.suite_version, r.status, r.total_count, r.passed_count, r.skipped_count, r.score,
              r.results, r.error, r.created_at, r.completed_at, v.version, p.display_name
         FROM ai_evaluation_runs r JOIN ai_model_versions v ON v.id = r.model_version_id JOIN ai_model_profiles p ON p.id = v.model_profile_id
        WHERE r.owner_id = $1 AND ($2::uuid IS NULL OR r.model_version_id = $2) ORDER BY r.created_at DESC LIMIT 100`,
      [auth.userId, vid && /^[0-9a-f-]{36}$/.test(vid) ? vid : null],
    );
    return { runs: r.rows };
  });
});

/** Starts an evaluation run (202). Progress is visible as cases are recorded. */
export const POST = route.auth(
  { sessionOnly: true, body: evaluationSchema, rateLimit: { name: "evaluation", limit: 20, windowSec: 3600 } },
  async ({ auth, body, requestId, ip }) => {
    const run = await withUser(auth.userId, async (db) => {
      const r = await createRun(db, auth, body.modelVersionId, body.evaluationType);
      await audit(db, { ...auth, requestId, ip }, "evaluation.started", "model_version", body.modelVersionId, { type: body.evaluationType });
      return r;
    });
    await runInBackground("evaluation.run", () => runEvaluation(auth.userId, run.id));
    return json({ run }, { status: 202 });
  },
);
