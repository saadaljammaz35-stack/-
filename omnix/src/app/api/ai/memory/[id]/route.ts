import { memoryUpdateSchema } from "@/lib/api/schemas";
import { audit } from "@/lib/audit";
import { deleteMemory, updateMemory } from "@/lib/ai/memory/memory";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const PATCH = route.auth({ sessionOnly: true, body: memoryUpdateSchema }, async ({ auth, params, body }) =>
  withUser(auth.userId, async (db) => ({ memory: await updateMemory(db, auth, parseId(params.id, "Memory"), body.content) })),
);

export const DELETE = route.auth({ sessionOnly: true }, async ({ auth, params, requestId, ip }) => {
  const id = parseId(params.id, "Memory");
  return withUser(auth.userId, async (db) => {
    await deleteMemory(db, auth, id);
    await audit(db, { ...auth, requestId, ip }, "memory.deleted", "memory", id);
    return { ok: true };
  });
});
