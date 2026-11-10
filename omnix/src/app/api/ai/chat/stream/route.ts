import { runChatTurn } from "@/lib/ai/engine/chat-engine";
import { chatSchema } from "@/lib/api/schemas";
import { route } from "@/lib/http/route";
import { sseResponse } from "@/lib/http/sse";

export const runtime = "nodejs";
export const maxDuration = 600;

/**
 * Streaming chat over Server-Sent Events.
 * Events: meta → (delta | tool)* → done | error. Closing the connection stops generation.
 */
export const POST = route.auth(
  { scope: "chat", body: chatSchema, rateLimit: { name: "chat", limit: 60, windowSec: 60 } },
  async ({ auth, body, req, requestId, ip }) =>
    sseResponse((signal) => runChatTurn({ ...body, auth: { ...auth, requestId, ip }, signal }), { requestSignal: req.signal, requestId }),
);
