import { roleAssignSchema } from "@/lib/api/schemas";
import { listRoles, MODEL_ROLES, setRole } from "@/lib/ai/models/service";
import { withUser } from "@/lib/db/pool";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ scope: "models:read" }, async ({ auth }) =>
  withUser(auth.userId, async (db) => ({ roles: MODEL_ROLES, assignments: await listRoles(db, auth) })),
);

export const PUT = route.auth({ sessionOnly: true, body: roleAssignSchema }, async ({ auth, body, requestId, ip }) =>
  withUser(auth.userId, async (db) => {
    await setRole(db, { ...auth, requestId, ip }, body.role, body);
    return { assignments: await listRoles(db, auth) };
  }),
);
