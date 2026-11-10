import { getInfrastructure } from "@/lib/ai/training/jobs";
import { withUser } from "@/lib/db/pool";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Online training workers and their GPUs, from worker heartbeats. */
export const GET = route.auth({ sessionOnly: true }, async ({ auth }) => withUser(auth.userId, (db) => getInfrastructure(db)));
