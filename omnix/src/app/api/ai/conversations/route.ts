import { withUser } from "@/lib/db/pool";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ scope: "chat" }, async ({ auth, url }) => {
  const profileId = url.searchParams.get("modelProfileId");
  const q = url.searchParams.get("q")?.slice(0, 100);
  return withUser(auth.userId, async (db) => {
    const params: unknown[] = [auth.workspaceId];
    let where = "c.workspace_id = $1 AND c.archived_at IS NULL";
    if (profileId && /^[0-9a-f-]{36}$/.test(profileId)) {
      params.push(profileId);
      where += ` AND c.model_profile_id = $${params.length}`;
    }
    if (q) {
      params.push(`%${q.replace(/[%_\\]/g, "\\$&")}%`);
      where += ` AND c.title ILIKE $${params.length}`;
    }
    const r = await db.query(
      `SELECT c.id, c.title, c.model_profile_id, c.created_at, c.updated_at,
              (SELECT count(*) FROM ai_messages m WHERE m.conversation_id = c.id)::int AS message_count
         FROM ai_conversations c WHERE ${where} ORDER BY c.updated_at DESC LIMIT 200`,
      params,
    );
    return {
      conversations: r.rows.map((c) => ({
        id: c.id, title: c.title, modelProfileId: c.model_profile_id, messageCount: c.message_count, createdAt: c.created_at, updatedAt: c.updated_at,
      })),
    };
  });
});
