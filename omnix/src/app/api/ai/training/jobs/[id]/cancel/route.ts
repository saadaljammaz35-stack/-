import { cancelJob } from "@/lib/ai/training/jobs";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const POST = route.auth({ sessionOnly: true }, async ({ auth, params, requestId, ip }) =>
  withUser(auth.userId, async (db) => ({ job: await cancelJob(db, { ...auth, requestId, ip }, parseId(params.id, "Training job")) })),
);
