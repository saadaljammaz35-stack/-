/**
 * Pure logic for the WhatsApp page: status labels, credential and template
 * validation (mirroring whatsapp-connect and the integration_settings CHECKs)
 * and reading whatsapp-connect errors. No React, no network.
 */
import type { BadgeTone } from "@/components/ui";
import type { MessageKey } from "@/i18n";
import { isApiError } from "@/lib/apiError";
import { describeError } from "@/lib/errors";
import { toLatinDigits } from "@/lib/validation";
import type { FormErrors, ValidationResult } from "@/components/knowledge/model";
import type { WhatsAppStatus } from "@/components/assistant/model";

export type { WhatsAppStatus };

// ─────────────────────────────── status ───────────────────────────────

export interface StatusView {
  label: MessageKey;
  text: MessageKey;
  tone: BadgeTone;
}

const STATUS_VIEW: Record<WhatsAppStatus, StatusView> = {
  disconnected: {
    label: "whatsapp.statusDisconnected",
    text: "whatsapp.statusDisconnectedText",
    tone: "neutral",
  },
  credentials_verified: {
    label: "whatsapp.statusCredentialsVerified",
    text: "whatsapp.statusCredentialsVerifiedText",
    tone: "warning",
  },
  connected: {
    label: "whatsapp.statusConnected",
    text: "whatsapp.statusConnectedText",
    tone: "success",
  },
  error: { label: "whatsapp.statusError", text: "whatsapp.statusErrorText", tone: "danger" },
};

/**
 * Label, explanation and tone for a status. "Connected" (and the success
 * tone) is used only for exactly "connected"; anything unknown reads as
 * disconnected.
 */
export function whatsappStatusView(status: string | null | undefined): StatusView {
  return status === "disconnected" ||
    status === "credentials_verified" ||
    status === "connected" ||
    status === "error"
    ? STATUS_VIEW[status]
    : STATUS_VIEW.disconnected;
}

const QUALITY: Record<string, MessageKey> = {
  GREEN: "whatsapp.qualityHigh",
  YELLOW: "whatsapp.qualityMedium",
  RED: "whatsapp.qualityLow",
};

export function qualityLabel(rating: string | null | undefined): MessageKey {
  return (rating && QUALITY[rating.toUpperCase()]) || "whatsapp.qualityUnknown";
}

// ─────────────────────────────── credentials ───────────────────────────────

export const CREDENTIAL_LIMITS = {
  idMin: 5,
  idMax: 32,
  tokenMin: 20,
  tokenMax: 1024,
  secretMin: 16,
  secretMax: 256,
} as const;

export interface CredentialsValues {
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  app_secret: string;
}

export type CredentialsField = keyof CredentialsValues;

export const EMPTY_CREDENTIALS: CredentialsValues = {
  phone_number_id: "",
  waba_id: "",
  access_token: "",
  app_secret: "",
};

const PRINTABLE_NO_SPACES = /^[\x21-\x7E]+$/;

/** Meta ids are digits; people paste them with spaces or Arabic-Indic digits. */
export function normalizeMetaId(input: string): string {
  return toLatinDigits(input).replace(/\s+/g, "");
}

export function validateCredentials(
  values: CredentialsValues,
): ValidationResult<CredentialsValues, CredentialsField> {
  const errors: FormErrors<CredentialsField> = {};
  const phoneNumberId = normalizeMetaId(values.phone_number_id);
  const wabaId = normalizeMetaId(values.waba_id);
  const accessToken = values.access_token.trim();
  const appSecret = values.app_secret.trim();
  const idParams = { min: CREDENTIAL_LIMITS.idMin, max: CREDENTIAL_LIMITS.idMax };

  if (!phoneNumberId) errors.phone_number_id = { key: "whatsapp.errRequired" };
  else if (!/^\d{5,32}$/.test(phoneNumberId)) {
    errors.phone_number_id = { key: "whatsapp.errDigits", params: idParams };
  }
  if (!wabaId) errors.waba_id = { key: "whatsapp.errRequired" };
  else if (!/^\d{5,32}$/.test(wabaId)) errors.waba_id = { key: "whatsapp.errDigits", params: idParams };

  if (!accessToken) errors.access_token = { key: "whatsapp.errRequired" };
  else if (!PRINTABLE_NO_SPACES.test(accessToken)) {
    errors.access_token = { key: "whatsapp.errSecretChars" };
  } else if (
    accessToken.length < CREDENTIAL_LIMITS.tokenMin ||
    accessToken.length > CREDENTIAL_LIMITS.tokenMax
  ) {
    errors.access_token = {
      key: "whatsapp.errLength",
      params: { min: CREDENTIAL_LIMITS.tokenMin, max: CREDENTIAL_LIMITS.tokenMax },
    };
  }

  if (!appSecret) errors.app_secret = { key: "whatsapp.errRequired" };
  else if (!PRINTABLE_NO_SPACES.test(appSecret)) errors.app_secret = { key: "whatsapp.errSecretChars" };
  else if (
    appSecret.length < CREDENTIAL_LIMITS.secretMin ||
    appSecret.length > CREDENTIAL_LIMITS.secretMax
  ) {
    errors.app_secret = {
      key: "whatsapp.errLength",
      params: { min: CREDENTIAL_LIMITS.secretMin, max: CREDENTIAL_LIMITS.secretMax },
    };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      access_token: accessToken,
      app_secret: appSecret,
    },
  };
}

// ─────────────────────────────── template ───────────────────────────────

export const TEMPLATE_LANGUAGES = ["ar", "en", "en_US", "en_GB"] as const;

export interface TemplateValues {
  name: string;
  language: string;
}

export interface TemplatePayload {
  confirmation_template_name: string | null;
  confirmation_template_language: string;
}

/** Same rules as the integration_settings CHECK constraints. Empty name = no template. */
export function validateTemplate(
  values: TemplateValues,
): ValidationResult<TemplatePayload, keyof TemplateValues> {
  const errors: FormErrors<keyof TemplateValues> = {};
  const name = values.name.trim();
  const language = values.language.trim();
  if (name && !/^[a-z0-9_]{1,512}$/.test(name)) errors.name = { key: "whatsapp.errTemplateName" };
  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(language)) {
    errors.language = { key: "whatsapp.errTemplateLanguage" };
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: { confirmation_template_name: name || null, confirmation_template_language: language },
  };
}

// ─────────────────────────────── errors ───────────────────────────────

export interface MetaRejection {
  code: number | string | null;
  message: string | null;
}

/** Meta's own error (502 upstream_error with details.meta_code / meta_message), if that is what failed. */
export function metaRejection(error: unknown): MetaRejection | null {
  if (!isApiError(error) || error.code !== "upstream_error") return null;
  const details =
    typeof error.details === "object" && error.details !== null
      ? (error.details as Record<string, unknown>)
      : {};
  const code =
    typeof details.meta_code === "number" || typeof details.meta_code === "string"
      ? details.meta_code
      : null;
  const message =
    typeof details.meta_message === "string" && details.meta_message.trim()
      ? details.meta_message.trim()
      : null;
  if (details.provider !== "meta" && code === null && message === null) return null;
  return { code, message };
}

export type ConnectErrorKind =
  | "meta_rejected"
  | "phone_in_use"
  | "encryption_missing"
  | "not_connected"
  | "other";

export function classifyConnectError(error: unknown): ConnectErrorKind {
  if (metaRejection(error)) return "meta_rejected";
  const { code } = describeError(error);
  if (code === "phone_number_in_use") return "phone_in_use";
  if (code === "not_configured") return "encryption_missing";
  if (code === "whatsapp_not_connected") return "not_connected";
  return "other";
}
