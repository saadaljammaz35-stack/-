import { trainingJobSchema } from "@/lib/api/schemas";
import { createTrainingJob, jobFromRow } from "@/lib/ai/training/jobs";
import { withUser } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth }) =>
  withUser(auth.userId, async (db) => {
    const r = await db.query("SELECT * FROM ai_training_jobs WHERE owner_id = $1 AND workspace_id = $2 ORDER BY created_at DESC LIMIT 100", [auth.userId, auth.workspaceId]);
    return { jobs: r.rows.map(jobFromRow) };
  }),
);

/** Queues a LoRA/QLoRA job for the Python worker. The response says plainly if no GPU worker is online. */
export const POST = route.auth(
  { sessionOnly: true, body: trainingJobSchema, rateLimit: { name: "training-create", limit: 20, windowSec: 3600 } },
  async ({ auth, body, requestId, ip }) => json(await withUser(auth.userId, (db) => createTrainingJob(db, { ...auth, requestId, ip }, body)), { status: 201 }),
);
