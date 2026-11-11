import { appUpdateSchema } from "@/lib/api/schemas";
import { deleteProject, projectDetail, updateProject } from "@/lib/ai/studio/studio";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth, params }) => {
  const id = parseId(params.id, "App");
  return withUser(auth.userId, (db) => projectDetail(db, auth.userId, id));
});

export const PATCH = route.auth({ sessionOnly: true, body: appUpdateSchema }, async ({ auth, params, body }) => {
  const id = parseId(params.id, "App");
  return { app: await withUser(auth.userId, (db) => updateProject(db, id, body)) };
});

export const DELETE = route.auth({ sessionOnly: true }, async ({ auth, params, requestId, ip }) => {
  const id = parseId(params.id, "App");
  await withUser(auth.userId, (db) => deleteProject(db, { ...auth, requestId, ip }, id));
  return { ok: true };
});
