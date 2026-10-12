// Sending a WhatsApp message and recording it honestly.
//
// The message row is written as "pending" before the API call, so a crash
// mid-send leaves evidence instead of a silent gap, and it becomes "sent" only
// with the wamid Meta returned. A failure is stored with Meta's code; it is
// never reported as sent.

import { type Db, dbFailure } from "../db.ts";
import { log } from "../log.ts";
import { markDelivery, type StoredMessage, storeOutbound } from "../messages.ts";
import { GraphError, graphErrorSummary, sendTemplate, sendText } from "./graph.ts";
import {
  canSend,
  type Credentials,
  graphConfig,
  type IntegrationRow,
  loadCredentials,
  loadIntegration,
} from "./integration.ts";

export interface Sender {
  integration: IntegrationRow;
  credentials: Credentials;
}

export type OutboundContent =
  | { kind: "text"; body: string }
  | { kind: "template"; name: string; language: string; bodyParams: string[] };

/** The clinic's integration and credentials when it is able to send, otherwise null. */
export async function loadSender(db: Db, organizationId: string): Promise<Sender | null> {
  const integration = await loadIntegration(db, organizationId);
  if (!canSend(integration)) return null;
  const credentials = await loadCredentials(db, integration);
  return credentials ? { integration, credentials } : null;
}

/** What the dashboard shows for a template message: Meta holds the template text, not us. */
export function templateRecord(name: string, language: string, bodyParams: string[]): string {
  const params = bodyParams.length > 0 ? ` ${bodyParams.join(" | ")}` : "";
  return `[template ${name} (${language})]${params}`;
}

/** Stable machine code for a failed send, stored in messages.error_code. */
export function graphErrorCode(error: GraphError): string {
  if (error.code !== null) return String(error.code);
  return error.status === 0 ? "network_error" : `http_${error.status}`;
}

/** Records a Meta failure on the integration so owners see it on the WhatsApp page. */
export async function recordIntegrationError(
  db: Db,
  integration: Pick<IntegrationRow, "id" | "organization_id">,
  error: GraphError,
  now: Date,
): Promise<void> {
  const { error: dbError } = await db
    .from("integration_settings")
    .update({ status: "error", last_error: graphErrorSummary(error), last_error_at: now.toISOString() })
    .eq("id", integration.id)
    .eq("organization_id", integration.organization_id);
  if (dbError) dbFailure("integration_error_update", dbError);
}

export interface SendInput {
  conversationId: string;
  /** The customer's WhatsApp ID or E.164 number. */
  to: string;
  sender: "assistant" | "staff" | "system";
  staffUserId?: string | null;
  content: OutboundContent;
  fetchImpl?: typeof fetch;
  now: Date;
}

/**
 * Stores the message as pending, sends it, then marks it sent or failed.
 * Resolves with the stored message and the GraphError when Meta refused it;
 * other errors are re-thrown after the row is marked failed.
 */
export async function sendAndRecord(
  db: Db,
  sender: Sender,
  input: SendInput,
): Promise<{ message: StoredMessage; error: GraphError | null }> {
  const organizationId = sender.integration.organization_id;
  const content = input.content;
  const cfg = { ...graphConfig(sender.integration, sender.credentials), fetchImpl: input.fetchImpl };
  const pending = await storeOutbound(db, {
    organizationId,
    conversationId: input.conversationId,
    sender: input.sender,
    staffUserId: input.staffUserId ?? null,
    body: content.kind === "text" ? content.body : templateRecord(content.name, content.language, content.bodyParams),
    status: "pending",
  });

  try {
    const { messageId } = content.kind === "text"
      ? await sendText(cfg, input.to, content.body)
      : await sendTemplate(cfg, input.to, {
        name: content.name,
        language: content.language,
        bodyParams: content.bodyParams,
      });
    const message = await markDelivery(db, pending.id, organizationId, { status: "sent", waMessageId: messageId });
    return { message, error: null };
  } catch (error) {
    if (!(error instanceof GraphError)) {
      await markDelivery(db, pending.id, organizationId, { status: "failed", errorCode: "internal_error" });
      throw error;
    }
    log.warn("whatsapp.send_failed", {
      message_id: pending.id,
      conversation_id: input.conversationId,
      http_status: error.status,
      meta_code: error.code,
      meta_subcode: error.subcode,
      fbtrace_id: error.fbtraceId,
    });
    const message = await markDelivery(db, pending.id, organizationId, {
      status: "failed",
      errorCode: graphErrorCode(error),
      errorDetail: graphErrorSummary(error),
    });
    if (error.authFailed) await recordIntegrationError(db, sender.integration, error, input.now);
    return { message, error };
  }
}
