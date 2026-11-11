import { appRestoreSchema } from "@/lib/api/schemas";
import { restoreVersion } from "@/lib/ai/studio/studio";
import { withUser } from "@/lib/db/pool";
import { json, parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const POST = route.auth({ sessionOnly: true, body: appRestoreSchema }, async ({ auth, params, body }) => {
  const id = parseId(params.id, "App");
  return json({ version: await withUser(auth.userId, (db) => restoreVersion(db, auth, id, body.versionId)) }, { status: 201 });
});
