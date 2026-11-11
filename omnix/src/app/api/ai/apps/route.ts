import { appCreateSchema } from "@/lib/api/schemas";
import { createProject, listProjects } from "@/lib/ai/studio/studio";
import { withUser } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth }) =>
  withUser(auth.userId, async (db) => ({ apps: await listProjects(db, auth.workspaceId) })),
);

export const POST = route.auth(
  { sessionOnly: true, body: appCreateSchema, rateLimit: { name: "app-create", limit: 30, windowSec: 3600 } },
  async ({ auth, body, requestId, ip }) =>
    json({ app: await withUser(auth.userId, (db) => createProject(db, { ...auth, requestId, ip }, body)) }, { status: 201 }),
);
