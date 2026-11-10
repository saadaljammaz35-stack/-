import { updateModelSchema } from "@/lib/api/schemas";
import { getProfile, listVersions, updateProfile } from "@/lib/ai/models/service";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ scope: "models:read" }, async ({ auth, params }) => {
  const id = parseId(params.id, "Model");
  return withUser(auth.userId, async (db) => ({ model: await getProfile(db, id), versions: await listVersions(db, id) }));
});

export const PATCH = route.auth({ sessionOnly: true, body: updateModelSchema }, async ({ auth, params, body, requestId, ip }) => {
  const id = parseId(params.id, "Model");
  return withUser(auth.userId, async (db) => ({ model: await updateProfile(db, { ...auth, requestId, ip }, id, body) }));
});
