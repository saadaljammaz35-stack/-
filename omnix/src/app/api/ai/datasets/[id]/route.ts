import { audit } from "@/lib/audit";
import { getDataset } from "@/lib/ai/training/datasets";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth, params }) =>
  withUser(auth.userId, async (db) => ({ dataset: await getDataset(db, parseId(params.id, "Dataset")) })),
);

/** Archive (kept for the provenance of past training jobs). */
export const DELETE = route.auth({ sessionOnly: true }, async ({ auth, params, requestId, ip }) => {
  const id = parseId(params.id, "Dataset");
  return withUser(auth.userId, async (db) => {
    await getDataset(db, id);
    await db.query("UPDATE ai_datasets SET status = 'archived' WHERE id = $1", [id]);
    await audit(db, { ...auth, requestId, ip }, "dataset.archived", "dataset", id);
    return { ok: true };
  });
});
