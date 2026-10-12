// conversation-reply: a staff member answers a conversation from the dashboard
// (see docs/API.md). Web chat replies are stored for the visitor's next poll;
// WhatsApp replies go through the Cloud API and are reported exactly as Meta
// answered: "sent" with a wamid, or "failed" with Meta's error code.

import { type Db, dbFailure, requireMembership, requireUser, serviceClient, writeAudit } from "../_shared/db.ts";
import { z } from "../_shared/deps.ts";
import { type Handler, HttpError, json, parse, readJson, type RequestContext } from "../_shared/http.ts";
import { log } from "../_shared/log.ts";
import { MAX_BODY, type StoredMessage, storeOutbound } from "../_shared/messages.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { loadSender, type OutboundContent, sendAndRecord } from "../_shared/whatsapp/outbound.ts";
import { withinServiceWindow } from "../_shared/whatsapp/window.ts";

export interface Deps {
  db: Db;
  fetch: typeof fetch;
  now: () => Date;
}

export function liveDeps(): Deps {
  return { db: serviceClient(), fetch: globalThis.fetch, now: () => new Date() };
}

const Template = z.object({
  name: z.string().regex(/^[a-z0-9_]{1,512}$/, "Use the template name exactly as approved in Meta"),
  language: z.string().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "Use a Meta language code such as ar or en_US"),
  body_params: z.array(z.string().trim().min(1).max(1024)).max(20).default([]),
});

const Body = z
  .object({
    conversation_id: z.uuid(),
    body: z.string().trim().min(1).max(MAX_BODY).optional(),
    template: Template.optional(),
    pause_ai: z.boolean().default(true),
  })
  .refine((input) => (input.body === undefined) !== (input.template === undefined), {
    message: "Send either body or template, not both",
    path: ["body"],
  });

interface ConversationRow {
  id: string;
  organization_id: string;
  channel: "web" | "whatsapp";
  status: "open" | "awaiting_human" | "closed";
  customer_wa_id: string | null;
  opted_out_at: string | null;
  last_inbound_at: string | null;
  ai_paused: boolean;
  assigned_to: string | null;
}

const CONVERSATION_COLUMNS =
  "id, organization_id, channel, status, customer_wa_id, opted_out_at, last_inbound_at, ai_paused, assigned_to";

function notFound(): HttpError {
  return new HttpError(404, "not_found", "Conversation not found");
}

/** Membership check that answers 404 for "not yours", so ids of other clinics cannot be probed. */
async function requireMemberOr404(db: Db, userId: string, organizationId: string): Promise<void> {
  try {
    await requireMembership(db, userId, organizationId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) throw notFound();
    throw error;
  }
}

/** Hands the conversation to staff: the assistant stops and the replier becomes the assignee if none. */
async function takeOver(db: Db, conversation: ConversationRow, userId: string): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (!conversation.ai_paused) patch.ai_paused = true;
  if (conversation.status === "awaiting_human") patch.status = "open";
  if (Object.keys(patch).length > 0) {
    const { error } = await db
      .from("conversations")
      .update(patch)
      .eq("id", conversation.id)
      .eq("organization_id", conversation.organization_id);
    if (error) dbFailure("conversation_pause", error);
  }
  if (conversation.assigned_to === null) {
    // Conditional on still being unassigned, so a colleague who just took it keeps it.
    const { error } = await db
      .from("conversations")
      .update({ assigned_to: userId })
      .eq("id", conversation.id)
      .eq("organization_id", conversation.organization_id)
      .is("assigned_to", null);
    if (error) dbFailure("conversation_assign", error);
  }
}

export function createHandler(getDeps: () => Deps): Handler {
  return async (req: Request, ctx: RequestContext): Promise<Response> => {
    const { db, fetch, now } = getDeps();
    const user = await requireUser(req, db);
    const input = parse(Body, await readJson(req, 32 * 1024));
    await rateLimit(db, `reply:user:${user.id}`, 60, 60);

    // Looked up by id alone to learn its clinic; nothing is returned or changed before membership is checked.
    const { data, error } = await db
      .from("conversations")
      .select(CONVERSATION_COLUMNS)
      .eq("id", input.conversation_id)
      .maybeSingle();
    if (error) dbFailure("conversation_lookup", error);
    if (!data) throw notFound();
    const conversation = data as ConversationRow;
    const organizationId = conversation.organization_id;
    await requireMemberOr404(db, user.id, organizationId);

    let message: StoredMessage;
    if (conversation.channel === "web") {
      if (input.template) {
        throw new HttpError(400, "invalid_request", "Templates can only be sent on WhatsApp", [
          { path: "template", message: "Templates can only be sent on WhatsApp" },
        ]);
      }
      message = await storeOutbound(db, {
        organizationId,
        conversationId: conversation.id,
        sender: "staff",
        staffUserId: user.id,
        body: input.body ?? "",
        status: "sent",
      });
    } else {
      if (conversation.opted_out_at !== null) {
        throw new HttpError(409, "customer_opted_out", "The customer asked not to receive messages");
      }
      const sender = await loadSender(db, organizationId);
      if (!sender || conversation.customer_wa_id === null) {
        throw new HttpError(409, "whatsapp_not_connected", "WhatsApp is not connected for this clinic");
      }
      if (input.body !== undefined && !withinServiceWindow(conversation.last_inbound_at, now())) {
        throw new HttpError(
          409,
          "outside_service_window",
          "The customer's last message is older than 24 hours. Send an approved template instead.",
        );
      }
      const content: OutboundContent = input.template
        ? {
          kind: "template",
          name: input.template.name,
          language: input.template.language,
          bodyParams: input.template.body_params,
        }
        : { kind: "text", body: input.body ?? "" };
      const result = await sendAndRecord(db, sender, {
        conversationId: conversation.id,
        to: conversation.customer_wa_id,
        sender: "staff",
        staffUserId: user.id,
        content,
        fetchImpl: fetch,
        now: now(),
      });
      message = result.message;
    }

    if (input.pause_ai) await takeOver(db, conversation, user.id);

    await writeAudit(db, {
      organizationId,
      actorUserId: user.id,
      actorType: "user",
      action: "conversation.staff_reply",
      entityType: "conversations",
      entityId: conversation.id,
      details: {
        message_id: message.id,
        channel: conversation.channel,
        status: message.status,
        error_code: message.error_code,
        template: input.template !== undefined,
        pause_ai: input.pause_ai,
      },
    });
    log.info("conversation_reply.stored", {
      request_id: ctx.requestId,
      organization_id: organizationId,
      conversation_id: conversation.id,
      message_id: message.id,
      status: message.status,
    });

    return json(req, { message });
  };
}
