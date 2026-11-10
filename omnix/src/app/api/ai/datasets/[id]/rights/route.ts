import { datasetRightsSchema } from "@/lib/api/schemas";
import { audit } from "@/lib/audit";
import { datasetFromRow, getDataset } from "@/lib/ai/training/datasets";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

/** The owner records that they have the right to train on this data. Required before any training job. */
export const POST = route.auth({ sessionOnly: true, body: datasetRightsSchema }, async ({ auth, params, body, requestId, ip }) => {
  const id = parseId(params.id, "Dataset");
  return withUser(auth.userId, async (db) => {
    await getDataset(db, id);
    const r = await db.query("UPDATE ai_datasets SET rights_statement = $2, rights_confirmed_at = now() WHERE id = $1 RETURNING *", [id, body.statement]);
    await audit(db, { ...auth, requestId, ip }, "dataset.rights_confirmed", "dataset", id, { statement: body.statement });
    return { dataset: datasetFromRow(r.rows[0]) };
  });
});
