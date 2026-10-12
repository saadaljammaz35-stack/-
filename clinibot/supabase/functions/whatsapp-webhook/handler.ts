// whatsapp-webhook: Meta's verification handshake (GET) and event delivery
// (POST) for one clinic's WhatsApp number (see docs/API.md).
//
// The clinic is derived only from the webhook key in the URL; nothing in the
// body is trusted until its HMAC matches that clinic's app secret, and even
// then events for any phone number other than the clinic's are dropped. Meta
// gets its 200 before the assistant runs, so slow AI replies never trigger
// Meta's retries; retries that do arrive are recognised as duplicates.

import { sha256Hex, timingSafeEqual } from "../_shared/crypto.ts";
import { type Db, dbFailure, serviceClient, writeAudit } from "../_shared/db.ts";
import { z } from "../_shared/deps.ts";
import { ConfigError } from "../_shared/env.ts";
import { type Handler, HttpError, json, type RequestContext } from "../_shared/http.ts";
import { log } from "../_shared/log.ts";
import { markDelivery, MAX_BODY, storeOutbound } from "../_shared/messages.ts";
import { waIdToE164 } from "../_shared/phone.ts";
import { isLanguage, type Language } from "../_shared/assistant/language.ts";
import {
  handleInboundMessage,
  type PipelineInput,
  type PipelineOutbound,
  type PipelineResult,
} from "../_shared/assistant/pipeline.ts";
import { GraphError, graphErrorSummary, sendText } from "../_shared/whatsapp/graph.ts";
import {
  type Credentials,
  graphConfig,
  type IntegrationRow,
  loadCredentials,
  loadIntegrationByWebhookKey,
} from "../_shared/whatsapp/integration.ts";
import { graphErrorCode, recordIntegrationError } from "../_shared/whatsapp/outbound.ts";
import { type InboundMessage, parseWebhook, type StatusUpdate } from "../_shared/whatsapp/payload.ts";
import { verifyMetaSignature } from "../_shared/whatsapp/signature.ts";
import { withinServiceWindow } from "../_shared/whatsapp/window.ts";

// Supabase's runtime global for work that outlives the response; absent in plain Deno and in tests.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

export interface Deps {
  db: Db;
  fetch: typeof fetch;
  now: () => Date;
  pipeline: (input: PipelineInput) => Promise<PipelineResult>;
  /** Keeps processing alive after the response. Undefined: processing is awaited before responding. */
  waitUntil?: (work: Promise<unknown>) => void;
}

function edgeWaitUntil(): ((work: Promise<unknown>) => void) | undefined {
  if (typeof EdgeRuntime === "undefined" || EdgeRuntime === undefined) return undefined;
  const runtime = EdgeRuntime;
  return (work) => runtime.waitUntil(work);
}

export function liveDeps(): Deps {
  return {
    db: serviceClient(),
    fetch: globalThis.fetch,
    now: () => new Date(),
    pipeline: (input) => handleInboundMessage(input),
    waitUntil: edgeWaitUntil(),
  };
}

// webhook_key is 18 random bytes in hex.
const WEBHOOK_KEY = /^[0-9a-f]{36}$/;
// Meta's deliveries are a few KB; the cap only stops abuse of an unauthenticated endpoint.
const MAX_WEBHOOK_BYTES = 1024 * 1024;
// One delivery normally carries one message; the cap bounds AI calls and sends per request.
const MAX_MESSAGES = 20;
const MAX_STATUSES = 100;
// Not something the customer asked: a reaction or a number-change event gets no "please type" notice.
const NO_NOTICE_TYPES = new Set(["reaction", "system"]);

const Handshake = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string().min(1).max(256),
  // Echoed back verbatim, so only short printable ASCII is accepted (Meta sends digits).
  "hub.challenge": z.string().regex(/^[\x21-\x7E]{1,200}$/),
});

const IngestRow = z.object({
  conversation_id: z.uuid().nullable(),
  message_id: z.uuid().nullable(),
  is_duplicate: z.boolean(),
  ai_paused: z.boolean().nullable(),
  opted_out: z.boolean().nullable(),
  language: z.string().nullable(),
});

type Ingested = z.infer<typeof IngestRow>;

const TYPE_NOTICE: Record<Language, string> = {
  ar: "عذرًا، لا أستطيع قراءة الصور أو الرسائل الصوتية أو المرفقات. يُرجى كتابة سؤالك في رسالة نصية لنتمكن من مساعدتك.",
  en: "Sorry, I can't read images, voice notes or attachments. Please type your question as a text message so " +
    "we can help you.",
};

/** The notice sent for a message without text. Constant, so a repeat can be recognised and not sent twice. */
export function typeQuestionNotice(language: Language): string {
  return TYPE_NOTICE[language];
}

function isTypeQuestionNotice(body: string | null | undefined): boolean {
  return body === TYPE_NOTICE.ar || body === TYPE_NOTICE.en;
}

function forbidden(): HttpError {
  return new HttpError(403, "forbidden", "Verification failed");
}

function notFound(): HttpError {
  return new HttpError(404, "not_found", "Unknown webhook");
}

function unauthorized(): HttpError {
  return new HttpError(401, "unauthorized", "Invalid signature");
}

function webhookKey(req: Request): string {
  return new URL(req.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
}

/** Error class only: messages from the database or Meta can quote values and never reach the logs. */
function errorFields(error: unknown): Record<string, unknown> {
  return {
    error_name: error instanceof Error ? error.name : typeof error,
    code: error instanceof HttpError ? error.code : error instanceof ConfigError ? error.variable : undefined,
  };
}

/** The raw body, byte for byte: the signature covers the exact bytes Meta sent. */
async function readBody(req: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "payload_too_large");
  if (req.body === null) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, "payload_too_large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

// ───────────────────────────── GET: verification handshake ─────────────────────────────

async function verifyHandshake(req: Request, deps: Deps, key: string): Promise<Response> {
  const { db } = deps;
  const params = new URL(req.url).searchParams;
  const parsed = Handshake.safeParse({
    "hub.mode": params.get("hub.mode") ?? undefined,
    "hub.verify_token": params.get("hub.verify_token") ?? undefined,
    "hub.challenge": params.get("hub.challenge") ?? undefined,
  });
  // One answer for every failure, so the handshake cannot be used to probe keys or tokens.
  if (!WEBHOOK_KEY.test(key) || !parsed.success) throw forbidden();

  const integration = await loadIntegrationByWebhookKey(db, key);
  if (!integration) throw forbidden();
  const credentials = await loadCredentials(db, integration);
  if (!credentials?.verifyTokenHash) {
    log.warn("whatsapp_webhook.handshake_without_credentials", { integration_id: integration.id });
    throw forbidden();
  }
  const presented = await sha256Hex(parsed.data["hub.verify_token"]);
  if (!timingSafeEqual(presented, credentials.verifyTokenHash)) {
    log.warn("whatsapp_webhook.handshake_rejected", { integration_id: integration.id });
    throw forbidden();
  }

  // "connected" needs verified credentials too; a recorded error stays until whatsapp-connect's test clears it.
  const promote = integration.credentials_verified_at !== null &&
    (integration.status === "credentials_verified" || integration.status === "connected");
  const status = promote ? "connected" : integration.status;
  const { error } = await db
    .from("integration_settings")
    .update({ webhook_verified_at: deps.now().toISOString(), ...(promote ? { status: "connected" } : {}) })
    .eq("id", integration.id)
    .eq("organization_id", integration.organization_id);
  if (error) dbFailure("webhook_verified_update", error);

  await writeAudit(db, {
    organizationId: integration.organization_id,
    actorType: "webhook",
    action: "whatsapp.webhook_verified",
    entityType: "integration_settings",
    entityId: integration.id,
    details: { status },
  });
  log.info("whatsapp_webhook.verified", { integration_id: integration.id, status });

  return new Response(parsed.data["hub.challenge"], {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ───────────────────────────── POST: event delivery ─────────────────────────────

interface Delivery {
  deps: Deps;
  integration: IntegrationRow;
  credentials: Credentials;
  requestId: string;
  /** The integration is flagged once per delivery, not once per failed send. */
  integrationFlagged: boolean;
  /** Conversations that already got the "please type" notice in this delivery. */
  noticeSent: Set<string>;
  clinicLanguage?: Language;
}

function baseFields(delivery: Delivery): Record<string, unknown> {
  return {
    request_id: delivery.requestId,
    organization_id: delivery.integration.organization_id,
    integration_id: delivery.integration.id,
  };
}

async function applyStatus(delivery: Delivery, status: StatusUpdate): Promise<"applied" | "ignored" | "unknown"> {
  const { db } = delivery.deps;
  const organizationId = delivery.integration.organization_id;
  // apply_whatsapp_status matches on the wamid alone; the message must first be shown to be this clinic's.
  const { data, error } = await db
    .from("messages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("wa_message_id", status.id)
    .eq("direction", "outbound")
    .maybeSingle();
  if (error) dbFailure("webhook_status_owner", error);
  if (!data) return "unknown";

  const first = status.errors[0];
  const detail = first ? [first.title, first.details ?? first.message].filter((part) => !!part).join(": ") : "";
  const { data: applied, error: rpcError } = await db.rpc("apply_whatsapp_status", {
    p_wa_message_id: status.id,
    p_status: status.status,
    p_error_code: first ? String(first.code) : null,
    p_error_detail: detail === "" ? null : detail.slice(0, 1000),
  });
  if (rpcError) dbFailure("apply_whatsapp_status", rpcError);
  return applied === true ? "applied" : "ignored";
}

async function ingest(delivery: Delivery, message: InboundMessage, body: string): Promise<Ingested | null> {
  const { data, error } = await delivery.deps.db.rpc("ingest_whatsapp_inbound", {
    p_org: delivery.integration.organization_id,
    p_wa_id: message.from,
    p_customer_name: message.profileName,
    p_wa_message_id: message.id,
    p_body: body,
    p_received_at: message.timestamp.toISOString(),
  });
  if (error) dbFailure("ingest_whatsapp_inbound", error);
  const parsed = z.array(IngestRow).min(1).safeParse(data);
  if (!parsed.success) {
    log.error("whatsapp_webhook.ingest_unreadable", baseFields(delivery));
    return null;
  }
  return parsed.data[0] ?? null;
}

/** Hands the conversation to reception when the customer could not get an automated reply. */
async function flagForStaff(delivery: Delivery, conversationId: string): Promise<void> {
  const { error } = await delivery.deps.db
    .from("conversations")
    .update({ status: "awaiting_human" })
    .eq("id", conversationId)
    .eq("organization_id", delivery.integration.organization_id);
  if (error) {
    log.error("whatsapp_webhook.flag_failed", {
      ...baseFields(delivery),
      conversation_id: conversationId,
      code: error.code,
    });
  }
}

/** Stores the reply as pending, sends it, then records exactly what Meta answered. True once Meta accepted it. */
async function sendReply(
  delivery: Delivery,
  conversationId: string,
  to: string,
  outbound: PipelineOutbound,
): Promise<boolean> {
  const { db, fetch, now } = delivery.deps;
  const organizationId = delivery.integration.organization_id;
  const body = outbound.body.slice(0, MAX_BODY);
  const pending = await storeOutbound(db, {
    organizationId,
    conversationId,
    sender: outbound.sender,
    body,
    status: "pending",
    aiModel: outbound.aiModel ?? null,
    inputTokens: outbound.inputTokens ?? null,
    outputTokens: outbound.outputTokens ?? null,
  });
  const fields = { ...baseFields(delivery), conversation_id: conversationId, message_id: pending.id };

  let messageId: string;
  try {
    const cfg = { ...graphConfig(delivery.integration, delivery.credentials), fetchImpl: fetch };
    ({ messageId } = await sendText(cfg, to, body));
  } catch (error) {
    if (!(error instanceof GraphError)) {
      log.error("whatsapp_webhook.send_crashed", { ...fields, ...errorFields(error) });
      await markDelivery(db, pending.id, organizationId, {
        status: "failed",
        errorCode: error instanceof ConfigError ? "not_configured" : "internal_error",
      });
      return false;
    }
    log.warn("whatsapp_webhook.send_failed", {
      ...fields,
      http_status: error.status,
      meta_code: error.code,
      meta_subcode: error.subcode,
      fbtrace_id: error.fbtraceId,
    });
    await markDelivery(db, pending.id, organizationId, {
      status: "failed",
      errorCode: graphErrorCode(error),
      errorDetail: graphErrorSummary(error),
    });
    if (error.authFailed && !delivery.integrationFlagged) {
      delivery.integrationFlagged = true;
      await recordIntegrationError(db, delivery.integration, error, now());
    }
    return false;
  }
  // Outside the try: Meta accepted the message, so a database failure here must not turn it into "failed".
  await markDelivery(db, pending.id, organizationId, { status: "sent", waMessageId: messageId });
  return true;
}

/** The privacy notice did not reach the customer: clear the mark so it goes out with the next reply. */
async function privacyNoticeNotDelivered(delivery: Delivery, conversationId: string): Promise<void> {
  const { error } = await delivery.deps.db
    .from("conversations")
    .update({ privacy_notice_sent_at: null })
    .eq("id", conversationId)
    .eq("organization_id", delivery.integration.organization_id);
  if (error) {
    log.error("whatsapp_webhook.privacy_notice_reset_failed", {
      ...baseFields(delivery),
      conversation_id: conversationId,
      code: error.code,
    });
  }
}

async function clinicLanguage(delivery: Delivery): Promise<Language> {
  if (delivery.clinicLanguage === undefined) {
    const { data, error } = await delivery.deps.db
      .from("organizations")
      .select("default_language")
      .eq("id", delivery.integration.organization_id)
      .maybeSingle();
    if (error) dbFailure("webhook_clinic_language", error);
    const value = (data as { default_language?: unknown } | null)?.default_language;
    delivery.clinicLanguage = isLanguage(value) ? value : "ar";
  }
  return delivery.clinicLanguage;
}

async function lastOutboundIsNotice(delivery: Delivery, conversationId: string): Promise<boolean> {
  const { data, error } = await delivery.deps.db
    .from("messages")
    .select("body")
    .eq("organization_id", delivery.integration.organization_id)
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) dbFailure("webhook_last_outbound", error);
  return isTypeQuestionNotice((data as { body: string }[] | null)?.[0]?.body);
}

/** Images, voice notes and the like are not read; the customer is asked once to type instead. */
async function answerNonText(
  delivery: Delivery,
  message: InboundMessage,
  ingested: Ingested,
  conversationId: string,
): Promise<void> {
  if (ingested.opted_out || ingested.ai_paused || NO_NOTICE_TYPES.has(message.type)) return;
  if (delivery.noticeSent.has(conversationId)) return;
  delivery.noticeSent.add(conversationId);
  if (await lastOutboundIsNotice(delivery, conversationId)) return;
  const language = isLanguage(ingested.language) ? ingested.language : await clinicLanguage(delivery);
  await sendReply(delivery, conversationId, message.from, { sender: "system", body: typeQuestionNotice(language) });
}

async function handleMessage(delivery: Delivery, message: InboundMessage): Promise<void> {
  const fields = baseFields(delivery);
  const customerPhone = waIdToE164(message.from);
  if (customerPhone === null) {
    log.warn("whatsapp_webhook.invalid_sender", fields);
    return;
  }
  const kind = /^[a-z_]{1,32}$/.test(message.type) ? message.type : "unsupported";
  const ingested = await ingest(delivery, message, message.text ?? `[${kind}]`);
  if (!ingested) return;
  if (ingested.is_duplicate || ingested.conversation_id === null) {
    log.info("whatsapp_webhook.duplicate", fields);
    return;
  }
  const conversationId = ingested.conversation_id;
  const messageFields = { ...fields, conversation_id: conversationId, message_id: ingested.message_id };

  // Meta redelivers for days after failures; free-form replies are only allowed within 24 hours.
  if (!withinServiceWindow(message.timestamp, delivery.deps.now())) {
    log.info("whatsapp_webhook.outside_service_window", messageFields);
    await flagForStaff(delivery, conversationId);
    return;
  }

  if (message.text === null) {
    log.info("whatsapp_webhook.non_text", { ...messageFields, type: kind });
    await answerNonText(delivery, message, ingested, conversationId);
    return;
  }

  let result: PipelineResult;
  try {
    result = await delivery.deps.pipeline({
      db: delivery.deps.db,
      organizationId: delivery.integration.organization_id,
      conversationId,
      channel: "whatsapp",
      text: message.text,
      customerPhone,
    });
  } catch (error) {
    log.error("whatsapp_webhook.pipeline_failed", { ...messageFields, ...errorFields(error) });
    await flagForStaff(delivery, conversationId);
    return;
  }
  log.info("whatsapp_webhook.answered", {
    ...messageFields,
    outcome: result.outcome,
    reply_count: result.outbound.length,
  });

  for (const outbound of result.outbound) {
    let accepted = false;
    try {
      accepted = await sendReply(delivery, conversationId, message.from, outbound);
    } catch (error) {
      log.error("whatsapp_webhook.reply_failed", { ...messageFields, ...errorFields(error) });
    }
    if (outbound.privacyNotice && !accepted) await privacyNoticeNotDelivered(delivery, conversationId);
  }
}

/** Everything after the 200. Each step is isolated: one failure never blocks the rest of the delivery. */
async function processDelivery(delivery: Delivery, body: unknown): Promise<void> {
  const fields = baseFields(delivery);
  const statuses: StatusUpdate[] = [];
  const messages: InboundMessage[] = [];
  for (const change of parseWebhook(body)) {
    if (change.phoneNumberId !== delivery.integration.phone_number_id) {
      log.warn("whatsapp_webhook.foreign_phone_number", fields);
      continue;
    }
    statuses.push(...change.statuses);
    messages.push(...change.messages);
  }

  const tally = { applied: 0, ignored: 0, unknown: 0, failed: 0 };
  if (statuses.length > MAX_STATUSES) {
    log.warn("whatsapp_webhook.statuses_capped", { ...fields, received: statuses.length });
  }
  for (const status of statuses.slice(0, MAX_STATUSES)) {
    try {
      tally[await applyStatus(delivery, status)]++;
    } catch (error) {
      tally.failed++;
      log.error("whatsapp_webhook.status_failed", { ...fields, ...errorFields(error) });
    }
  }

  // Oldest first, so the assistant sees the customer's messages in the order they were written.
  const ordered = messages.slice().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  if (ordered.length > MAX_MESSAGES) {
    log.warn("whatsapp_webhook.messages_capped", { ...fields, received: ordered.length, processed: MAX_MESSAGES });
  }
  for (const message of ordered.slice(0, MAX_MESSAGES)) {
    try {
      await handleMessage(delivery, message);
    } catch (error) {
      log.error("whatsapp_webhook.message_failed", { ...fields, ...errorFields(error) });
    }
  }

  log.info("whatsapp_webhook.processed", {
    ...fields,
    message_count: Math.min(ordered.length, MAX_MESSAGES),
    statuses_applied: tally.applied,
    statuses_ignored: tally.ignored,
    statuses_unknown: tally.unknown,
    statuses_failed: tally.failed,
  });
}

async function receive(req: Request, deps: Deps, key: string, ctx: RequestContext): Promise<Response> {
  if (!WEBHOOK_KEY.test(key)) throw notFound();
  const raw = await readBody(req, MAX_WEBHOOK_BYTES);
  const integration = await loadIntegrationByWebhookKey(deps.db, key);
  if (!integration) throw notFound();

  const credentials = await loadCredentials(deps.db, integration);
  if (!credentials?.appSecret) {
    log.error("whatsapp_webhook.no_app_secret", {
      request_id: ctx.requestId,
      integration_id: integration.id,
      credentials_stored: credentials !== null,
    });
    throw unauthorized();
  }
  if (!(await verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), credentials.appSecret))) {
    log.warn("whatsapp_webhook.bad_signature", { request_id: ctx.requestId, integration_id: integration.id });
    throw unauthorized();
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON");
  }

  const delivery: Delivery = {
    deps,
    integration,
    credentials,
    requestId: ctx.requestId,
    integrationFlagged: false,
    noticeSent: new Set(),
  };
  const work = processDelivery(delivery, body).catch((error) => {
    log.error("whatsapp_webhook.processing_crashed", { ...baseFields(delivery), ...errorFields(error) });
  });
  if (deps.waitUntil) deps.waitUntil(work);
  else await work;
  return json(req, { received: true });
}

export function createHandler(getDeps: () => Deps): Handler {
  return async (req: Request, ctx: RequestContext): Promise<Response> => {
    const deps = getDeps();
    const key = webhookKey(req);
    return req.method === "GET" ? await verifyHandshake(req, deps, key) : await receive(req, deps, key, ctx);
  };
}
