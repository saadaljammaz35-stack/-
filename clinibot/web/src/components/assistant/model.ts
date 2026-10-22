/**
 * Pure logic for the assistant page: reading system-status and assistant-test
 * responses defensively, mapping states to labels, building the test
 * transcript and validating settings. No React, no network.
 */
import type { BadgeTone } from "@/components/ui";
import type { MessageKey } from "@/i18n";
import { isApiError } from "@/lib/apiError";
import { describeError } from "@/lib/errors";
import { toLatinDigits } from "@/lib/validation";
import type { FormErrors, ValidationResult } from "@/components/knowledge/model";

// ─────────────────────────────── helpers ───────────────────────────────

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
const str = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;
const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

// ─────────────────────────────── system-status ───────────────────────────────

export const WHATSAPP_STATUSES = [
  "disconnected",
  "credentials_verified",
  "connected",
  "error",
] as const;
export type WhatsAppStatus = (typeof WHATSAPP_STATUSES)[number];

export interface AiStatus {
  /** Only whether ANTHROPIC_API_KEY is set on the server; whether it works is lastTestOk. */
  configured: boolean;
  model: string | null;
  enabled: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
}

export interface WhatsAppInfo {
  status: WhatsAppStatus;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  credentialsVerifiedAt: string | null;
  webhookVerifiedAt: string | null;
  lastInboundAt: string | null;
  /** Owner/admin only (omitted for receptionists). */
  lastError: string | null;
  webhookUrl: string | null;
}

export interface Entitlements {
  isActive: boolean;
  plan: string | null;
  status: string | null;
  aiLimit: number | null;
  aiUsed: number | null;
  aiRemaining: number | null;
}

export interface SystemStatus {
  ai: AiStatus;
  whatsapp: WhatsAppInfo;
  /** CREDENTIALS_ENCRYPTION_KEY present and valid on the server. */
  encryptionConfigured: boolean;
  entitlements: Entitlements | null;
}

/** Reads the system-status body; anything missing reads as "not configured / not connected". */
export function parseSystemStatus(raw: unknown): SystemStatus {
  const body = record(raw);
  const ai = record(body.ai);
  const wa = record(body.whatsapp);
  const ent =
    body.entitlements === null || body.entitlements === undefined
      ? null
      : record(body.entitlements);
  const status = WHATSAPP_STATUSES.includes(wa.status as WhatsAppStatus)
    ? (wa.status as WhatsAppStatus)
    : "disconnected";
  return {
    ai: {
      configured: ai.configured === true,
      model: str(ai.model),
      enabled: ai.enabled === true,
      lastTestAt: str(ai.last_test_at),
      lastTestOk: typeof ai.last_test_ok === "boolean" ? ai.last_test_ok : null,
    },
    whatsapp: {
      status,
      displayPhoneNumber: str(wa.display_phone_number),
      verifiedName: str(wa.verified_name),
      credentialsVerifiedAt: str(wa.credentials_verified_at),
      webhookVerifiedAt: str(wa.webhook_verified_at),
      lastInboundAt: str(wa.last_inbound_at),
      lastError: str(wa.last_error),
      webhookUrl: str(wa.webhook_url),
    },
    encryptionConfigured: body.encryption_configured === true,
    entitlements: ent
      ? {
          isActive: ent.is_active === true,
          plan: str(ent.plan),
          status: str(ent.status),
          aiLimit: num(ent.ai_replies_limit),
          aiUsed: num(ent.ai_replies_used),
          aiRemaining: num(ent.ai_replies_remaining),
        }
      : null,
  };
}

// ─────────────────────────────── assistant state ───────────────────────────────

/** A successful test unlocks switching the assistant on for this many days (database rule). */
export const TEST_VALID_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AssistantState =
  | "not_configured"
  | "not_tested"
  | "test_failed"
  | "test_expired"
  | "ready"
  | "active"
  | "enabled_failing"
  | "enabled_blocked";

/** True when the last test passed within the last 30 days (what the database requires to switch on). */
export function hasRecentSuccessfulTest(
  ai: Pick<AiStatus, "lastTestOk" | "lastTestAt">,
  now: Date,
): boolean {
  if (ai.lastTestOk !== true || !ai.lastTestAt) return false;
  const at = new Date(ai.lastTestAt).getTime();
  return Number.isFinite(at) && now.getTime() - at <= TEST_VALID_DAYS * DAY_MS;
}

/**
 * Whether the plan lets the assistant reply (the pipeline's rule: an active
 * subscription with replies left). Missing or unreadable entitlements count as
 * inactive, as on the server.
 */
export function planAllowsReplies(entitlements: Entitlements | null | undefined): boolean {
  return entitlements?.isActive === true && (entitlements.aiRemaining ?? 0) > 0;
}

/**
 * Whether the assistant answers patients in this clinic at all right now:
 * AI configured on the server, switched on, and paid for. Null while the
 * status is unknown (loading or failed). It can still hand a single message to
 * a person (handoff, rate limit, model failure).
 */
export function assistantCanReply(status: SystemStatus | undefined): boolean | null {
  if (!status) return null;
  return status.ai.configured && status.ai.enabled && planAllowsReplies(status.entitlements);
}

/**
 * The assistant counts as active only when it is switched on AND its last
 * test succeeded AND the AI key is configured AND the plan allows replies.
 * Everything else says why not.
 */
export function assistantState(
  ai: AiStatus,
  entitlements: Entitlements | null | undefined,
  now: Date,
): AssistantState {
  if (!ai.configured) return "not_configured";
  if (ai.enabled) {
    // The plan decides first: the server answers nobody without it, whatever the last test said.
    if (!planAllowsReplies(entitlements)) return "enabled_blocked";
    return ai.lastTestOk === true ? "active" : "enabled_failing";
  }
  // A first-ever failure has no lastTestAt (only a success records the time).
  if (ai.lastTestOk === false) return "test_failed";
  if (ai.lastTestOk === null || !ai.lastTestAt) return "not_tested";
  return hasRecentSuccessfulTest(ai, now) ? "ready" : "test_expired";
}

export function canEnableAssistant(ai: AiStatus, now: Date): boolean {
  return ai.configured && hasRecentSuccessfulTest(ai, now);
}

export const ASSISTANT_STATE_VIEW: Record<
  AssistantState,
  { label: MessageKey; text: MessageKey; tone: BadgeTone }
> = {
  not_configured: {
    label: "assistant.stateNotConfigured",
    text: "assistant.stateNotConfiguredText",
    tone: "danger",
  },
  not_tested: {
    label: "assistant.stateNotTested",
    text: "assistant.stateNotTestedText",
    tone: "warning",
  },
  test_failed: {
    label: "assistant.stateTestFailed",
    text: "assistant.stateTestFailedText",
    tone: "danger",
  },
  test_expired: {
    label: "assistant.stateTestExpired",
    text: "assistant.stateTestExpiredText",
    tone: "warning",
  },
  ready: { label: "assistant.stateReady", text: "assistant.stateReadyText", tone: "info" },
  active: { label: "assistant.stateActive", text: "assistant.stateActiveText", tone: "success" },
  enabled_failing: {
    label: "assistant.stateEnabledFailing",
    text: "assistant.stateEnabledFailingText",
    tone: "danger",
  },
  enabled_blocked: {
    label: "assistant.stateEnabledBlocked",
    text: "assistant.stateEnabledBlockedText",
    tone: "warning",
  },
};

// ─────────────────────────────── test console ───────────────────────────────

export const MAX_TEST_MESSAGES = 20;
export const MAX_MESSAGE_CHARS = 1000;

export const OUTCOMES = ["answered", "handoff", "emergency", "blocked_price", "refused"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_VIEW: Record<
  Outcome,
  { label: MessageKey; text: MessageKey; tone: BadgeTone }
> = {
  answered: {
    label: "assistant.outcomeAnswered",
    text: "assistant.outcomeAnsweredText",
    tone: "success",
  },
  handoff: {
    label: "assistant.outcomeHandoff",
    text: "assistant.outcomeHandoffText",
    tone: "info",
  },
  emergency: {
    label: "assistant.outcomeEmergency",
    text: "assistant.outcomeEmergencyText",
    tone: "danger",
  },
  blocked_price: {
    label: "assistant.outcomeBlockedPrice",
    text: "assistant.outcomeBlockedPriceText",
    tone: "warning",
  },
  refused: {
    label: "assistant.outcomeRefused",
    text: "assistant.outcomeRefusedText",
    tone: "neutral",
  },
};

const HANDOFF_REASONS: Record<string, MessageKey> = {
  medical_question: "assistant.reasonMedical",
  complaint: "assistant.reasonComplaint",
  unknown_answer: "assistant.reasonUnknown",
  customer_request: "assistant.reasonCustomerRequest",
  booking_help: "assistant.reasonBookingHelp",
  other: "assistant.reasonOther",
};

export function handoffReasonLabel(reason: string): MessageKey {
  return HANDOFF_REASONS[reason] ?? "assistant.reasonOther";
}

const TIME_WINDOWS: Record<string, MessageKey> = {
  morning: "assistant.windowMorning",
  afternoon: "assistant.windowAfternoon",
  evening: "assistant.windowEvening",
  any: "assistant.windowAny",
};

export function timeWindowLabel(window: string | null): MessageKey | null {
  return window ? (TIME_WINDOWS[window] ?? null) : null;
}

export interface TestResult {
  reply: string;
  outcome: Outcome;
  handoff: { reason: string; summary: string } | null;
  appointment: {
    customerName: string | null;
    serviceId: string | null;
    preferredDate: string | null;
    preferredTimeWindow: string | null;
  } | null;
  model: string | null;
  usage: { input: number; output: number; cacheRead: number };
}

/** Reads the assistant-test body. An unknown outcome is shown as "refused" rather than as a success. */
export function parseTestResult(raw: unknown): TestResult {
  const body = record(raw);
  const handoff = body.handoff ? record(body.handoff) : null;
  const appointment = body.appointment_request ? record(body.appointment_request) : null;
  const usage = record(body.usage);
  return {
    reply: typeof body.reply === "string" ? body.reply : "",
    outcome: OUTCOMES.includes(body.outcome as Outcome) ? (body.outcome as Outcome) : "refused",
    handoff: handoff
      ? { reason: str(handoff.reason) ?? "other", summary: str(handoff.summary) ?? "" }
      : null,
    appointment: appointment
      ? {
          customerName: str(appointment.customer_name),
          serviceId: str(appointment.service_id),
          preferredDate: str(appointment.preferred_date),
          preferredTimeWindow: str(appointment.preferred_time_window),
        }
      : null,
    model: str(body.model),
    usage: {
      input: num(usage.input_tokens) ?? 0,
      output: num(usage.output_tokens) ?? 0,
      cacheRead: num(usage.cache_read_input_tokens) ?? 0,
    },
  };
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present on assistant turns returned by the test endpoint. */
  result?: TestResult;
}

export interface TestMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * What assistant-test accepts: the last 20 messages, each 1–1000 characters,
 * starting with the user (the server would drop a leading assistant line
 * anyway) and ending with the user's new message.
 */
export function buildTestMessages(turns: readonly ChatTurn[]): TestMessage[] {
  const messages = turns
    .map((turn) => ({ role: turn.role, content: turn.content.trim().slice(0, MAX_MESSAGE_CHARS) }))
    .filter((message) => message.content !== "")
    .slice(-MAX_TEST_MESSAGES);
  const firstUser = messages.findIndex((message) => message.role === "user");
  return firstUser < 0 ? [] : messages.slice(firstUser);
}

export type TestErrorKind =
  | "not_configured"
  | "billing"
  | "key_rejected"
  | "upstream"
  | "timeout"
  | "rate_limited"
  | "forbidden"
  | "other";

export function classifyTestError(error: unknown): TestErrorKind {
  const { code, status } = describeError(error);
  if (code === "not_configured") return "not_configured";
  if (code === "subscription_inactive" || code === "ai_quota_exhausted") return "billing";
  // No answer in time (the browser or the gateway gave up): the test may still be running.
  if (code === "timeout" || status === 504) return "timeout";
  if (code === "upstream_error" || (isApiError(error) && status === 502)) {
    const details = isApiError(error) ? (error.details as Record<string, unknown> | null) : null;
    return details?.reason === "api_key_rejected" ? "key_rejected" : "upstream";
  }
  if (code === "rate_limited" || status === 429) return "rate_limited";
  if (code === "forbidden" || code === "insufficient_role") return "forbidden";
  return "other";
}

// ─────────────────────────────── settings ───────────────────────────────

export const SETTINGS_LIMITS = {
  nameMax: 40,
  welcomeMax: 500,
  instructionsMax: 2000,
  emergencyMin: 3,
  emergencyMax: 15,
} as const;

export const TONES = ["friendly", "formal"] as const;
export type Tone = (typeof TONES)[number];

export interface AssistantSettingsValues {
  assistant_name: string;
  assistant_tone: Tone;
  welcome_message_ar: string;
  welcome_message_en: string;
  extra_instructions: string;
  emergency_number: string;
}

export type SettingsField = keyof AssistantSettingsValues;

export interface AssistantSettingsPayload {
  assistant_name: string;
  assistant_tone: Tone;
  welcome_message_ar: string | null;
  welcome_message_en: string | null;
  extra_instructions: string | null;
  emergency_number: string;
}

export function validateAssistantSettings(
  values: AssistantSettingsValues,
): ValidationResult<AssistantSettingsPayload, SettingsField> {
  const errors: FormErrors<SettingsField> = {};
  const name = values.assistant_name.trim();
  if (name.length < 1 || name.length > SETTINGS_LIMITS.nameMax) {
    errors.assistant_name = {
      key: "assistant.errName",
      params: { max: SETTINGS_LIMITS.nameMax },
    };
  }
  if (!TONES.includes(values.assistant_tone)) errors.assistant_tone = { key: "assistant.errTone" };
  for (const field of ["welcome_message_ar", "welcome_message_en"] as const) {
    if (values[field].trim().length > SETTINGS_LIMITS.welcomeMax) {
      errors[field] = { key: "assistant.errTooLong", params: { max: SETTINGS_LIMITS.welcomeMax } };
    }
  }
  if (values.extra_instructions.trim().length > SETTINGS_LIMITS.instructionsMax) {
    errors.extra_instructions = {
      key: "assistant.errTooLong",
      params: { max: SETTINGS_LIMITS.instructionsMax },
    };
  }
  const emergency = toLatinDigits(values.emergency_number).replace(/[\s-]/g, "");
  if (!/^[0-9]{3,15}$/.test(emergency)) {
    errors.emergency_number = {
      key: "assistant.errEmergency",
      params: { min: SETTINGS_LIMITS.emergencyMin, max: SETTINGS_LIMITS.emergencyMax },
    };
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const optional = (value: string) => value.trim() || null;
  return {
    ok: true,
    payload: {
      assistant_name: name,
      assistant_tone: values.assistant_tone,
      welcome_message_ar: optional(values.welcome_message_ar),
      welcome_message_en: optional(values.welcome_message_en),
      extra_instructions: optional(values.extra_instructions),
      emergency_number: emergency,
    },
  };
}

/** The patient web chat link for a clinic. */
export function patientChatUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, "")}/c/${encodeURIComponent(slug)}`;
}
