import { knowledgeUpdateSchema } from "@/lib/api/schemas";
import { audit } from "@/lib/audit";
import { deleteDocument, documentFromRow } from "@/lib/ai/rag/knowledge";
import { withUser } from "@/lib/db/pool";
import { notFound } from "@/lib/http/errors";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ scope: "knowledge:read" }, async ({ auth, params }) => {
  const id = parseId(params.id, "Document");
  return withUser(auth.userId, async (db) => {
    const d = await db.query("SELECT * FROM ai_knowledge_documents WHERE id = $1 AND workspace_id = $2", [id, auth.workspaceId]);
    if (!d.rowCount) throw notFound("Document");
    const chunks = await db.query(
      "SELECT chunk_index, content, token_count, metadata FROM ai_knowledge_chunks WHERE document_id = $1 ORDER BY chunk_index LIMIT 200",
      [id],
    );
    return { document: documentFromRow(d.rows[0]), chunks: chunks.rows };
  });
});

export const PATCH = route.auth({ scope: "knowledge:write", body: knowledgeUpdateSchema }, async ({ auth, params, body, requestId, ip }) => {
  const id = parseId(params.id, "Document");
  return withUser(auth.userId, async (db) => {
    const r = await db.query(
      `UPDATE ai_knowledge_documents
          SET title = COALESCE($2, title),
              category = CASE WHEN $3::boolean THEN $4 ELSE category END,
              tags = COALESCE($5, tags)
        WHERE id = $1 AND workspace_id = $6 RETURNING *`,
      [id, body.title ?? null, body.category !== undefined, body.category ?? null, body.tags?.map((t) => t.toLowerCase()) ?? null, auth.workspaceId],
    );
    if (!r.rowCount) throw notFound("Document");
    await audit(db, { ...auth, requestId, ip }, "knowledge.document_updated", "knowledge_document", id);
    return { document: documentFromRow(r.rows[0]) };
  });
});

export const DELETE = route.auth({ scope: "knowledge:write" }, async ({ auth, params, requestId, ip }) => {
  await deleteDocument({ ...auth, requestId, ip }, parseId(params.id, "Document"));
  return { ok: true };
});
