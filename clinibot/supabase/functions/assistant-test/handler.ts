// Staff test console for the assistant (owner, admin). See docs/API.md,
// "assistant-test".
//
// Runs the real model against the clinic's current knowledge with the same
// safety layers as live chat, but tools only report what they would do. A
// successful API response is the only thing that records ai_last_test_ok =
// true, which the database requires before the assistant can be switched on.

import { type Db, dbFailure, requireMembership, requireUser, writeAudit } from "../_shared/db.ts";
import { z } from "../_shared/deps.ts";
import { requireSecret } from "../_shared/env.ts";
import { type Handler, HttpError, json, parse, readJson } from "../_shared/http.ts";
import { log } from "../_shared/log.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import {
  assistantConfig,
  type BetaMessageParam,
  createMessagesClient,
  type MessagesClientLike,
  runAssistant,
  type TokenUsage,
} from "../_shared/assistant/claude.ts";
import { allowedPrices, formatSar, loadKnowledge } from "../_shared/assistant/knowledge.ts";
import { detectLanguage } from "../_shared/assistant/language.ts";
import { emergencyGuidance, safeFallback } from "../_shared/assistant/notices.ts";
import { loadEntitlements, recordUsage } from "../_shared/assistant/pipeline.ts";
import { buildSystem } from "../_shared/assistant/prompt.ts";
import { checkPrices, detectEmergency } from "../_shared/assistant/safety.ts";
import { createTestTools, type HandoffInput, TOOL_DEFINITIONS } from "../_shared/assistant/tools.ts";

export interface AssistantTestDeps {
  db: () => Db;
  messagesClient?: () => MessagesClientLike;
  now?: () => Date;
}

const requestSchema = z.object({
  organization_id: z.uuid(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(20)
    .refine((messages) => messages[messages.length - 1]?.role === "user", "The last message must be from the user"),
});

type Outcome = "answered" | "handoff" | "emergency" | "blocked_price" | "refused";

const NO_USAGE: TokenUsage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};

/** The model must see a user turn first; a leading assistant line in the console is dropped. */
function toModelMessages(messages: Array<{ role: "user" | "assistant"; content: string }>): BetaMessageParam[] {
  const firstUser = messages.findIndex((message) => message.role === "user");
  return messages.slice(firstUser).map((message) => ({ role: message.role, content: message.content }));
}

export function createAssistantTestHandler(deps: AssistantTestDeps): Handler {
  const now = deps.now ?? (() => new Date());

  return async (req) => {
    const db = deps.db();
    const user = await requireUser(req, db);
    const body = parse(requestSchema, await readJson(req, 64 * 1024));
    const organizationId = body.organization_id;
    await requireMembership(db, user.id, organizationId, ["owner", "admin"]);
    await rateLimit(db, `ai-test:user:${user.id}`, 30, 3600);

    const entitlements = await loadEntitlements(db, organizationId);
    if (!entitlements?.is_active) {
      throw new HttpError(409, "subscription_inactive", "The clinic's subscription is not active");
    }
    if (entitlements.ai_replies_remaining <= 0) {
      throw new HttpError(409, "ai_quota_exhausted", "This month's AI replies are used up");
    }
    requireSecret("ANTHROPIC_API_KEY");

    const kb = await loadKnowledge(db, organizationId);
    const config = assistantConfig();
    const lastMessage = body.messages[body.messages.length - 1]?.content ?? "";
    const language = detectLanguage(lastMessage, kb.defaultLanguage);

    const respond = async (result: {
      reply: string;
      outcome: Outcome;
      handoff: HandoffInput | null;
      appointment: Record<string, unknown> | null;
      model: string;
      usage: TokenUsage;
    }) => {
      await writeAudit(db, {
        organizationId,
        actorUserId: user.id,
        actorType: "user",
        action: "assistant.tested",
        details: { outcome: result.outcome, model: result.model },
      });
      return json(req, {
        reply: result.reply,
        language,
        outcome: result.outcome,
        handoff: result.handoff,
        appointment_request: result.appointment,
        model: result.model,
        usage: {
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
          cache_read_input_tokens: result.usage.cache_read_input_tokens,
        },
      });
    };

    // Same order as live chat: emergencies never reach the model.
    if (detectEmergency(lastMessage)) {
      return await respond({
        reply: emergencyGuidance(language, kb.settings.emergency_number),
        outcome: "emergency",
        handoff: null,
        appointment: null,
        model: config.model,
        usage: NO_USAGE,
      });
    }

    const tools = createTestTools(kb, now);
    const run = await runAssistant({
      client: deps.messagesClient ? deps.messagesClient() : createMessagesClient(),
      config,
      system: buildSystem(kb, { now: now(), channel: "test", language }),
      tools: TOOL_DEFINITIONS,
      messages: toModelMessages(body.messages),
      executeTool: tools.execute,
    });
    if (run.apiCalls > 0) await recordUsage(db, organizationId, run.usage, true);

    if (!run.ok) {
      const { error } = await db
        .from("clinic_settings")
        .update({ ai_last_test_ok: false })
        .eq("organization_id", organizationId);
      if (error) dbFailure("assistant_test_result", error);
      await writeAudit(db, {
        organizationId,
        actorUserId: user.id,
        actorType: "user",
        action: "assistant.tested",
        details: { outcome: "upstream_error", kind: run.failure.kind, status: run.failure.status },
      });
      log.warn("assistant_test.upstream_error", { organization_id: organizationId, kind: run.failure.kind });
      throw new HttpError(502, "upstream_error", "The AI service did not return a usable answer", {
        provider: "anthropic",
      });
    }

    // The API answered: this is what proves the key, model and prompt work.
    const { error } = await db
      .from("clinic_settings")
      .update({ ai_last_test_at: now().toISOString(), ai_last_test_ok: true })
      .eq("organization_id", organizationId);
    if (error) dbFailure("assistant_test_result", error);

    const appointment = tools.report.appointment
      ? {
        customer_name: tools.report.appointment.customer_name,
        service_id: tools.report.appointment.service_id,
        preferred_date: tools.report.appointment.preferred_date,
        preferred_time_window: tools.report.appointment.preferred_time_window,
        saved: false,
      }
      : null;

    if (run.outcome === "refused") {
      return await respond({
        reply: safeFallback(language, kb.settings.reception_phone),
        outcome: "refused",
        // Live chat hands a refused conversation to staff; the console reports that instead of doing it.
        handoff: tools.report.handoff ?? {
          reason: "other",
          summary: "The AI declined to answer. In live chat this conversation would be handed to the clinic team.",
        },
        appointment,
        model: run.model,
        usage: run.usage,
      });
    }

    const prices = checkPrices(run.reply, allowedPrices(kb));
    if (!prices.ok) {
      // Staff see which amounts were withheld so they can add them to services or FAQs.
      const amounts = prices.unknown.map((amount) => `${formatSar(amount)} SAR`).join(", ");
      return await respond({
        reply: safeFallback(language, kb.settings.reception_phone),
        outcome: "blocked_price",
        handoff: {
          reason: "unknown_answer",
          summary: `Reply withheld: it quoted ${amounts}, which is not in the clinic's services, FAQs or guidance.`
            .slice(0, 300),
        },
        appointment,
        model: run.model,
        usage: run.usage,
      });
    }

    return await respond({
      reply: run.reply,
      outcome: tools.report.handoff ? "handoff" : "answered",
      handoff: tools.report.handoff,
      appointment,
      model: run.model,
      usage: run.usage,
    });
  };
}
