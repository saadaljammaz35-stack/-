import { datasetCreateSchema } from "@/lib/api/schemas";
import { audit } from "@/lib/audit";
import { datasetFromRow } from "@/lib/ai/training/datasets";
import { withUser } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth }) =>
  withUser(auth.userId, async (db) => {
    const r = await db.query("SELECT * FROM ai_datasets WHERE owner_id = $1 AND workspace_id = $2 AND status <> 'archived' ORDER BY created_at DESC", [auth.userId, auth.workspaceId]);
    return { datasets: r.rows.map(datasetFromRow) };
  }),
);

export const POST = route.auth({ sessionOnly: true, body: datasetCreateSchema }, async ({ auth, body, requestId, ip }) =>
  withUser(auth.userId, async (db) => {
    const r = await db.query(
      `INSERT INTO ai_datasets (owner_id, workspace_id, name, description, dataset_type) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [auth.userId, auth.workspaceId, body.name, body.description, body.datasetType],
    );
    await audit(db, { ...auth, requestId, ip }, "dataset.created", "dataset", r.rows[0].id);
    return json({ dataset: datasetFromRow(r.rows[0]) }, { status: 201 });
  }),
);
