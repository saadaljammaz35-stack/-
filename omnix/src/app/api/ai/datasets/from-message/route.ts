import { datasetFromMessageSchema } from "@/lib/api/schemas";
import { addFromConversation, getDataset } from "@/lib/ai/training/datasets";
import { withUser } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Adds a chat answer to a dataset. Requires consent: true — conversations are never training data by default. */
export const POST = route.auth({ sessionOnly: true, body: datasetFromMessageSchema }, async ({ auth, body, requestId, ip }) =>
  withUser(auth.userId, async (db) => {
    await getDataset(db, body.datasetId);
    await addFromConversation(db, { ...auth, requestId, ip }, body.datasetId, body.assistantMessageId);
    return json({ ok: true }, { status: 201 });
  }),
);
