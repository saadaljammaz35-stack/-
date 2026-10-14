// system-status: what is configured and connected for a clinic, for the
// dashboard's setup checklist (any member; see docs/API.md). Every value is
// read from configuration or the database; nothing here is assumed to work.

import { DEFAULT_MODEL } from "../_shared/assistant/claude.ts";
import { credentialsKey } from "../_shared/crypto.ts";
import { type Db, dbFailure, requireMembership, requireUser, serviceClient } from "../_shared/db.ts";
import { z } from "../_shared/deps.ts";
import { ConfigError, optionalEnv, optionalSecret } from "../_shared/env.ts";
import { type Handler, json, parse, readJson } from "../_shared/http.ts";
import { log } from "../_shared/log.ts";
import { loadIntegration, webhookUrl } from "../_shared/whatsapp/integration.ts";

export interface Deps {
  db: Db;
  /** Resolves CREDENTIALS_ENCRYPTION_KEY as an AES key; only whether it succeeds matters here. */
  loadEncryptionKey: () => Promise<CryptoKey>;
}

export function liveDeps(): Deps {
  return { db: serviceClient(), loadEncryptionKey: credentialsKey };
}

const Body = z.object({ organization_id: z.uuid() });

interface SettingsRow {
  assistant_enabled: boolean;
  ai_last_test_at: string | null;
  ai_last_test_ok: boolean | null;
}

/** True only when the key is set and imports as a 32-byte AES key. */
export async function encryptionConfigured(loadKey: () => Promise<CryptoKey>): Promise<boolean> {
  try {
    // Called inside the try: a missing key throws synchronously.
    await loadKey();
    return true;
  } catch (error) {
    if (!(error instanceof ConfigError)) log.warn("system_status.encryption_key_invalid");
    return false;
  }
}

export function createHandler(getDeps: () => Deps): Handler {
  return async (req: Request): Promise<Response> => {
    const { db, loadEncryptionKey } = getDeps();
    const user = await requireUser(req, db);
    const { organization_id: organizationId } = parse(Body, await readJson(req, 4 * 1024));
    const role = await requireMembership(db, user.id, organizationId);
    const staff = role === "owner" || role === "admin";

    const [settingsResult, integration, entitlementsResult, encryption] = await Promise.all([
      db
        .from("clinic_settings")
        .select("assistant_enabled, ai_last_test_at, ai_last_test_ok")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      loadIntegration(db, organizationId),
      db.rpc("org_entitlements", { p_org: organizationId }),
      encryptionConfigured(loadEncryptionKey),
    ]);
    if (settingsResult.error) dbFailure("settings_lookup", settingsResult.error);
    if (entitlementsResult.error) dbFailure("org_entitlements", entitlementsResult.error);
    const settings = settingsResult.data as SettingsRow | null;

    return json(req, {
      role,
      ai: {
        // Presence of the key only; whether it actually works is last_test_ok, set by a real test call.
        configured: optionalSecret("ANTHROPIC_API_KEY") !== undefined,
        model: optionalEnv("ANTHROPIC_MODEL") ?? DEFAULT_MODEL,
        enabled: settings?.assistant_enabled ?? false,
        last_test_at: settings?.ai_last_test_at ?? null,
        last_test_ok: settings?.ai_last_test_ok ?? null,
      },
      whatsapp: {
        status: integration?.status ?? "disconnected",
        display_phone_number: integration?.display_phone_number ?? null,
        verified_name: integration?.verified_name ?? null,
        credentials_verified_at: integration?.credentials_verified_at ?? null,
        webhook_verified_at: integration?.webhook_verified_at ?? null,
        last_inbound_at: integration?.last_inbound_at ?? null,
        // integration_settings is owner/admin-only under RLS; receptionists see the summary without these.
        ...(staff
          ? {
            last_error: integration?.last_error ?? null,
            webhook_url: integration ? webhookUrl(integration.webhook_key) : null,
          }
          : {}),
      },
      encryption_configured: encryption,
      entitlements: entitlementsResult.data ?? null,
      // No payment provider is integrated yet. This may only change once one is integrated and tested
      // end to end; until then billing is handled by hand (docs/BILLING.md).
      payments: { enabled: false, provider: null },
    });
  };
}
