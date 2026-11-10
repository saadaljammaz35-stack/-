import { providerCreateSchema } from "@/lib/api/schemas";
import { audit } from "@/lib/audit";
import { providerFromRow, syncPlatformProviders } from "@/lib/ai/providers/registry";
import { withUser } from "@/lib/db/pool";
import { json, route } from "@/lib/http/route";
import { assertPublicUrl } from "@/lib/security/ssrf";
import { sealSecret, secretHint } from "@/lib/security/secrets";

export const runtime = "nodejs";

export const GET = route.auth({ scope: "models:read" }, async ({ auth }) =>
  withUser(auth.userId, async (db) => {
    await syncPlatformProviders(db);
    const r = await db.query(
      `SELECT p.*, c.connection_status, c.secret_hint, c.last_checked_at
         FROM ai_model_providers p LEFT JOIN ai_model_connections c ON c.provider_id = p.id AND c.owner_id = $1
        ORDER BY p.owner_id NULLS FIRST, p.provider_name`,
      [auth.userId],
    );
    return {
      providers: r.rows.map((row) => ({
        ...providerFromRow(row),
        scope: row.owner_id ? "personal" : "platform",
        connection: row.connection_status ? { status: row.connection_status, secretHint: row.secret_hint, lastCheckedAt: row.last_checked_at } : null,
      })),
    };
  }),
);

/**
 * Register a personal provider endpoint. Only public https:// hosts are accepted
 * (SSRF protection); the API key is sealed with AES-256-GCM and never returned.
 */
export const POST = route.auth({ sessionOnly: true, body: providerCreateSchema }, async ({ auth, body, requestId, ip }) => {
  await assertPublicUrl(body.endpoint, { httpsOnly: true });
  const sealed = body.apiKey ? sealSecret(body.apiKey) : null;
  return withUser(auth.userId, async (db) => {
    const p = await db.query(
      `INSERT INTO ai_model_providers (owner_id, workspace_id, provider_name, provider_type, endpoint, capabilities)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [auth.userId, auth.workspaceId, body.providerName, body.providerType, body.endpoint, body.pricing ? { pricing: body.pricing } : {}],
    );
    if (sealed) {
      await db.query(
        `INSERT INTO ai_model_connections (owner_id, workspace_id, provider_id, secret_reference, secret_hint) VALUES ($1, $2, $3, $4, $5)`,
        [auth.userId, auth.workspaceId, p.rows[0].id, sealed, secretHint(body.apiKey!)],
      );
    }
    await audit(db, { ...auth, requestId, ip }, "provider.registered", "model_provider", p.rows[0].id, { type: body.providerType, host: new URL(body.endpoint).host });
    return json({ provider: providerFromRow(p.rows[0]) }, { status: 201 });
  });
});
