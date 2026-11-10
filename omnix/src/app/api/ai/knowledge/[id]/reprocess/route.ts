import { processDocument } from "@/lib/ai/rag/knowledge";
import { withUser } from "@/lib/db/pool";
import { notFound } from "@/lib/http/errors";
import { parseId, route } from "@/lib/http/route";
import { runInBackground } from "@/lib/jobs/background";

export const runtime = "nodejs";

export const POST = route.auth({ scope: "knowledge:write" }, async ({ auth, params }) => {
  const id = parseId(params.id, "Document");
  await withUser(auth.userId, async (db) => {
    const r = await db.query(
      "UPDATE ai_knowledge_documents SET processing_status = 'pending' WHERE id = $1 AND processing_status IN ('ready', 'failed') RETURNING id",
      [id],
    );
    if (!r.rowCount) throw notFound("Document");
  });
  await runInBackground("knowledge.process", () => processDocument(auth.userId, id));
  return { queued: true };
});
