import "server-only";
import { log } from "@/lib/log";
import { toAppError } from "./errors";

/**
 * Turns an async generator of events into a Server-Sent Events response.
 * Client disconnects (browser "stop", closed tab) abort `controller`, which
 * the producer passes down to the model provider so generation actually stops.
 */
export function sseResponse<T extends { type: string }>(
  produce: (signal: AbortSignal) => AsyncGenerator<T>,
  opts: { requestSignal?: AbortSignal; requestId: string },
): Response {
  const controller = new AbortController();
  opts.requestSignal?.addEventListener("abort", () => controller.abort(), { once: true });
  const enc = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (event: string, data: unknown) => {
        try {
          ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          controller.abort();
        }
      };
      // Keeps proxies from closing an idle connection while a slow model loads.
      heartbeat = setInterval(() => {
        try {
          ctrl.enqueue(enc.encode(": keep-alive\n\n"));
        } catch {
          /* closed */
        }
      }, 15_000);
      try {
        for await (const ev of produce(controller.signal)) send(ev.type, ev);
      } catch (err) {
        const e = toAppError(err);
        if (e.status >= 500) log.error("sse.error", { requestId: opts.requestId, error: err instanceof Error ? err : String(err) });
        send("error", { type: "error", code: e.code, message: e.message, requestId: opts.requestId });
      } finally {
        clearInterval(heartbeat);
        try {
          ctrl.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      clearInterval(heartbeat);
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
