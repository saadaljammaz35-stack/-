import { withUser } from "@/lib/db/pool";
import { notFound } from "@/lib/http/errors";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth, params }) => {
  const id = parseId(params.id, "Evaluation run");
  return withUser(auth.userId, async (db) => {
    const r = await db.query("SELECT * FROM ai_evaluation_runs WHERE id = $1", [id]);
    if (!r.rowCount) throw notFound("Evaluation run");
    const cases = await db.query(
      "SELECT case_key, category, input, expected_output, actual_output, score, passed, latency_ms, detail FROM ai_evaluation_cases WHERE evaluation_run_id = $1 ORDER BY created_at",
      [id],
    );
    return { run: r.rows[0], cases: cases.rows };
  });
});
