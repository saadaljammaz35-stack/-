import { isLang } from "@/i18n";
import { ApiError, callFunction } from "@/lib/api";
import { parseTimestamp } from "./model";
import type {
  ChatMessage,
  ChatProfile,
  ConversationStatus,
  LocalizedText,
  StartResult,
  TurnResult,
} from "./types";

/**
 * The `public-chat` Edge Function (docs/API.md). Every response is checked
 * before the page uses it; a malformed one becomes an ApiError so the page
 * shows a normal error state instead of crashing.
 */

const PROFILE_TIMEOUT_MS = 20_000;
const START_TIMEOUT_MS = 20_000;
/** The assistant may take a while to answer. */
const SEND_TIMEOUT_MS = 60_000;
const POLL_TIMEOUT_MS = 15_000;
const DELETE_TIMEOUT_MS = 20_000;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function invalidResponse(): ApiError {
  return new ApiError({ status: 0, code: "invalid_response", message: "Unexpected response" });
}

const SENDERS = new Set(["customer", "assistant", "staff", "system"]);
const DIRECTIONS = new Set(["inbound", "outbound"]);
const STATUSES = new Set(["open", "awaiting_human", "closed"]);

/** One message, or null when it does not have the documented shape. */
export function parseMessage(value: unknown): ChatMessage | null {
  const raw = record(value);
  if (!raw) return null;
  const id = text(raw.id);
  const body = text(raw.body);
  const createdAt = text(raw.created_at);
  const sender = text(raw.sender);
  const direction = text(raw.direction);
  if (!id || body === null || !createdAt || !sender || !direction) return null;
  if (!SENDERS.has(sender) || !DIRECTIONS.has(direction)) return null;
  if (parseTimestamp(createdAt) === null) return null;
  return {
    id,
    body,
    created_at: createdAt,
    sender: sender as ChatMessage["sender"],
    direction: direction as ChatMessage["direction"],
  };
}

/** Keeps the well-formed messages of a list (a bad one is skipped, not fatal). */
export function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseMessage).filter((message): message is ChatMessage => message !== null);
}

function localized(value: unknown): LocalizedText {
  const raw = record(value);
  return { ar: text(raw?.ar) ?? "", en: text(raw?.en) ?? "" };
}

export function parseProfile(value: unknown): ChatProfile {
  const clinic = record(record(value)?.clinic);
  const name = text(clinic?.name);
  const slug = text(clinic?.slug);
  if (!clinic || !name || !slug) throw invalidResponse();
  const phone = text(clinic.reception_phone)?.trim();
  const emergency = text(clinic.emergency_number)?.trim();
  return {
    name,
    slug,
    assistant_name: text(clinic.assistant_name)?.trim() || "CliniBot",
    welcome_message: localized(clinic.welcome_message),
    privacy_notice: localized(clinic.privacy_notice),
    reception_phone: phone ? phone : null,
    emergency_number: emergency && /^\d{3,15}$/.test(emergency) ? emergency : "997",
    default_language: isLang(clinic.default_language) ? clinic.default_language : "ar",
    assistant_available: clinic.assistant_available === true,
  };
}

export function parseTurn(value: unknown): TurnResult {
  const raw = record(value);
  if (!raw) throw invalidResponse();
  const status = text(raw.status);
  return {
    messages: parseMessages(raw.messages),
    status: status && STATUSES.has(status) ? (status as ConversationStatus) : "open",
    ai_paused: raw.ai_paused === true,
  };
}

export function parseStart(value: unknown): StartResult {
  const raw = record(value);
  const token = text(raw?.session_token);
  if (!raw || !token) throw invalidResponse();
  return { session_token: token, messages: parseMessages(raw.messages) };
}

export async function fetchProfile(slug: string, signal?: AbortSignal): Promise<ChatProfile> {
  const data = await callFunction<unknown>(
    "public-chat",
    { action: "profile", slug },
    { timeout: PROFILE_TIMEOUT_MS, ...(signal ? { signal } : {}) },
  );
  return parseProfile(data);
}

export async function startChat(slug: string, language: string): Promise<StartResult> {
  const data = await callFunction<unknown>(
    "public-chat",
    { action: "start", slug, consent: true, language },
    { timeout: START_TIMEOUT_MS },
  );
  return parseStart(data);
}

export async function sendChatMessage(token: string, message: string): Promise<TurnResult> {
  const data = await callFunction<unknown>(
    "public-chat",
    { action: "send", session_token: token, message },
    { timeout: SEND_TIMEOUT_MS },
  );
  return parseTurn(data);
}

export async function pollChat(
  token: string,
  after: string | undefined,
  signal?: AbortSignal,
): Promise<TurnResult> {
  const data = await callFunction<unknown>(
    "public-chat",
    { action: "poll", session_token: token, ...(after ? { after } : {}) },
    { timeout: POLL_TIMEOUT_MS, ...(signal ? { signal } : {}) },
  );
  return parseTurn(data);
}

export async function deleteChat(token: string): Promise<void> {
  await callFunction<unknown>(
    "public-chat",
    { action: "delete", session_token: token },
    { timeout: DELETE_TIMEOUT_MS },
  );
}
