import { deploySchema } from "@/lib/api/schemas";
import { deployVersion, getProfile, undeploy } from "@/lib/ai/models/service";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Deploy a version. Refused (409 DEPLOY_GATE) unless a full evaluation run for it passed. Owner only. */
export const POST = route.auth({ sessionOnly: true, body: deploySchema }, async ({ auth, params, body, requestId, ip }) => {
  const id = parseId(params.id, "Model");
  return withUser(auth.userId, async (db) => {
    await getProfile(db, id);
    return { version: await deployVersion(db, { ...auth, requestId, ip }, id, body.versionId) };
  });
});

/** Take the deployed version offline (it returns to 'ready' and can be redeployed). */
export const DELETE = route.auth({ sessionOnly: true }, async ({ auth, params, requestId, ip }) => {
  const id = parseId(params.id, "Model");
  return withUser(auth.userId, async (db) => {
    await getProfile(db, id);
    await undeploy(db, { ...auth, requestId, ip }, id);
    return { ok: true };
  });
});
