// Minimal client for the WhatsApp Business Platform Cloud API (Meta Graph API).
//
// Every failure, including timeouts and network errors, becomes a GraphError
// so callers can record an honest failure. The access token is sent only in
// the Authorization header and is scrubbed from anything Meta echoes back, so
// it can never reach an error message, a log line or the database.

import { ConfigError, optionalEnv } from "../env.ts";
import { e164ToWaId } from "../phone.ts";

export interface GraphConfig {
  accessToken: string;
  phoneNumberId: string;
  version?: string;
  fetchImpl?: typeof fetch;
}

interface RequestConfig {
  accessToken: string;
  version?: string;
  fetchImpl?: typeof fetch;
}

const GRAPH_BASE = "https://graph.facebook.com";
const DEFAULT_VERSION = "v26.0";
const TIMEOUT_MS = 15_000;
const VERSION_PATTERN = /^v\d{1,3}\.\d{1,3}$/;
const ID_PATTERN = /^\d{1,64}$/;
const RECIPIENT_PATTERN = /^\d{6,20}$/;
// Meta access tokens (user, system user, page) all start with "EAA".
const TOKEN_LIKE = /EAA[A-Za-z0-9_-]{10,}/g;

export class GraphError extends Error {
  constructor(
    /** HTTP status from Meta; 0 when Meta could not be reached or did not answer in time. */
    readonly status: number,
    readonly code: number | null,
    readonly subcode: number | null,
    readonly metaMessage: string | null,
    readonly fbtraceId: string | null,
  ) {
    super(`WhatsApp API request failed (HTTP ${status}${code === null ? "" : `, code ${code}`})`);
    this.name = "GraphError";
  }

  /** Free-form message outside the 24-hour customer service window. */
  get windowClosed(): boolean {
    return this.code === 131047;
  }

  /** Token invalid, expired or lacking permissions. */
  get authFailed(): boolean {
    return this.status === 401 || this.code === 190;
  }

  /** The recipient cannot receive messages from this business number. */
  get recipientUnavailable(): boolean {
    return this.code === 131026 || this.code === 131030;
  }
}

/** One-line description suitable for integration_settings.last_error and the dashboard. */
export function graphErrorSummary(error: GraphError): string {
  const reason = error.status === 0
    ? "Meta could not be reached"
    : error.authFailed
    ? "Meta rejected the access token"
    : error.windowClosed
    ? "The 24-hour customer service window is closed"
    : error.recipientUnavailable
    ? "The recipient cannot receive WhatsApp messages from this number"
    : "Meta returned an error";
  const code = error.code === null ? "" : ` (code ${error.code})`;
  const detail = error.metaMessage ? `: ${error.metaMessage}` : "";
  return `${reason}${code}${detail}`.slice(0, 500);
}

function graphVersion(explicit: string | undefined): string {
  const version = explicit ?? optionalEnv("WHATSAPP_GRAPH_VERSION") ?? DEFAULT_VERSION;
  // The version becomes part of the URL path; a malformed value is a deployment mistake.
  if (!VERSION_PATTERN.test(version)) throw new ConfigError("WHATSAPP_GRAPH_VERSION");
  return version;
}

function scrub(text: string, token: string): string {
  let out = text;
  if (token !== "") out = out.split(token).join("[redacted]");
  return out.replace(TOKEN_LIKE, "[redacted]");
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scrubbedText(value: unknown, token: string): string | null {
  return typeof value === "string" && value !== "" ? scrub(value, token).slice(0, 500) : null;
}

function errorFromPayload(status: number, payload: unknown, token: string): GraphError {
  const error = asObject(asObject(payload)?.error);
  const message = scrubbedText(error?.message, token);
  // error_data.details carries the useful explanation (e.g. why 131047 happened).
  const details = scrubbedText(asObject(error?.error_data)?.details, token);
  const combined = message && details && !message.includes(details)
    ? `${message} (${details})`.slice(0, 500)
    : message ?? details;
  return new GraphError(
    status,
    finiteNumber(error?.code),
    finiteNumber(error?.error_subcode),
    combined,
    typeof error?.fbtrace_id === "string" ? error.fbtrace_id.slice(0, 64) : null,
  );
}

function pathId(value: string): string {
  // Ids become URL path segments: digits only, so a value can never redirect the request.
  if (!ID_PATTERN.test(value)) throw new TypeError("WhatsApp ids must be numeric");
  return value;
}

async function request(
  cfg: RequestConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const url = `${GRAPH_BASE}/${graphVersion(cfg.version)}/${path}`;
  const doFetch = cfg.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    // The underlying error is not kept: some runtimes echo request details (headers) into it.
    const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new GraphError(0, null, null, timedOut ? "Request to Meta timed out" : "Could not connect to Meta", null);
  }

  let payload: unknown = null;
  try {
    const text = await response.text();
    payload = text === "" ? null : JSON.parse(text);
  } catch {
    payload = null;
  }
  const object = asObject(payload);
  if (!response.ok || object === null || object.error !== undefined) {
    throw errorFromPayload(response.ok ? 502 : response.status, payload, cfg.accessToken);
  }
  return object;
}

function recipient(to: string): string {
  const digits = e164ToWaId(to.trim());
  if (!RECIPIENT_PATTERN.test(digits)) throw new TypeError("Recipient must be an E.164 number or WhatsApp ID");
  return digits;
}

function messageIdOf(payload: Record<string, unknown>): { messageId: string } {
  const first = Array.isArray(payload.messages) ? asObject(payload.messages[0]) : null;
  const messageId = first?.id;
  // Without an id there is no evidence Meta accepted the message, so it is not reported as sent.
  if (typeof messageId !== "string" || messageId === "") {
    throw new GraphError(502, null, null, "Meta did not return a message id", null);
  }
  return { messageId };
}

export async function sendText(cfg: GraphConfig, to: string, body: string): Promise<{ messageId: string }> {
  const payload = await request(cfg, "POST", `${pathId(cfg.phoneNumberId)}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient(to),
    type: "text",
    text: { preview_url: false, body },
  });
  return messageIdOf(payload);
}

export async function sendTemplate(
  cfg: GraphConfig,
  to: string,
  template: { name: string; language: string; bodyParams: string[] },
): Promise<{ messageId: string }> {
  // Meta rejects template parameters containing newlines, tabs or more than four consecutive spaces.
  const parameters = template.bodyParams.map((text) => ({
    type: "text",
    text: text.replace(/[\t\r\n]+/g, " ").replace(/ {5,}/g, "    "),
  }));
  const components = parameters.length === 0 ? [] : [{ type: "body", parameters }];
  const payload = await request(cfg, "POST", `${pathId(cfg.phoneNumberId)}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient(to),
    type: "template",
    template: { name: template.name, language: { code: template.language }, components },
  });
  return messageIdOf(payload);
}

export async function getPhoneNumberInfo(
  cfg: GraphConfig,
): Promise<{ displayPhoneNumber: string | null; verifiedName: string | null; qualityRating: string | null }> {
  const payload = await request(
    cfg,
    "GET",
    `${pathId(cfg.phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
  );
  const field = (
    value: unknown,
    max: number,
  ) => (typeof value === "string" && value !== "" ? value.slice(0, max) : null);
  return {
    displayPhoneNumber: field(payload.display_phone_number, 32),
    verifiedName: field(payload.verified_name, 200),
    qualityRating: field(payload.quality_rating, 32),
  };
}

/**
 * Subscribes the app to the WhatsApp Business Account so its webhooks are delivered.
 * Resolves to Meta's `success` flag; throws GraphError when the call itself fails.
 */
export async function subscribeApp(
  cfg: { accessToken: string; wabaId: string; version?: string; fetchImpl?: typeof fetch },
): Promise<boolean> {
  const payload = await request(cfg, "POST", `${pathId(cfg.wabaId)}/subscribed_apps`);
  return payload.success === true;
}
