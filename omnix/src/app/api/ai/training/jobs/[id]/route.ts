import { getJobDetail } from "@/lib/ai/training/jobs";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Job status, metric series (loss, learning rate, GPU) and logs. */
export const GET = route.auth({ sessionOnly: true }, async ({ auth, params }) =>
  withUser(auth.userId, (db) => getJobDetail(db, parseId(params.id, "Training job"))),
);
