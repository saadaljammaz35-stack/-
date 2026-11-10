import { datasetItemsSchema } from "@/lib/api/schemas";
import { addItems, getDataset } from "@/lib/ai/training/datasets";
import { withUser } from "@/lib/db/pool";
import { json, parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Review items, optionally filtered by validation status or split. */
export const GET = route.auth({ sessionOnly: true }, async ({ auth, params, url }) => {
  const id = parseId(params.id, "Dataset");
  const status = url.searchParams.get("status");
  const split = url.searchParams.get("split");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
  return withUser(auth.userId, async (db) => {
    await getDataset(db, id);
    const r = await db.query(
      `SELECT id, content, source, validation_status, validation_errors, split, created_at FROM ai_dataset_items
        WHERE dataset_id = $1 AND ($2::text IS NULL OR validation_status = $2) AND ($3::text IS NULL OR split = $3)
        ORDER BY created_at, id LIMIT $4 OFFSET $5`,
      [id, status, split, limit, offset],
    );
    return { items: r.rows };
  });
});

export const POST = route.auth({ sessionOnly: true, body: datasetItemsSchema, maxBodyBytes: 8 * 1024 * 1024 }, async ({ auth, params, body }) => {
  const id = parseId(params.id, "Dataset");
  return withUser(auth.userId, async (db) => json({ added: await addItems(db, id, body.items, "manual") }, { status: 201 }));
});
