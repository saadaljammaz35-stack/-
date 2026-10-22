import type { MessageKey, TFunction } from "@/i18n";
import type { Enums, Tables } from "@/lib/database.types";
import { toLatinDigits } from "@/lib/validation";

export type ConversationStatus = Enums<"conversation_status">;
export type ConversationChannel = Enums<"conversation_channel">;
export type MessageStatus = Enums<"message_status">;
export type MessageSender = Enums<"message_sender">;

/** Columns the list and the thread header read. */
export const CONVERSATION_COLUMNS =
  "id, channel, status, customer_name, customer_wa_id, language, ai_paused, handoff_reason, assigned_to, consent_at, privacy_notice_sent_at, opted_out_at, last_message_at, last_message_direction, last_inbound_at, created_at";

export type ConversationRow = Pick<
  Tables<"conversations">,
  | "id"
  | "channel"
  | "status"
  | "customer_name"
  | "customer_wa_id"
  | "language"
  | "ai_paused"
  | "handoff_reason"
  | "assigned_to"
  | "consent_at"
  | "privacy_notice_sent_at"
  | "opted_out_at"
  | "last_message_at"
  | "last_message_direction"
  | "last_inbound_at"
  | "created_at"
>;

export const MESSAGE_COLUMNS = "id, direction, sender, body, status, error_code, created_at";

export type MessageRow = Pick<
  Tables<"messages">,
  "id" | "direction" | "sender" | "body" | "status" | "error_code" | "created_at"
>;

// ───────────────────────────── list filters ─────────────────────────────

export const CONVERSATION_TABS = ["needs_reply", "awaiting", "open", "closed", "all"] as const;
export type ConversationTab = (typeof CONVERSATION_TABS)[number];

export function isConversationTab(value: unknown): value is ConversationTab {
  return CONVERSATION_TABS.includes(value as ConversationTab);
}

export const TAB_LABELS: Record<ConversationTab, MessageKey> = {
  needs_reply: "conversations.tabNeedsReply",
  awaiting: "conversations.tabAwaiting",
  open: "conversations.tabOpen",
  closed: "conversations.tabClosed",
  all: "conversations.tabAll",
};

export type ChannelFilter = "all" | ConversationChannel;

export function isChannelFilter(value: unknown): value is ChannelFilter {
  return value === "all" || value === "web" || value === "whatsapp";
}

/**
 * Needs a reply: not closed, and either handed to staff or the customer spoke
 * last. Same rule as `unanswered_conversations` in rpc dashboard_metrics.
 */
export function needsReply(
  conversation: Pick<ConversationRow, "status" | "last_message_direction">,
): boolean {
  if (conversation.status === "closed") return false;
  return (
    conversation.status === "awaiting_human" || conversation.last_message_direction === "inbound"
  );
}

/** Escapes LIKE wildcards so a typed "%" or "_" matches itself. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * What a search box value means: digits (any script, spaces and "+" allowed)
 * search the WhatsApp number; anything else searches the customer name.
 * Null for an empty search.
 */
export function parseConversationSearch(
  input: string,
): { kind: "name"; value: string } | { kind: "number"; value: string } | null {
  const trimmed = input.trim().slice(0, 80);
  if (!trimmed) return null;
  const compact = toLatinDigits(trimmed).replace(/[\s\-().+]/g, "");
  if (/^\d{3,}$/.test(compact)) {
    // A local Saudi mobile ("05…") is stored as "9665…".
    const digits = compact.startsWith("0") ? compact.replace(/^0+/, "") : compact;
    return { kind: "number", value: digits };
  }
  return { kind: "name", value: trimmed };
}

// ───────────────────────────── display ─────────────────────────────

/**
 * A WhatsApp number with the middle hidden: "966551234567" → "+9665•••••567".
 * Keeps the country code and first digit, and the last three digits.
 */
export function maskWaId(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 7) {
    const keep = Math.min(2, Math.floor(digits.length / 3));
    return `+${digits.slice(0, keep)}${"•".repeat(digits.length - keep * 2)}${keep ? digits.slice(-keep) : ""}`;
  }
  return `+${digits.slice(0, 4)}${"•".repeat(digits.length - 7)}${digits.slice(-3)}`;
}

/** Customer name, else the masked WhatsApp number, else "Website visitor". */
export function customerLabel(
  conversation: {
    customer_name: string | null;
    customer_wa_id: string | null;
    channel: ConversationChannel;
  },
  t: TFunction,
): { text: string; isNumber: boolean } {
  const name = conversation.customer_name?.trim();
  if (name) return { text: name, isNumber: false };
  if (conversation.channel === "whatsapp" && conversation.customer_wa_id) {
    return { text: maskWaId(conversation.customer_wa_id), isNumber: true };
  }
  return {
    text:
      conversation.channel === "whatsapp"
        ? t("conversations.whatsappCustomer")
        : t("conversations.webVisitor"),
    isNumber: false,
  };
}

/** The customer's WhatsApp number in E.164 ("+966551234567"). */
export function waIdToE164(waId: string): string {
  return `+${waId.replace(/\D/g, "")}`;
}

export const HANDOFF_CODES = [
  "medical_question",
  "complaint",
  "unknown_answer",
  "customer_request",
  "booking_help",
  "other",
  "possible_emergency",
  "assistant_refused",
] as const;
export type HandoffCode = (typeof HANDOFF_CODES)[number];

export const HANDOFF_LABELS: Record<HandoffCode, MessageKey> = {
  medical_question: "conversations.handoffMedicalQuestion",
  complaint: "conversations.handoffComplaint",
  unknown_answer: "conversations.handoffUnknownAnswer",
  customer_request: "conversations.handoffCustomerRequest",
  booking_help: "conversations.handoffBookingHelp",
  other: "conversations.handoffOther",
  possible_emergency: "conversations.handoffEmergency",
  assistant_refused: "conversations.handoffRefused",
};

/**
 * The server stores handoff_reason as "<code>: <summary>" (assistant handoff)
 * or a bare code ("possible_emergency"). Anything else is shown as written.
 */
export function parseHandoffReason(
  text: string | null | undefined,
): { code: HandoffCode | null; summary: string | null } | null {
  const value = text?.trim();
  if (!value) return null;
  const match = /^([a-z_]+)(?::\s*([\s\S]*))?$/.exec(value);
  const code = match?.[1];
  if (match && code && (HANDOFF_CODES as readonly string[]).includes(code)) {
    const summary = match[2]?.trim() || null;
    return { code: code as HandoffCode, summary };
  }
  return { code: null, summary: value };
}

// ───────────────────────── WhatsApp service window ─────────────────────────

/** WhatsApp lets a business send free text only within 24 hours of the customer's last message. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ServiceWindow {
  open: boolean;
  /** When free-text replies stop being allowed (null: the customer never wrote). */
  closesAt: Date | null;
  /** Milliseconds left while open, 0 once closed. */
  msLeft: number;
}

/** Same rule as the server (supabase/functions/_shared/whatsapp/window.ts). */
export function serviceWindow(lastInboundAt: string | null, now: Date = new Date()): ServiceWindow {
  if (!lastInboundAt) return { open: false, closesAt: null, msLeft: 0 };
  const at = Date.parse(lastInboundAt);
  if (!Number.isFinite(at)) return { open: false, closesAt: null, msLeft: 0 };
  const closesAt = new Date(at + SERVICE_WINDOW_MS);
  const msLeft = closesAt.getTime() - now.getTime();
  return { open: msLeft > 0, closesAt, msLeft: Math.max(0, msLeft) };
}

/** Template fields as the conversation-reply function validates them. */
export const TEMPLATE_NAME_PATTERN = /^[a-z0-9_]{1,512}$/;
export const TEMPLATE_LANGUAGE_PATTERN = /^[a-z]{2,3}(_[A-Z]{2})?$/;
export const TEMPLATE_MAX_PARAMS = 20;
export const TEMPLATE_PARAM_MAX = 1024;
/** messages.body limit (and the reply function's). */
export const REPLY_MAX = 4096;
