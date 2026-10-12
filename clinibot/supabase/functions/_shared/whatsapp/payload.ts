// Parsing of WhatsApp Cloud API webhook payloads.
//
// The body is attacker-reachable until the signature is checked and Meta adds
// fields over time, so parsing is defensive: anything with an unexpected shape
// is skipped, nothing throws, and every array is capped so one request cannot
// fan out into unbounded work.

export interface InboundMessage {
  id: string;
  /** The customer's WhatsApp ID (international number, digits only). */
  from: string;
  timestamp: Date;
  type: string;
  /** Text for text messages and button/list replies; null for media and other types. */
  text: string | null;
  profileName: string | null;
}

export interface StatusUpdate {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: Date;
  recipientId: string | null;
  errors: { code: number; title: string; message: string | null; details: string | null }[];
}

export interface WebhookChange {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  messages: InboundMessage[];
  statuses: StatusUpdate[];
}

const MAX_ITEMS = 50;
const MAX_ID_LENGTH = 256;
// Matches the messages.body limit.
const MAX_TEXT = 4096;
const STATUSES = new Set(["sent", "delivered", "read", "failed"]);

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, MAX_ITEMS) : [];
}

/** Identifiers: rejected (not truncated) when too long, since a cut id would point at something else. */
function str(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value !== "" && value.length <= maxLength ? value : null;
}

function id(value: unknown): string | null {
  return str(value, MAX_ID_LENGTH);
}

/** Human text: truncated rather than dropped, so a long message is still received. */
function text(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value !== "" ? value.slice(0, maxLength) : null;
}

/** Meta timestamps are Unix seconds, sent as a string. */
function unixSeconds(value: unknown): Date | null {
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  if (!/^\d{1,12}$/.test(raw)) return null;
  const date = new Date(Number(raw) * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function messageText(message: Obj): string | null {
  const interactive = obj(message.interactive);
  return (
    text(obj(message.text)?.body, MAX_TEXT) ??
      text(obj(interactive?.button_reply)?.title, MAX_TEXT) ??
      text(obj(interactive?.list_reply)?.title, MAX_TEXT) ??
      text(obj(message.button)?.text, MAX_TEXT)
  );
}

function profileNames(contacts: unknown): { byWaId: Map<string, string>; only: string | null } {
  const byWaId = new Map<string, string>();
  const names: string[] = [];
  for (const raw of list(contacts)) {
    const contact = obj(raw);
    const name = text(obj(contact?.profile)?.name, 120);
    if (!name) continue;
    names.push(name);
    const waId = id(contact?.wa_id);
    if (waId) byWaId.set(waId, name);
  }
  return { byWaId, only: names.length === 1 ? names[0] ?? null : null };
}

function parseMessage(raw: unknown, names: ReturnType<typeof profileNames>): InboundMessage | null {
  const message = obj(raw);
  if (!message) return null;
  const messageId = id(message.id);
  const from = str(message.from, 32);
  const timestamp = unixSeconds(message.timestamp);
  if (!messageId || !from || !timestamp) return null;
  return {
    id: messageId,
    from,
    timestamp,
    type: str(message.type, 64) ?? "unknown",
    text: messageText(message),
    profileName: names.byWaId.get(from) ?? names.only,
  };
}

function parseStatus(raw: unknown): StatusUpdate | null {
  const status = obj(raw);
  if (!status) return null;
  const messageId = id(status.id);
  const value = status.status;
  const timestamp = unixSeconds(status.timestamp);
  if (!messageId || typeof value !== "string" || !STATUSES.has(value) || !timestamp) return null;
  const errors: StatusUpdate["errors"] = [];
  for (const rawError of list(status.errors)) {
    const error = obj(rawError);
    if (!error || typeof error.code !== "number" || !Number.isFinite(error.code)) continue;
    errors.push({
      code: error.code,
      title: text(error.title, 1000) ?? "",
      message: text(error.message, 1000),
      details: text(obj(error.error_data)?.details, 1000),
    });
  }
  return {
    id: messageId,
    status: value as StatusUpdate["status"],
    timestamp,
    recipientId: id(status.recipient_id),
    errors,
  };
}

function parseChange(raw: unknown): WebhookChange | null {
  const change = obj(raw);
  if (!change || change.field !== "messages") return null;
  const value = obj(change.value);
  const metadata = obj(value?.metadata);
  const phoneNumberId = id(metadata?.phone_number_id);
  if (!value || !phoneNumberId) return null;
  const names = profileNames(value.contacts);
  const messages: InboundMessage[] = [];
  for (const item of list(value.messages)) {
    const parsed = parseMessage(item, names);
    if (parsed) messages.push(parsed);
  }
  const statuses: StatusUpdate[] = [];
  for (const item of list(value.statuses)) {
    const parsed = parseStatus(item);
    if (parsed) statuses.push(parsed);
  }
  return { phoneNumberId, displayPhoneNumber: text(metadata?.display_phone_number, 32), messages, statuses };
}

/** Extracts message and status changes from a webhook body. Returns [] for anything unrecognised. */
export function parseWebhook(body: unknown): WebhookChange[] {
  const root = obj(body);
  if (!root || root.object !== "whatsapp_business_account") return [];
  const changes: WebhookChange[] = [];
  for (const rawEntry of list(root.entry)) {
    for (const rawChange of list(obj(rawEntry)?.changes)) {
      const parsed = parseChange(rawChange);
      if (parsed) changes.push(parsed);
    }
  }
  return changes;
}
