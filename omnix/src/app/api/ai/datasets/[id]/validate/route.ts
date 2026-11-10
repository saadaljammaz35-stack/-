import { validateDataset } from "@/lib/ai/training/datasets";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Structure, duplicates, personal/secret data, token lengths, deterministic train/validation/test split. */
export const POST = route.auth({ sessionOnly: true }, async ({ auth, params, requestId, ip }) =>
  withUser(auth.userId, async (db) => ({ dataset: await validateDataset(db, { ...auth, requestId, ip }, parseId(params.id, "Dataset")) })),
);
