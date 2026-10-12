// Writing outbound messages. Inbound messages are stored by the channel
// entry points (ingest_whatsapp_inbound for WhatsApp, public-chat for web).

import { type Db, dbFailure } from "./db.ts";

export const MESSAGE_COLUMNS = "id, direction, sender, body, status, error_code, created_at";

export type MessageSender = "customer" | "assistant" | "staff" | "system";
export type MessageStatus = "received" | "pending" | "sent" | "delivered" | "read" | "failed";

export interface StoredMessage {
  id: string;
  direction: "inbound" | "outbound";
  sender: MessageSender;
  body: string;
  status: MessageStatus;
  error_code: string | null;
  created_at: string;
}

export interface OutboundInput {
  organizationId: string;
  conversationId: string;
  sender: "assistant" | "staff" | "system";
  body: string;
  status: "pending" | "sent" | "failed";
  staffUserId?: string | null;
  waMessageId?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
  aiModel?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

export const MAX_BODY = 4096;

export async function storeOutbound(db: Db, input: OutboundInput): Promise<StoredMessage> {
  const { data, error } = await db
    .from("messages")
    .insert({
      organization_id: input.organizationId,
      conversation_id: input.conversationId,
      direction: "outbound",
      sender: input.sender,
      body: input.body.slice(0, MAX_BODY),
      status: input.status,
      staff_user_id: input.staffUserId ?? null,
      wa_message_id: input.waMessageId ?? null,
      error_code: input.errorCode?.slice(0, 64) ?? null,
      error_detail: input.errorDetail?.slice(0, 1000) ?? null,
      ai_model: input.aiModel ?? null,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) dbFailure("store_outbound", error ?? {});
  return data as StoredMessage;
}

export async function markDelivery(
  db: Db,
  messageId: string,
  organizationId: string,
  update: {
    status: "sent" | "failed";
    waMessageId?: string | null;
    errorCode?: string | null;
    errorDetail?: string | null;
  },
): Promise<StoredMessage> {
  const { data, error } = await db
    .from("messages")
    .update({
      status: update.status,
      wa_message_id: update.waMessageId ?? null,
      error_code: update.errorCode?.slice(0, 64) ?? null,
      error_detail: update.errorDetail?.slice(0, 1000) ?? null,
    })
    .eq("id", messageId)
    .eq("organization_id", organizationId)
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) dbFailure("mark_delivery", error ?? {});
  return data as StoredMessage;
}
