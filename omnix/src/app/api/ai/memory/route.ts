import { memoryCreateSchema } from "@/lib/api/schemas";
import { audit } from "@/lib/audit";
import { listMemories, saveMemory } from "@/lib/ai/memory/memory";
import { withUser } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth }) =>
  withUser(auth.userId, async (db) => ({ memories: await listMemories(db, auth) })),
);

/** Save a memory explicitly (or approve a suggestion). Secrets and identifiers are refused. */
export const POST = route.auth({ sessionOnly: true, body: memoryCreateSchema }, async ({ auth, body, requestId, ip }) =>
  withUser(auth.userId, async (db) => {
    const m = await saveMemory(db, auth, body);
    await audit(db, { ...auth, requestId, ip }, "memory.saved", "memory", m.id, { kind: m.kind, source: m.source });
    return json({ memory: m }, { status: 201 });
  }),
);
