// A clinic's WhatsApp integration: its settings row and its encrypted
// credentials. Credentials are AES-256-GCM sealed with CREDENTIALS_ENCRYPTION_KEY
// and bound to the integration row through the additional data
// "<integration id>:<field>", so a ciphertext copied into another clinic's row,
// or from one field into another, does not decrypt.

import { credentialsKey, decryptSecret, encryptSecret } from "../crypto.ts";
import { type Db, dbFailure } from "../db.ts";
import { requireEnv } from "../env.ts";
import { log } from "../log.ts";
import type { GraphConfig } from "./graph.ts";

export type IntegrationStatus = "disconnected" | "credentials_verified" | "connected" | "error";

export interface IntegrationRow {
  id: string;
  organization_id: string;
  status: IntegrationStatus;
  phone_number_id: string | null;
  waba_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  webhook_key: string;
  credentials_verified_at: string | null;
  webhook_verified_at: string | null;
  last_inbound_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  confirmation_template_name: string | null;
  confirmation_template_language: string;
}

export interface Credentials {
  accessToken: string;
  appSecret: string | null;
  verifyTokenHash: string | null;
}

export const INTEGRATION_COLUMNS =
  "id, organization_id, status, phone_number_id, waba_id, display_phone_number, verified_name, webhook_key, " +
  "credentials_verified_at, webhook_verified_at, last_inbound_at, last_error, last_error_at, " +
  "confirmation_template_name, confirmation_template_language";

// webhook_key defaults to 18 random bytes in hex; anything else cannot match a row.
const WEBHOOK_KEY = /^[0-9a-f]{32,64}$/;

function aad(integration: Pick<IntegrationRow, "id">, field: "access_token" | "app_secret"): string {
  return `${integration.id}:${field}`;
}

export async function loadIntegration(db: Db, organizationId: string): Promise<IntegrationRow | null> {
  const { data, error } = await db
    .from("integration_settings")
    .select(INTEGRATION_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("provider", "whatsapp")
    .maybeSingle();
  if (error) dbFailure("integration_lookup", error);
  return (data as IntegrationRow | null) ?? null;
}

/** The webhook's trusted lookup: the clinic is derived from the URL key, never from the payload. */
export async function loadIntegrationByWebhookKey(db: Db, webhookKey: string): Promise<IntegrationRow | null> {
  if (!WEBHOOK_KEY.test(webhookKey)) return null;
  const { data, error } = await db
    .from("integration_settings")
    .select(INTEGRATION_COLUMNS)
    .eq("webhook_key", webhookKey)
    .eq("provider", "whatsapp")
    .maybeSingle();
  if (error) dbFailure("integration_lookup_by_key", error);
  return (data as IntegrationRow | null) ?? null;
}

/**
 * Decrypted credentials, or null when none are stored or they no longer decrypt
 * (for example after CREDENTIALS_ENCRYPTION_KEY changed); the clinic must then
 * save them again. A missing key throws ConfigError.
 */
export async function loadCredentials(
  db: Db,
  integration: Pick<IntegrationRow, "id" | "organization_id">,
): Promise<Credentials | null> {
  const { data, error } = await db
    .from("integration_credentials")
    .select("access_token_ciphertext, app_secret_ciphertext, verify_token_hash")
    .eq("integration_id", integration.id)
    .eq("organization_id", integration.organization_id)
    .maybeSingle();
  if (error) dbFailure("credentials_lookup", error);
  if (!data) return null;
  const row = data as {
    access_token_ciphertext: string;
    app_secret_ciphertext: string | null;
    verify_token_hash: string | null;
  };
  const key = await credentialsKey();
  try {
    return {
      accessToken: await decryptSecret(row.access_token_ciphertext, key, aad(integration, "access_token")),
      appSecret: row.app_secret_ciphertext === null
        ? null
        : await decryptSecret(row.app_secret_ciphertext, key, aad(integration, "app_secret")),
      verifyTokenHash: row.verify_token_hash,
    };
  } catch {
    log.error("whatsapp.credentials_undecryptable", { integration_id: integration.id });
    return null;
  }
}

export async function saveCredentials(
  db: Db,
  integration: Pick<IntegrationRow, "id" | "organization_id">,
  credentials: Credentials,
): Promise<void> {
  const key = await credentialsKey();
  const row = {
    integration_id: integration.id,
    organization_id: integration.organization_id,
    access_token_ciphertext: await encryptSecret(credentials.accessToken, key, aad(integration, "access_token")),
    app_secret_ciphertext: credentials.appSecret === null
      ? null
      : await encryptSecret(credentials.appSecret, key, aad(integration, "app_secret")),
    verify_token_hash: credentials.verifyTokenHash,
    key_version: 1,
  };
  const { error } = await db.from("integration_credentials").upsert(row, { onConflict: "integration_id" });
  if (error) dbFailure("credentials_save", error);
}

export function webhookUrl(webhookKey: string): string {
  return `${requireEnv("SUPABASE_URL").replace(/\/+$/, "")}/functions/v1/whatsapp-webhook/${webhookKey}`;
}

/** True when the settings allow sending (credentials must still be loaded and present). */
export function canSend(
  integration: IntegrationRow | null,
): integration is IntegrationRow & { phone_number_id: string } {
  return integration !== null &&
    (integration.status === "connected" || integration.status === "credentials_verified") &&
    integration.phone_number_id !== null;
}

export function graphConfig(integration: IntegrationRow, credentials: Credentials): GraphConfig {
  if (integration.phone_number_id === null) throw new Error("WhatsApp integration has no phone number id");
  return { accessToken: credentials.accessToken, phoneNumberId: integration.phone_number_id };
}
