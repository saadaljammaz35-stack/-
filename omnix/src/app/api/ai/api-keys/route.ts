import { apiKeyCreateSchema } from "@/lib/api/schemas";
import { audit } from "@/lib/audit";
import { newApiKey, sha256 } from "@/lib/auth/tokens";
import { withUser } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ sessionOnly: true }, async ({ auth }) =>
  withUser(auth.userId, async (db) => {
    const r = await db.query(
      `SELECT id, name, prefix, scopes, last_used_at, expires_at, revoked_at, created_at FROM ai_api_keys
        WHERE owner_id = $1 AND workspace_id = $2 ORDER BY created_at DESC`,
      [auth.userId, auth.workspaceId],
    );
    return { keys: r.rows };
  }),
);

/** Creates a key. The plaintext token is returned exactly once; only its SHA-256 is stored. */
export const POST = route.auth(
  { sessionOnly: true, body: apiKeyCreateSchema, rateLimit: { name: "api-key-create", limit: 20, windowSec: 3600 } },
  async ({ auth, body, requestId, ip }) => {
    const { token, prefix } = newApiKey();
    return withUser(auth.userId, async (db) => {
      const r = await db.query(
        `INSERT INTO ai_api_keys (owner_id, workspace_id, name, prefix, token_hash, scopes, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7::int IS NULL THEN NULL ELSE now() + make_interval(days => $7) END)
         RETURNING id, name, prefix, scopes, expires_at, created_at`,
        [auth.userId, auth.workspaceId, body.name, prefix, sha256(token), [...new Set(body.scopes)], body.expiresInDays ?? null],
      );
      await audit(db, { ...auth, requestId, ip }, "api_key.created", "api_key", r.rows[0].id, { scopes: body.scopes });
      return json({ key: r.rows[0], token }, { status: 201 });
    });
  },
);
