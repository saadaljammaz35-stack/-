import type { Lang } from "@/i18n";

/**
 * Shapes of the `public-chat` Edge Function (docs/API.md, "public-chat").
 * Parsed and checked in chatApi.ts before the UI sees them.
 */

export type ChatSender = "customer" | "assistant" | "staff" | "system";
export type ChatDirection = "inbound" | "outbound";
export type ConversationStatus = "open" | "awaiting_human" | "closed";

export interface ChatMessage {
  id: string;
  direction: ChatDirection;
  sender: ChatSender;
  body: string;
  /** ISO timestamp from the server (Postgres timestamptz, microseconds). */
  created_at: string;
}

export interface LocalizedText {
  ar: string;
  en: string;
}

export interface ChatProfile {
  name: string;
  slug: string;
  assistant_name: string;
  welcome_message: LocalizedText;
  privacy_notice: LocalizedText;
  reception_phone: string | null;
  emergency_number: string;
  default_language: Lang;
  assistant_available: boolean;
}

export interface StartResult {
  session_token: string;
  messages: ChatMessage[];
}

/** `send` and `poll` both answer with the new messages and the conversation state. */
export interface TurnResult {
  messages: ChatMessage[];
  status: ConversationStatus;
  ai_paused: boolean;
}

/**
 * A message as the page shows it. The visitor's own message is shown at once
 * with a client id (`local: true`) because `send` only returns the replies;
 * it is swapped for the server copy if a poll brings that copy back.
 */
export interface TimelineMessage extends ChatMessage {
  /** Sort position in microseconds since the epoch (server clock). */
  at: number;
  /** Client-side copy of the visitor's message (no server id yet). */
  local?: boolean;
  /** True while the `send` request for this local message is in flight. */
  pending?: boolean;
}
