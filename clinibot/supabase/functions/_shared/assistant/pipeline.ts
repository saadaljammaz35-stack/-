// What happens to one inbound customer message, on any channel.
//
// The caller has already stored the inbound message. The pipeline decides
// the replies and updates the conversation; it does not store or send the
// replies (web chat stores them, WhatsApp sends then stores them). Order:
//
//   1 commands (STOP, delete my data)  2 opted out  3 paused (emergency
//   phrases still get the emergency number when paused; nothing after STOP)
//   4 WhatsApp privacy notice on first contact      5 emergency phrases
//   6 assistant availability  7 per-conversation AI limit
//   8 the model  9 price guard  10 usage accounting
//
// AI and API failures never escape: the customer gets a "reception will
// reply" notice and the conversation is flagged for staff.

import { type Db, dbFailure, writeAudit } from "../db.ts";
import { z } from "../deps.ts";
import { optionalSecret } from "../env.ts";
import { HttpError } from "../http.ts";
import { log } from "../log.ts";
import { rateLimit } from "../ratelimit.ts";
import {
  assistantConfig,
  type BetaMessageParam,
  createMessagesClient,
  type MessagesClientLike,
  runAssistant,
  type TokenUsage,
} from "./claude.ts";
import { allowedPrices, clinicDisplayName, type ClinicSettings, loadKnowledge } from "./knowledge.ts";
import { detectLanguage, isLanguage, type Language } from "./language.ts";
import {
  dataDeletedConfirmation,
  emergencyGuidance,
  isUnavailableNotice,
  optedOutConfirmation,
  privacyNotice,
  safeFallback,
  unavailableNotice,
} from "./notices.ts";
import { buildSystem } from "./prompt.ts";
import { checkPrices, detectCommand, detectEmergency } from "./safety.ts";
import { createLiveTools, TOOL_DEFINITIONS } from "./tools.ts";

export type { MessagesClientLike } from "./claude.ts";

export interface PipelineInput {
  db: Db;
  organizationId: string;
  conversationId: string;
  channel: "web" | "whatsapp";
  text: string;
  customerPhone: string | null;
}

export interface PipelineOutbound {
  sender: "assistant" | "system";
  body: string;
  /**
   * The WhatsApp privacy notice. The pipeline records privacy_notice_sent_at when it decides to send it;
   * a channel that fails to deliver it must clear that again so the notice goes out with the next reply.
   */
  privacyNotice?: true;
  aiModel?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export type PipelineOutcome =
  | "answered"
  | "handoff"
  | "emergency"
  | "blocked_price"
  | "refused"
  | "unavailable"
  | "paused"
  | "opted_out"
  | "opted_out_now"
  | "data_deleted"
  | "rate_limited";

export type ConversationStatus = "open" | "awaiting_human" | "closed";

export interface PipelineResult {
  outbound: PipelineOutbound[];
  outcome: PipelineOutcome;
  status: ConversationStatus;
  aiPaused: boolean;
}

export interface PipelineDeps {
  messagesClient?: MessagesClientLike;
  now?: () => Date;
}

interface ConversationRow {
  id: string;
  status: ConversationStatus;
  ai_paused: boolean;
  language: string | null;
  opted_out_at: string | null;
  privacy_notice_sent_at: string | null;
}

const HISTORY_LIMIT = 20;
const AI_LIMIT_PER_HOUR = 30;

// ───────────────────────────── availability ─────────────────────────────

const entitlementsSchema = z.object({
  is_active: z.boolean(),
  ai_replies_remaining: z.number(),
});

export type Entitlements = z.infer<typeof entitlementsSchema>;

/** The clinic's plan state from org_entitlements(). Null when the result cannot be read. */
export async function loadEntitlements(db: Db, organizationId: string): Promise<Entitlements | null> {
  const { data, error } = await db.rpc("org_entitlements", { p_org: organizationId });
  if (error) dbFailure("org_entitlements", error);
  const parsed = entitlementsSchema.safeParse(data);
  if (!parsed.success) {
    log.error("assistant.entitlements_unreadable", { organization_id: organizationId });
    return null;
  }
  return parsed.data;
}

export type UnavailableReason = "disabled" | "not_configured" | "inactive" | "quota" | "entitlements_error";

/** Whether the assistant may answer for this clinic right now, and if not, why. */
export async function checkAvailability(
  db: Db,
  organizationId: string,
  settings: Pick<ClinicSettings, "assistant_enabled">,
): Promise<{ available: true } | { available: false; reason: UnavailableReason }> {
  if (!settings.assistant_enabled) return { available: false, reason: "disabled" };
  if (optionalSecret("ANTHROPIC_API_KEY") === undefined) return { available: false, reason: "not_configured" };
  let entitlements: Entitlements | null;
  try {
    entitlements = await loadEntitlements(db, organizationId);
  } catch (error) {
    // Already logged by dbFailure. Without a plan state nothing is spent, but the customer still reaches reception.
    if (error instanceof HttpError) return { available: false, reason: "entitlements_error" };
    throw error;
  }
  if (!entitlements?.is_active) return { available: false, reason: "inactive" };
  if (entitlements.ai_replies_remaining <= 0) return { available: false, reason: "quota" };
  return { available: true };
}

// ───────────────────────────── database helpers ─────────────────────────────

async function loadConversation(db: Db, organizationId: string, conversationId: string): Promise<ConversationRow> {
  const { data, error } = await db
    .from("conversations")
    .select("id, status, ai_paused, language, opted_out_at, privacy_notice_sent_at")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) dbFailure("pipeline_conversation", error);
  if (!data) throw new HttpError(404, "not_found", "Conversation not found");
  return data as ConversationRow;
}

async function updateConversation(
  db: Db,
  organizationId: string,
  conversationId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const { error } = await db
    .from("conversations")
    .update(patch)
    .eq("id", conversationId)
    .eq("organization_id", organizationId);
  if (error) dbFailure("pipeline_conversation_update", error);
}

/** Only the emergency number, for paused conversations that skip the full knowledge load. */
async function loadEmergencyNumber(db: Db, organizationId: string): Promise<string | null> {
  const { data, error } = await db
    .from("clinic_settings")
    .select("emergency_number")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) dbFailure("pipeline_emergency_number", error);
  return (data as { emergency_number: string | null } | null)?.emergency_number ?? null;
}

async function lastOutboundBody(db: Db, organizationId: string, conversationId: string): Promise<string | null> {
  const { data, error } = await db
    .from("messages")
    .select("body")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) dbFailure("pipeline_last_outbound", error);
  return (data as { body: string } | null)?.body ?? null;
}

interface HistoryRow {
  direction: "inbound" | "outbound";
  sender: "customer" | "assistant" | "staff" | "system";
  body: string;
}

/**
 * Plain-text history for the model: customer → user, assistant and staff →
 * assistant, system notices left out. Thinking blocks are never replayed
 * across turns. The first message must be the customer's.
 */
export function toModelHistory(rows: HistoryRow[], latestText: string): BetaMessageParam[] {
  const messages: BetaMessageParam[] = [];
  for (const row of rows) {
    if (row.sender === "system") continue;
    if (row.sender === "customer") messages.push({ role: "user", content: row.body });
    else if (row.sender === "staff") messages.push({ role: "assistant", content: `[Clinic staff] ${row.body}` });
    else messages.push({ role: "assistant", content: row.body });
  }
  while (messages.length > 0 && messages[0]?.role !== "user") messages.shift();
  // The caller stored the inbound message already; guard against it not being visible yet.
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    messages.push({ role: "user", content: latestText });
  }
  return messages;
}

async function loadHistory(
  db: Db,
  organizationId: string,
  conversationId: string,
  latestText: string,
): Promise<BetaMessageParam[]> {
  const { data, error } = await db
    .from("messages")
    .select("direction, sender, body, created_at")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) dbFailure("pipeline_history", error);
  const rows = ((data ?? []) as HistoryRow[]).slice().reverse();
  return toModelHistory(rows, latestText);
}

export async function recordUsage(db: Db, organizationId: string, usage: TokenUsage, isTest: boolean): Promise<void> {
  const { error } = await db.rpc("record_ai_usage", {
    p_org: organizationId,
    p_input_tokens: usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens,
    p_output_tokens: usage.output_tokens,
    p_is_test: isTest,
  });
  // The reply already happened; losing one usage row must not lose the reply, but it must be visible.
  if (error) log.error("assistant.usage_record_failed", { organization_id: organizationId, code: error.code });
}

// ───────────────────────────── the pipeline ─────────────────────────────

export async function handleInboundMessage(input: PipelineInput, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const now = deps.now ?? (() => new Date());
  const { db, organizationId, conversationId } = input;
  const ids = { organization_id: organizationId, conversation_id: conversationId };
  const conversation = await loadConversation(db, organizationId, conversationId);
  const language: Language = detectLanguage(
    input.text,
    isLanguage(conversation.language) ? conversation.language : null,
  );

  // 1. Commands are honoured even when the assistant is paused or off.
  const command = detectCommand(input.text);
  if (command === "stop") {
    await updateConversation(db, organizationId, conversationId, {
      opted_out_at: now().toISOString(),
      ai_paused: true,
      status: "awaiting_human",
    });
    log.info("assistant.opted_out", ids);
    return {
      outbound: [{ sender: "system", body: optedOutConfirmation(language) }],
      outcome: "opted_out_now",
      status: "awaiting_human",
      aiPaused: true,
    };
  }
  if (command === "delete") {
    const { count, error } = await db
      .from("messages")
      .delete({ count: "exact" })
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId);
    if (error) dbFailure("pipeline_delete_messages", error);
    await updateConversation(db, organizationId, conversationId, { customer_name: null });
    await writeAudit(db, {
      organizationId,
      actorType: "system",
      action: "conversation.data_deleted_by_customer",
      entityType: "conversations",
      entityId: conversationId,
      details: { channel: input.channel, messages_deleted: count ?? null },
    });
    log.info("assistant.data_deleted", { ...ids, messages_deleted: count ?? null });
    return {
      outbound: [{ sender: "system", body: dataDeletedConfirmation(language) }],
      outcome: "data_deleted",
      status: conversation.status,
      aiPaused: conversation.ai_paused,
    };
  }

  // 2–3. Opted-out and staff-handled conversations get no automated reply,
  // with one exception: a possible emergency in a paused conversation still
  // gets the emergency number, because staff may not be reading right now.
  // After STOP nothing is sent, but the conversation is flagged for staff.
  if (conversation.opted_out_at || conversation.ai_paused) {
    if (detectEmergency(input.text)) {
      await updateConversation(db, organizationId, conversationId, {
        status: "awaiting_human",
        handoff_reason: "possible_emergency",
      });
      log.warn("assistant.emergency_detected", { ...ids, paused: true, opted_out: conversation.opted_out_at !== null });
      if (!conversation.opted_out_at) {
        const body = emergencyGuidance(language, await loadEmergencyNumber(db, organizationId));
        return {
          outbound: [{ sender: "system", body }],
          outcome: "emergency",
          status: "awaiting_human",
          aiPaused: true,
        };
      }
      return { outbound: [], outcome: "opted_out", status: "awaiting_human", aiPaused: conversation.ai_paused };
    }
    if (conversation.opted_out_at) {
      return { outbound: [], outcome: "opted_out", status: conversation.status, aiPaused: conversation.ai_paused };
    }
    return { outbound: [], outcome: "paused", status: conversation.status, aiPaused: true };
  }

  const kb = await loadKnowledge(db, organizationId);
  const outbound: PipelineOutbound[] = [];
  const patch: Record<string, unknown> = {};
  if (conversation.language !== language) patch.language = language;

  // 4. WhatsApp has no consent screen, so the notice goes out with the first reply.
  if (input.channel === "whatsapp" && !conversation.privacy_notice_sent_at) {
    outbound.push({
      sender: "system",
      body: privacyNotice(language, {
        clinicName: clinicDisplayName(kb, language),
        retentionDays: kb.settings.message_retention_days,
        customAr: kb.settings.privacy_notice_ar,
        customEn: kb.settings.privacy_notice_en,
      }),
      privacyNotice: true,
    });
    patch.privacy_notice_sent_at = now().toISOString();
  }

  // 5. Emergencies are answered without the model and go straight to staff.
  if (detectEmergency(input.text)) {
    await updateConversation(db, organizationId, conversationId, {
      ...patch,
      status: "awaiting_human",
      ai_paused: true,
      handoff_reason: "possible_emergency",
    });
    log.warn("assistant.emergency_detected", ids);
    outbound.push({ sender: "system", body: emergencyGuidance(language, kb.settings.emergency_number) });
    return { outbound, outcome: "emergency", status: "awaiting_human", aiPaused: true };
  }

  // handedOff: a handoff tool call already paused the assistant before the turn failed.
  const unavailable = async (handedOff = false): Promise<PipelineResult> => {
    await updateConversation(db, organizationId, conversationId, { ...patch, status: "awaiting_human" });
    // One notice per silence: do not repeat it to a customer who keeps writing.
    if (!isUnavailableNotice(await lastOutboundBody(db, organizationId, conversationId))) {
      outbound.push({ sender: "system", body: unavailableNotice(language) });
    }
    return { outbound, outcome: "unavailable", status: "awaiting_human", aiPaused: handedOff };
  };

  // 6. Assistant switched on, configured, and paid for.
  const availability = await checkAvailability(db, organizationId, kb.settings);
  if (!availability.available) {
    log.info("assistant.unavailable", { ...ids, reason: availability.reason });
    return await unavailable();
  }

  // 7. A runaway conversation (or a script) cannot spend the clinic's quota.
  try {
    await rateLimit(db, `ai:conv:${conversationId}`, AI_LIMIT_PER_HOUR, 3600);
  } catch (error) {
    if (error instanceof HttpError && error.status === 429) {
      log.warn("assistant.rate_limited", ids);
      await updateConversation(db, organizationId, conversationId, { ...patch, status: "awaiting_human" });
      return { outbound, outcome: "rate_limited", status: "awaiting_human", aiPaused: false };
    }
    if (error instanceof HttpError && error.status === 503) return await unavailable();
    throw error;
  }

  // 8. The model.
  const history = await loadHistory(db, organizationId, conversationId, input.text);
  const tools = createLiveTools({
    db,
    organizationId,
    conversationId,
    channel: input.channel,
    customerPhone: input.customerPhone,
    now,
  });
  let client: MessagesClientLike;
  try {
    client = deps.messagesClient ?? createMessagesClient();
  } catch (error) {
    log.error("assistant.client_unavailable", { ...ids, error_name: error instanceof Error ? error.name : null });
    return await unavailable();
  }
  const config = assistantConfig();
  const run = await runAssistant({
    client,
    config,
    system: buildSystem(kb, { now: now(), channel: input.channel, language }),
    tools: TOOL_DEFINITIONS,
    messages: history,
    executeTool: tools.execute,
  });

  // 10. Tokens were spent whenever the API answered, whatever happened next.
  if (run.apiCalls > 0) await recordUsage(db, organizationId, run.usage, false);

  const handedOff = tools.report.handoff !== null;
  if (!run.ok) {
    log.error("assistant.failed", { ...ids, kind: run.failure.kind, status: run.failure.status });
    return await unavailable(handedOff);
  }

  if (run.outcome === "refused") {
    await updateConversation(db, organizationId, conversationId, {
      ...patch,
      status: "awaiting_human",
      ai_paused: true,
      handoff_reason: "assistant_refused",
    });
    outbound.push({ sender: "system", body: safeFallback(language, kb.settings.reception_phone) });
    return { outbound, outcome: "refused", status: "awaiting_human", aiPaused: true };
  }

  // 9. Price guard: an amount the clinic never published is never sent.
  const prices = checkPrices(run.reply, allowedPrices(kb));
  if (!prices.ok) {
    log.warn("assistant.price_blocked", { ...ids, unknown_amounts: prices.unknown.length });
    await updateConversation(db, organizationId, conversationId, {
      ...patch,
      status: "awaiting_human",
      ai_paused: true,
      handoff_reason: "unknown_answer: a reply quoting a price not in the clinic's data was withheld",
    });
    outbound.push({ sender: "system", body: safeFallback(language, kb.settings.reception_phone) });
    return { outbound, outcome: "blocked_price", status: "awaiting_human", aiPaused: true };
  }

  await updateConversation(db, organizationId, conversationId, patch);
  outbound.push({
    sender: "assistant",
    body: run.reply,
    aiModel: run.model,
    inputTokens: run.usage.input_tokens + run.usage.cache_creation_input_tokens + run.usage.cache_read_input_tokens,
    outputTokens: run.usage.output_tokens,
  });
  if (handedOff) return { outbound, outcome: "handoff", status: "awaiting_human", aiPaused: true };
  return { outbound, outcome: "answered", status: conversation.status, aiPaused: false };
}
