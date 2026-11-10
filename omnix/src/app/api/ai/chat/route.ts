import { runChatTurn, type ChatEvent } from "@/lib/ai/engine/chat-engine";
import { chatSchema } from "@/lib/api/schemas";
import { AppError, type ErrorCode } from "@/lib/http/errors";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";
export const maxDuration = 600;

/** Non-streaming chat: waits for the full answer. */
export const POST = route.auth(
  { scope: "chat", body: chatSchema, rateLimit: { name: "chat", limit: 60, windowSec: 60 } },
  async ({ auth, body, req, requestId, ip }) => {
    let meta: Extract<ChatEvent, { type: "meta" }> | null = null;
    let done: Extract<ChatEvent, { type: "done" }> | null = null;
    for await (const ev of runChatTurn({ ...body, auth: { ...auth, requestId, ip }, signal: req.signal })) {
      if (ev.type === "meta") meta = ev;
      else if (ev.type === "done") done = ev;
      else if (ev.type === "error") throw new AppError(ev.code as ErrorCode, ev.message);
    }
    if (!meta || !done) throw new AppError("INTERNAL", "Chat ended without a result");
    return { conversationId: meta.conversationId, model: meta.model, sources: meta.sources, message: done.message };
  },
);
