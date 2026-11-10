import { z } from "zod";
import { audit } from "@/lib/audit";
import { withUser } from "@/lib/db/pool";
import { notFound } from "@/lib/http/errors";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ scope: "chat" }, async ({ auth, params }) => {
  const id = parseId(params.id, "Conversation");
  return withUser(auth.userId, async (db) => {
    const c = await db.query("SELECT * FROM ai_conversations WHERE id = $1 AND workspace_id = $2", [id, auth.workspaceId]);
    if (!c.rowCount) throw notFound("Conversation");
    const m = await db.query(
      `SELECT m.id, m.role, m.content, m.status, m.sources, m.usage_metadata, m.rating, m.parent_message_id, m.created_at,
              v.version AS model_version
         FROM ai_messages m LEFT JOIN ai_model_versions v ON v.id = m.model_version_id
        WHERE m.conversation_id = $1 ORDER BY m.created_at`,
      [id],
    );
    return {
      conversation: { id, title: c.rows[0].title, modelProfileId: c.rows[0].model_profile_id, createdAt: c.rows[0].created_at, updatedAt: c.rows[0].updated_at },
      messages: m.rows.map((r) => ({
        id: r.id, role: r.role, content: r.content, status: r.status, sources: r.sources, usage: r.usage_metadata,
        rating: r.rating, parentMessageId: r.parent_message_id, modelVersion: r.model_version, createdAt: r.created_at,
      })),
    };
  });
});

export const PATCH = route.auth(
  { scope: "chat", body: z.object({ title: z.string().trim().min(1).max(200).optional(), archived: z.boolean().optional() }).strict() },
  async ({ auth, params, body }) => {
    const id = parseId(params.id, "Conversation");
    return withUser(auth.userId, async (db) => {
      const r = await db.query(
        `UPDATE ai_conversations SET title = COALESCE($2, title),
                archived_at = CASE WHEN $3::boolean IS NULL THEN archived_at WHEN $3 THEN now() ELSE NULL END
          WHERE id = $1 RETURNING id`,
        [id, body.title ?? null, body.archived ?? null],
      );
      if (!r.rowCount) throw notFound("Conversation");
      return { ok: true };
    });
  },
);

export const DELETE = route.auth({ scope: "chat" }, async ({ auth, params, requestId, ip }) => {
  const id = parseId(params.id, "Conversation");
  return withUser(auth.userId, async (db) => {
    const r = await db.query("DELETE FROM ai_conversations WHERE id = $1 RETURNING id", [id]);
    if (!r.rowCount) throw notFound("Conversation");
    await audit(db, { ...auth, requestId, ip }, "conversation.deleted", "conversation", id);
    return { ok: true };
  });
});
