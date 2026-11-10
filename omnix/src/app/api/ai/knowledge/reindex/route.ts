import { reindexWorkspace, processDocument } from "@/lib/ai/rag/knowledge";
import { withUser } from "@/lib/db/pool";
import { route } from "@/lib/http/route";
import { runInBackground } from "@/lib/jobs/background";

export const runtime = "nodejs";

/** Re-extract and re-embed every document (e.g. after changing the embedding model). */
export const POST = route.auth({ scope: "knowledge:write" }, async ({ auth, requestId, ip }) => {
  const count = await reindexWorkspace({ ...auth, requestId, ip });
  await runInBackground("knowledge.reindex", async () => {
    const ids = await withUser(auth.userId, (db) =>
      db.query<{ id: string }>("SELECT id FROM ai_knowledge_documents WHERE workspace_id = $1 AND owner_id = $2 AND processing_status = 'pending'", [auth.workspaceId, auth.userId]),
    );
    for (const r of ids.rows) await processDocument(auth.userId, r.id).catch(() => undefined);
  });
  return { queued: count };
});
