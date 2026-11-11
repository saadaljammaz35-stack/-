import { appPublishSchema } from "@/lib/api/schemas";
import { publishProject, unpublishProject } from "@/lib/ai/studio/studio";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const POST = route.auth({ sessionOnly: true, body: appPublishSchema }, async ({ auth, params, body, requestId, ip }) => {
  const id = parseId(params.id, "App");
  const app = await withUser(auth.userId, (db) => publishProject(db, { ...auth, requestId, ip }, id, body.versionId));
  return { app, publicPath: `/p/${app.publishedSlug}` };
});

export const DELETE = route.auth({ sessionOnly: true }, async ({ auth, params, requestId, ip }) => {
  const id = parseId(params.id, "App");
  return { app: await withUser(auth.userId, (db) => unpublishProject(db, { ...auth, requestId, ip }, id)) };
});
