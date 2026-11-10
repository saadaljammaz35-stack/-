import { feedbackSchema } from "@/lib/api/schemas";
import { withUser } from "@/lib/db/pool";
import { notFound } from "@/lib/http/errors";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Thumbs up / down on an answer. Stored on the message; never used for training without explicit consent. */
export const POST = route.auth({ scope: "chat", body: feedbackSchema }, async ({ auth, params, body }) => {
  const id = parseId(params.id, "Message");
  return withUser(auth.userId, async (db) => {
    const r = await db.query(
      "UPDATE ai_messages SET rating = $2, feedback = $3 WHERE id = $1 AND role = 'assistant' RETURNING id",
      [id, body.rating, body.feedback ?? null],
    );
    if (!r.rowCount) throw notFound("Message");
    return { ok: true };
  });
});
