// Patient-facing web chat (anonymous). See docs/API.md, "public-chat".
//
// A visitor is identified only by a random session token held in their
// browser. The database stores its SHA-256, never the token, so a database
// leak cannot be replayed into someone's chat. The clinic is always taken
// from a trusted row (the slug lookup or the conversation found by hash),
// never from the request.

import { randomToken, sha256Hex } from "../_shared/crypto.ts";
import { type Db, dbFailure, writeAudit } from "../_shared/db.ts";
import { z } from "../_shared/deps.ts";
import { type Handler, HttpError, json, parse, readJson } from "../_shared/http.ts";
import { log } from "../_shared/log.ts";
import { MESSAGE_COLUMNS, type StoredMessage, storeOutbound } from "../_shared/messages.ts";
import { clientIpHash, rateLimit } from "../_shared/ratelimit.ts";
import { type ClinicSettings, SETTINGS_COLUMNS } from "../_shared/assistant/knowledge.ts";
import { isLanguage, type Language } from "../_shared/assistant/language.ts";
import { defaultWelcome, privacyNotice } from "../_shared/assistant/notices.ts";
import {
  checkAvailability,
  type ConversationStatus,
  handleInboundMessage,
  type PipelineDeps,
  type PipelineInput,
  type PipelineResult,
} from "../_shared/assistant/pipeline.ts";

export interface PublicChatDeps {
  db: () => Db;
  pipeline?: (input: PipelineInput, deps?: PipelineDeps) => Promise<PipelineResult>;
  pipelineDeps?: PipelineDeps;
  now?: () => Date;
}

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/, "Invalid clinic link");
// randomToken(32) is 43 base64url characters; accept a little slack, nothing else.
const sessionToken = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/, "Invalid session");

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("profile"), slug }),
  z.object({
    action: z.literal("start"),
    slug,
    consent: z.literal(true, { error: "The privacy notice must be accepted" }),
    language: z.enum(["ar", "en"]).optional(),
  }),
  z.object({
    action: z.literal("send"),
    session_token: sessionToken,
    message: z.string().trim().min(1).max(1000),
  }),
  z.object({
    action: z.literal("poll"),
    session_token: sessionToken,
    after: z.iso.datetime({ offset: true }).optional(),
  }),
  z.object({ action: z.literal("delete"), session_token: sessionToken }),
]);

type ChatRequest = z.infer<typeof requestSchema>;

export interface ApiMessage {
  id: string;
  direction: "inbound" | "outbound";
  sender: "customer" | "assistant" | "staff" | "system";
  body: string;
  created_at: string;
}

function toApiMessage(message: StoredMessage): ApiMessage {
  return {
    id: message.id,
    direction: message.direction,
    sender: message.sender,
    body: message.body,
    created_at: message.created_at,
  };
}

interface Clinic {
  id: string;
  name: string;
  slug: string;
  defaultLanguage: Language;
  settings: ClinicSettings;
}

/** A clinic by its public link, only if it has turned public chat on. Otherwise 404. */
async function findClinic(db: Db, clinicSlug: string): Promise<Clinic> {
  const { data: org, error } = await db
    .from("organizations")
    .select("id, name, slug, default_language")
    .eq("slug", clinicSlug)
    .maybeSingle();
  if (error) dbFailure("chat_org_lookup", error);
  if (!org) throw new HttpError(404, "not_found", "Clinic not found");
  const row = org as { id: string; name: string; slug: string; default_language: string };

  const { data: settings, error: settingsError } = await db
    .from("clinic_settings")
    .select(SETTINGS_COLUMNS)
    .eq("organization_id", row.id)
    .eq("public_chat_enabled", true)
    .maybeSingle();
  if (settingsError) dbFailure("chat_settings_lookup", settingsError);
  if (!settings) throw new HttpError(404, "not_found", "Clinic not found");
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    defaultLanguage: isLanguage(row.default_language) ? row.default_language : "ar",
    settings: settings as unknown as ClinicSettings,
  };
}

function displayName(clinic: Clinic, language: Language): string {
  const display = language === "ar" ? clinic.settings.display_name_ar : clinic.settings.display_name_en;
  return display?.trim() || clinic.name;
}

function welcomeMessage(clinic: Clinic, language: Language): string {
  const custom = (language === "ar" ? clinic.settings.welcome_message_ar : clinic.settings.welcome_message_en)?.trim();
  return custom || defaultWelcome(language, displayName(clinic, language));
}

function noticeFor(clinic: Clinic, language: Language): string {
  return privacyNotice(language, {
    clinicName: displayName(clinic, language),
    retentionDays: clinic.settings.message_retention_days,
    customAr: clinic.settings.privacy_notice_ar,
    customEn: clinic.settings.privacy_notice_en,
  });
}

interface WebConversation {
  id: string;
  organization_id: string;
  status: ConversationStatus;
  ai_paused: boolean;
}

/** The visitor's conversation by token hash; the clinic comes from that row. Unknown token → 404. */
async function findConversation(db: Db, tokenHash: string): Promise<WebConversation> {
  const { data, error } = await db
    .from("conversations")
    .select("id, organization_id, status, ai_paused")
    .eq("web_session_hash", tokenHash)
    .eq("channel", "web")
    .maybeSingle();
  if (error) dbFailure("chat_conversation_lookup", error);
  if (!data) throw new HttpError(404, "not_found", "Chat session not found");
  return data as WebConversation;
}

async function conversationState(db: Db, conversation: WebConversation): Promise<WebConversation> {
  const { data, error } = await db
    .from("conversations")
    .select("id, organization_id, status, ai_paused")
    .eq("id", conversation.id)
    .eq("organization_id", conversation.organization_id)
    .maybeSingle();
  if (error) dbFailure("chat_conversation_state", error);
  return (data as WebConversation | null) ?? conversation;
}

export function createPublicChatHandler(deps: PublicChatDeps): Handler {
  const now = deps.now ?? (() => new Date());
  const pipeline = deps.pipeline ?? handleInboundMessage;

  async function profile(req: Request, db: Db, body: Extract<ChatRequest, { action: "profile" }>) {
    const clinic = await findClinic(db, body.slug);
    const availability = await checkAvailability(db, clinic.id, clinic.settings);
    const s = clinic.settings;
    return json(req, {
      clinic: {
        name: displayName(clinic, clinic.defaultLanguage),
        slug: clinic.slug,
        assistant_name: s.assistant_name,
        welcome_message: { ar: welcomeMessage(clinic, "ar"), en: welcomeMessage(clinic, "en") },
        privacy_notice: { ar: noticeFor(clinic, "ar"), en: noticeFor(clinic, "en") },
        reception_phone: s.reception_phone,
        emergency_number: s.emergency_number,
        default_language: clinic.defaultLanguage,
        assistant_available: availability.available,
      },
    });
  }

  async function start(req: Request, db: Db, body: Extract<ChatRequest, { action: "start" }>) {
    await rateLimit(db, `chat-start:${await clientIpHash(req)}`, 10, 3600);
    const clinic = await findClinic(db, body.slug);
    const language = body.language ?? clinic.defaultLanguage;
    const token = randomToken(32);
    const at = now().toISOString();

    const { data, error } = await db
      .from("conversations")
      .insert({
        organization_id: clinic.id,
        channel: "web",
        web_session_hash: await sha256Hex(token),
        language,
        consent_at: at,
        // The visitor accepted the notice on the consent screen before this call.
        privacy_notice_sent_at: at,
      })
      .select("id")
      .single();
    if (error || !data) dbFailure("chat_start", error ?? {});
    const conversationId = (data as { id: string }).id;

    const welcome = await storeOutbound(db, {
      organizationId: clinic.id,
      conversationId,
      sender: "system",
      body: welcomeMessage(clinic, language),
      status: "sent",
    });
    log.info("chat.started", { organization_id: clinic.id, conversation_id: conversationId });
    return json(req, { session_token: token, messages: [toApiMessage(welcome)] });
  }

  async function send(req: Request, db: Db, body: Extract<ChatRequest, { action: "send" }>) {
    const tokenHash = await sha256Hex(body.session_token);
    await rateLimit(db, `chat-send:session:${tokenHash}`, 20, 600);
    await rateLimit(db, `chat-send:ip:${await clientIpHash(req)}`, 60, 600);
    const conversation = await findConversation(db, tokenHash);
    const organizationId = conversation.organization_id;

    const { error } = await db
      .from("messages")
      .insert({
        organization_id: organizationId,
        conversation_id: conversation.id,
        direction: "inbound",
        sender: "customer",
        body: body.message,
        status: "received",
      });
    if (error) dbFailure("chat_inbound", error);

    const result = await pipeline({
      db,
      organizationId,
      conversationId: conversation.id,
      channel: "web",
      text: body.message,
      customerPhone: null,
    }, deps.pipelineDeps);

    // Web chat has no delivery step: a stored reply is what the visitor's page shows.
    const stored: ApiMessage[] = [];
    for (const message of result.outbound) {
      const saved = await storeOutbound(db, {
        organizationId,
        conversationId: conversation.id,
        sender: message.sender,
        body: message.body,
        status: "sent",
        aiModel: message.aiModel ?? null,
        inputTokens: message.inputTokens ?? null,
        outputTokens: message.outputTokens ?? null,
      });
      stored.push(toApiMessage(saved));
    }
    log.info("chat.message", {
      organization_id: organizationId,
      conversation_id: conversation.id,
      outcome: result.outcome,
      replies: stored.length,
    });
    return json(req, { messages: stored, status: result.status, ai_paused: result.aiPaused });
  }

  async function poll(req: Request, db: Db, body: Extract<ChatRequest, { action: "poll" }>) {
    const tokenHash = await sha256Hex(body.session_token);
    await rateLimit(db, `chat-poll:session:${tokenHash}`, 30, 60);
    const conversation = await findConversation(db, tokenHash);

    let query = db
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("organization_id", conversation.organization_id)
      .eq("conversation_id", conversation.id);
    if (body.after) {
      query = query.gt("created_at", new Date(body.after).toISOString());
    }
    const { data, error } = body.after
      ? await query.order("created_at", { ascending: true }).limit(200)
      : await query.order("created_at", { ascending: false }).limit(50);
    if (error) dbFailure("chat_poll", error);
    const rows = (data ?? []) as unknown as StoredMessage[];
    const messages = (body.after ? rows : rows.slice().reverse()).map(toApiMessage);
    const state = await conversationState(db, conversation);
    return json(req, { messages, status: state.status, ai_paused: state.ai_paused });
  }

  async function remove(req: Request, db: Db, body: Extract<ChatRequest, { action: "delete" }>) {
    const tokenHash = await sha256Hex(body.session_token);
    await rateLimit(db, `chat-delete:session:${tokenHash}`, 10, 600);
    const conversation = await findConversation(db, tokenHash);
    // Messages go with the conversation (ON DELETE CASCADE).
    const { error } = await db
      .from("conversations")
      .delete()
      .eq("id", conversation.id)
      .eq("organization_id", conversation.organization_id);
    if (error) dbFailure("chat_delete", error);
    await writeAudit(db, {
      organizationId: conversation.organization_id,
      actorType: "system",
      action: "conversation.deleted_by_customer",
      entityType: "conversations",
      entityId: conversation.id,
      details: { channel: "web" },
    });
    return json(req, { deleted: true });
  }

  return async (req) => {
    const body = parse(requestSchema, await readJson(req, 16 * 1024));
    const db = deps.db();
    switch (body.action) {
      case "profile":
        return await profile(req, db, body);
      case "start":
        return await start(req, db, body);
      case "send":
        return await send(req, db, body);
      case "poll":
        return await poll(req, db, body);
      case "delete":
        return await remove(req, db, body);
    }
  };
}
