import { audit } from "@/lib/audit";
import { withUser } from "@/lib/db/pool";
import { notFound } from "@/lib/http/errors";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const DELETE = route.auth({ sessionOnly: true }, async ({ auth, params, requestId, ip }) => {
  const id = parseId(params.id, "API key");
  return withUser(auth.userId, async (db) => {
    const r = await db.query("UPDATE ai_api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id", [id]);
    if (!r.rowCount) throw notFound("API key");
    await audit(db, { ...auth, requestId, ip }, "api_key.revoked", "api_key", id);
    return { ok: true };
  });
});
