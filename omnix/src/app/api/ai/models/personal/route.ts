import { createModelSchema } from "@/lib/api/schemas";
import { createProfile, listProfiles, listVersions } from "@/lib/ai/models/service";
import { withUser } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ scope: "models:read" }, async ({ auth }) =>
  withUser(auth.userId, async (db) => {
    const profiles = await listProfiles(db, auth.workspaceId);
    const withVersions = await Promise.all(profiles.map(async (p) => ({ ...p, versions: await listVersions(db, p.id) })));
    return { models: withVersions };
  }),
);

export const POST = route.auth(
  { sessionOnly: true, body: createModelSchema, rateLimit: { name: "model-create", limit: 20, windowSec: 3600 } },
  async ({ auth, body, requestId, ip }) =>
    json(await withUser(auth.userId, (db) => createProfile(db, { ...auth, requestId, ip }, body)), { status: 201 }),
);
