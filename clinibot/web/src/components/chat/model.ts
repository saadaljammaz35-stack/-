import type {
  ChatMessage,
  ChatProfile,
  ChatSender,
  ConversationStatus,
  TimelineMessage,
} from "./types";

/** `message` limits enforced by the server (trimmed, 1–1000 characters). */
export const MAX_MESSAGE_LENGTH = 1000;
/** How often the open chat asks for new messages while the page is visible. */
export const POLL_INTERVAL_MS = 4000;
/** Longest wait between polls after repeated failures. */
export const MAX_POLL_BACKOFF_MS = 30_000;

// ───────────────────────────── timestamps ─────────────────────────────

const ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/**
 * Microseconds since the epoch for a Postgres/ISO timestamp such as
 * "2026-10-12T10:00:00.123456+00:00". Parsed by hand so microsecond order is
 * kept (Date only has milliseconds) and so every browser, including older
 * Safari, reads the same value. Returns null for anything unparseable.
 */
export function parseTimestamp(value: string): number | null {
  const match = ISO_TIMESTAMP.exec(value.trim());
  if (!match) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms * 1000;
  }
  const [, year, month, day, hour, minute, second = "0", fraction = "", zone] = match;
  let ms = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (zone && zone.toUpperCase() !== "Z") {
    const sign = zone.startsWith("-") ? -1 : 1;
    const digits = zone.slice(1).replace(":", "");
    const offsetMinutes = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4) || "0");
    ms -= sign * offsetMinutes * 60_000;
  }
  const micros = Number(`${fraction}000000`.slice(0, 6));
  const total = ms * 1000 + micros;
  return Number.isFinite(total) ? total : null;
}

/** A Date for display (millisecond precision is enough on screen). */
export function timestampToDate(at: number): Date {
  return new Date(Math.floor(at / 1000));
}

// ───────────────────────────── ordering & merging ─────────────────────────────

export function toTimeline(message: ChatMessage): TimelineMessage {
  return {
    id: message.id,
    direction: message.direction,
    sender: message.sender,
    body: message.body,
    created_at: message.created_at,
    at: parseTimestamp(message.created_at) ?? 0,
  };
}

/** Oldest first; on equal time the visitor's message comes before the reply. */
export function compareTimeline(a: TimelineMessage, b: TimelineMessage): number {
  if (a.at !== b.at) return a.at - b.at;
  if (a.direction !== b.direction) return a.direction === "inbound" ? -1 : 1;
  if (Boolean(a.local) !== Boolean(b.local)) return a.local ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortTimeline(messages: readonly TimelineMessage[]): TimelineMessage[] {
  return [...messages].sort(compareTimeline);
}

/** Server and client clocks may disagree a little; a local copy may look this much "newer". */
const LOCAL_MATCH_SLACK_MICROS = 120 * 1_000_000;

function normalizedBody(body: string): string {
  return body.trim();
}

/**
 * The local copy that a server copy of the visitor's message replaces: one
 * with the same text, preferring the one still being sent, otherwise the most
 * recent one that is not newer than the server copy.
 */
function findLocalCopy(
  candidates: Iterable<TimelineMessage>,
  serverCopy: TimelineMessage,
): TimelineMessage | null {
  const body = normalizedBody(serverCopy.body);
  let best: TimelineMessage | null = null;
  for (const message of candidates) {
    if (!message.local || normalizedBody(message.body) !== body) continue;
    if (message.pending) {
      if (!best?.pending || message.at > best.at) best = message;
      continue;
    }
    if (best?.pending) continue;
    if (message.at > serverCopy.at + LOCAL_MATCH_SLACK_MICROS) continue;
    if (!best || message.at > best.at) best = message;
  }
  return best;
}

function sameMessage(a: TimelineMessage, b: ChatMessage): boolean {
  return (
    a.body === b.body &&
    a.sender === b.sender &&
    a.direction === b.direction &&
    a.created_at === b.created_at
  );
}

/**
 * Adds server messages to the timeline: one entry per id (a message seen
 * again replaces nothing and is not duplicated), the visitor's local copy is
 * swapped for its server copy, and the result is sorted oldest first.
 * Returns `existing` itself when nothing changed.
 */
export function mergeMessages(
  existing: readonly TimelineMessage[],
  incoming: readonly ChatMessage[],
): readonly TimelineMessage[] {
  if (incoming.length === 0) return existing;
  const byId = new Map<string, TimelineMessage>();
  for (const message of existing) byId.set(message.id, message);
  let changed = false;

  for (const message of incoming) {
    const previous = byId.get(message.id);
    if (previous && !previous.local) {
      if (!sameMessage(previous, message)) {
        byId.set(message.id, toTimeline(message));
        changed = true;
      }
      continue;
    }
    const next = toTimeline(message);
    if (message.sender === "customer") {
      const copy = findLocalCopy(byId.values(), next);
      if (copy) byId.delete(copy.id);
    }
    byId.set(message.id, next);
    changed = true;
  }

  return changed ? sortTimeline([...byId.values()]) : existing;
}

/**
 * The `after` value for the next poll: the newest server timestamp, exactly
 * as the server wrote it. Local copies never move the cursor. Undefined when
 * there is nothing yet (the server then returns the last 50 messages).
 */
export function pollCursor(messages: readonly TimelineMessage[]): string | undefined {
  let newest: TimelineMessage | undefined;
  for (const message of messages) {
    if (message.local) continue;
    if (!newest || message.at > newest.at) newest = message;
  }
  return newest?.created_at;
}

/** Sort position for a message the visitor is sending now: right after everything shown. */
export function localAnchor(messages: readonly TimelineMessage[], nowMicros: number): number {
  let latest: number | null = null;
  for (const message of messages) {
    if (latest === null || message.at > latest) latest = message.at;
  }
  return latest === null ? nowMicros : latest + 1;
}

/** Messages from the clinic side (assistant, staff, notices) that are not on screen yet. */
export function newArrivals(
  existing: readonly TimelineMessage[],
  incoming: readonly ChatMessage[],
): ChatMessage[] {
  const known = new Set(existing.map((message) => message.id));
  const seen = new Set<string>();
  return incoming.filter((message) => {
    if (message.sender === "customer" || known.has(message.id) || seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
}

// ───────────────────────────── grouping ─────────────────────────────

export type MessageSide = "start" | "end" | "center";

/** The visitor writes on the end side, the clinic on the start side, notices in the middle. */
export function sideOf(sender: ChatSender): MessageSide {
  if (sender === "customer") return "end";
  if (sender === "system") return "center";
  return "start";
}

export interface MessageGroup {
  key: string;
  sender: ChatSender;
  side: MessageSide;
  messages: TimelineMessage[];
}

/** Consecutive messages from the same sender within this many minutes share one group. */
export const GROUP_GAP_MINUTES = 10;

/**
 * Groups consecutive messages by sender (oldest first). System notices are
 * always on their own; a long pause starts a new group.
 */
export function groupMessages(
  messages: readonly TimelineMessage[],
  gapMinutes = GROUP_GAP_MINUTES,
): MessageGroup[] {
  const gap = gapMinutes * 60 * 1_000_000;
  const groups: MessageGroup[] = [];
  for (const message of sortTimeline(messages)) {
    const last = groups[groups.length - 1];
    const lastMessage = last?.messages[last.messages.length - 1];
    if (
      last &&
      lastMessage &&
      message.sender !== "system" &&
      last.sender === message.sender &&
      message.at - lastMessage.at <= gap
    ) {
      last.messages.push(message);
    } else {
      groups.push({
        key: message.id,
        sender: message.sender,
        side: sideOf(message.sender),
        messages: [message],
      });
    }
  }
  return groups;
}

/** The greeting the server stores as the first (system) message of a new chat. */
export function isWelcomeMessage(
  message: Pick<ChatMessage, "sender" | "body">,
  profile: Pick<ChatProfile, "welcome_message">,
): boolean {
  if (message.sender !== "system") return false;
  const body = normalizedBody(message.body);
  return (
    body !== "" &&
    (body === normalizedBody(profile.welcome_message.ar) ||
      body === normalizedBody(profile.welcome_message.en))
  );
}

// ───────────────────────────── conversation state ─────────────────────────────

export type NoticeKind = "awaiting_human" | "assistant_unavailable" | "closed";

/** Which conversation-state notice applies, most important first (null: none). */
export function conversationNotice(
  status: ConversationStatus,
  aiPaused: boolean,
  assistantAvailable: boolean,
): NoticeKind | null {
  if (status === "awaiting_human" || aiPaused) return "awaiting_human";
  if (!assistantAvailable) return "assistant_unavailable";
  if (status === "closed") return "closed";
  return null;
}

// ───────────────────────────── composer ─────────────────────────────

export interface DraftCheck {
  /** Characters counted the way the server counts them (after trimming). */
  length: number;
  ok: boolean;
  problem: "empty" | "too_long" | null;
}

export function checkDraft(text: string): DraftCheck {
  const length = text.trim().length;
  if (length === 0) return { length, ok: false, problem: "empty" };
  if (length > MAX_MESSAGE_LENGTH) return { length, ok: false, problem: "too_long" };
  return { length, ok: true, problem: null };
}

/** Puts a draft that failed to send back in the composer, ahead of anything typed since. */
export function restoreDraft(failed: string, current: string): string {
  if (!current.trim()) return failed;
  if (current.startsWith(failed)) return current;
  return `${failed}\n${current}`;
}

// ───────────────────────────── message text ─────────────────────────────

export type TextSegment =
  { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

const URL_PATTERN = /https?:\/\/[^\s<>"'«»]+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}،؛؟”’"'…]+$/;

/** Splits text into plain parts and http(s) links (nothing else becomes a link). */
export function linkify(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    let url = match[0];
    const trailing = TRAILING_PUNCTUATION.exec(url);
    if (trailing) url = url.slice(0, url.length - trailing[0].length);
    if (!isSafeHttpUrl(url)) continue;
    if (start > cursor) segments.push({ kind: "text", text: text.slice(cursor, start) });
    segments.push({ kind: "link", text: url, href: url });
    cursor = start + url.length;
  }
  if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) });
  return segments;
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname !== "";
  } catch {
    return false;
  }
}

/** "tel:" href for a phone number as stored (+9665…, 997). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
