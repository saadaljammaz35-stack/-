import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OllamaProvider } from "@/lib/ai/providers/ollama";
import { OpenAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import { VllmProvider } from "@/lib/ai/providers/vllm";
import { ProviderError, type StreamEvent } from "@/lib/ai/providers/types";

// Protocol tests: a local HTTP server replays the wire format of the
// OpenAI Chat Completions SSE stream (vLLM, TGI, HF router) and of Ollama's
// NDJSON /api/chat stream. They verify parsing and resilience; they are not
// a substitute for running against a live Ollama or vLLM server.

type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;
let server: Server;
let base = "";
const routes = new Map<string, Handler>();
const hits = new Map<string, number>();
const seen: { path: string; body: string; auth?: string }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const key = `${req.method} ${req.url}`;
      hits.set(key, (hits.get(key) ?? 0) + 1);
      seen.push({ path: req.url!, body, auth: req.headers.authorization });
      const h = routes.get(key);
      if (!h) return void res.writeHead(404).end("not found");
      h(req, res, body);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const sse = (res: ServerResponse, events: unknown[], opts: { delayMs?: number } = {}) => {
  res.writeHead(200, { "content-type": "text/event-stream" });
  let i = 0;
  const next = () => {
    if (i < events.length) {
      const e = events[i++];
      res.write(`data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`);
      setTimeout(next, opts.delayMs ?? 0);
    } else res.end();
  };
  next();
};
async function drain(it: AsyncIterable<StreamEvent>) {
  const out: StreamEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe("OpenAI-compatible adapter (vLLM / TGI / HF router)", () => {
  it("streams deltas, accumulates tool calls across chunks and reads provider usage", async () => {
    routes.set("POST /v1/chat/completions", (_q, res) =>
      sse(res, [
        { model: "m", choices: [{ delta: { content: "مرحبا" } }] },
        { choices: [{ delta: { content: " بك" } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_a", function: { name: "get_", arguments: '{"ci' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "weather", arguments: 'ty":"Riyadh"}' } }] }, finish_reason: "tool_calls" }] },
        { choices: [], usage: { prompt_tokens: 42, completion_tokens: 7 } },
        "[DONE]",
      ]),
    );
    const p = new OpenAICompatibleProvider({ name: "t", baseUrl: base, apiKey: "secret-key" });
    const evs = await drain(p.stream({ model: "m", messages: [{ role: "user", content: "hi" }] }));
    expect(evs.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text).join("")).toBe("مرحبا بك");
    const done = evs.at(-1) as Extract<StreamEvent, { type: "done" }>;
    expect(done.result.toolCalls).toEqual([{ id: "call_a", name: "get_weather", arguments: '{"city":"Riyadh"}' }]);
    expect(done.result.finishReason).toBe("tool_calls");
    expect(done.result.usage).toEqual({ inputTokens: 42, outputTokens: 7, source: "provider" });
    expect(seen.at(-1)!.auth).toBe("Bearer secret-key");
    expect(JSON.parse(seen.at(-1)!.body)).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });

  it("labels usage as an estimate when the server reports none", async () => {
    routes.set("POST /v1/chat/completions", (_q, res) => sse(res, [{ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }, "[DONE]"]));
    const r = await new OpenAICompatibleProvider({ name: "t", baseUrl: `${base}/v1` }).generate({ model: "m", messages: [{ role: "user", content: "hi" }] });
    expect(r.usage.source).toBe("estimate");
  });

  it("retries connection failures (503) but not client errors", async () => {
    let n = 0;
    routes.set("POST /v1/chat/completions", (_q, res) => {
      if (n++ < 2) return void res.writeHead(503).end("busy");
      sse(res, [{ choices: [{ delta: { content: "third time" } }] }, "[DONE]"]);
    });
    const p = new OpenAICompatibleProvider({ name: "t", baseUrl: base, retry: { retries: 3, baseDelayMs: 1, maxDelayMs: 5 } });
    expect((await p.generate({ model: "m", messages: [{ role: "user", content: "x" }] })).text).toBe("third time");
    routes.set("POST /v1/chat/completions", (_q, res) => res.writeHead(400).end("This model's maximum context length is 4096 tokens"));
    const err = await p.generate({ model: "m", messages: [{ role: "user", content: "x" }] }).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe("context_length");
  });

  it("does not regenerate after tokens started flowing", async () => {
    let calls = 0;
    routes.set("POST /v1/chat/completions", (_q, res) => {
      calls++;
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "partial" } }] })}\n\n`);
      setTimeout(() => res.destroy(), 20);
    });
    const p = new OpenAICompatibleProvider({ name: "t", baseUrl: base, retry: { retries: 3, baseDelayMs: 1, maxDelayMs: 5 } });
    await expect(p.generate({ model: "m", messages: [{ role: "user", content: "x" }] })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("honours caller cancellation and first-token timeouts", async () => {
    routes.set("POST /v1/chat/completions", (_q, res) => sse(res, Array.from({ length: 50 }, () => ({ choices: [{ delta: { content: "x" } }] })), { delayMs: 30 }));
    const ac = new AbortController();
    const p = new OpenAICompatibleProvider({ name: "t", baseUrl: base });
    const collected: string[] = [];
    const run = (async () => {
      for await (const e of p.stream({ model: "m", messages: [{ role: "user", content: "x" }], signal: ac.signal })) {
        if (e.type === "delta") collected.push(e.text);
        if (collected.length === 3) ac.abort();
      }
    })();
    await expect(run).rejects.toMatchObject({ code: "cancelled" });
    expect(collected.length).toBeLessThan(10);

    routes.set("POST /v1/chat/completions", (_q, res) => { res.writeHead(200, { "content-type": "text/event-stream" }); /* never sends */ });
    await expect(p.generate({ model: "m", messages: [{ role: "user", content: "x" }], firstTokenTimeoutMs: 150 })).rejects.toMatchObject({ code: "timeout" });
  });

  it("reports unreachable servers as unavailable and health as down", async () => {
    const p = new OpenAICompatibleProvider({ name: "t", baseUrl: "http://127.0.0.1:9", retry: { retries: 0, baseDelayMs: 1, maxDelayMs: 1 } });
    await expect(p.generate({ model: "m", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "unavailable" });
    expect((await p.healthCheck()).status).toBe("down");
    await expect(p.loadModel("m")).rejects.toMatchObject({ code: "unsupported" });
  });
});

describe("vLLM adapter", () => {
  it("checks /health, reads max_model_len and loads LoRA adapters at run time", async () => {
    routes.set("GET /health", (_q, res) => res.writeHead(200).end());
    routes.set("GET /version", (_q, res) => res.writeHead(200, { "content-type": "application/json" }).end('{"version":"0.11.0"}'));
    routes.set("GET /v1/models", (_q, res) => res.writeHead(200, { "content-type": "application/json" }).end('{"data":[{"id":"Qwen/Qwen3-8B","max_model_len":32768}]}'));
    routes.set("POST /v1/load_lora_adapter", (_q, res) => res.writeHead(200).end("ok"));
    const p = new VllmProvider({ name: "v", baseUrl: base });
    expect(await p.healthCheck()).toMatchObject({ status: "healthy", version: "0.11.0" });
    expect((await p.getModelInfo("Qwen/Qwen3-8B")).contextLength).toBe(32768);
    await p.loadModel("Qwen/Qwen3-8B", { adapterName: "saad-ai-v1.1.0", adapterPath: "/adapters/x" });
    expect(JSON.parse(seen.at(-1)!.body)).toEqual({ lora_name: "saad-ai-v1.1.0", lora_path: "/adapters/x" });
    await expect(p.loadModel("Qwen/Qwen3-8B")).rejects.toMatchObject({ code: "unsupported" });
  });
});

describe("Ollama adapter", () => {
  it("parses NDJSON, tool calls and eval counts, and asks for the model's context window", async () => {
    routes.set("POST /api/show", (_q, res) =>
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ model_info: { "qwen3.context_length": 40960, "general.parameter_count": 8e9 }, capabilities: ["completion", "tools"], details: { family: "qwen3" } })),
    );
    routes.set("GET /api/ps", (_q, res) => res.writeHead(200, { "content-type": "application/json" }).end('{"models":[]}'));
    routes.set("POST /api/chat", (_q, res) => {
      res.writeHead(200, { "content-type": "application/x-ndjson" });
      res.write(JSON.stringify({ model: "qwen3:8b", message: { role: "assistant", content: "أهلاً" }, done: false }) + "\n");
      res.write(JSON.stringify({ message: { role: "assistant", content: "", tool_calls: [{ function: { name: "current_time", arguments: {} } }] }, done: false }) + "\n");
      res.end(JSON.stringify({ model: "qwen3:8b", message: { content: "" }, done: true, done_reason: "stop", prompt_eval_count: 31, eval_count: 4 }) + "\n");
    });
    const p = new OllamaProvider({ name: "o", baseUrl: base });
    const r = await p.generate({ model: "qwen3:8b", messages: [{ role: "user", content: "hi" }], maxTokens: 64 });
    expect(r.text).toBe("أهلاً");
    expect(r.toolCalls[0]!.name).toBe("current_time");
    expect(r.finishReason).toBe("tool_calls");
    expect(r.usage).toEqual({ inputTokens: 31, outputTokens: 4, source: "provider" });
    const chatBody = JSON.parse(seen.filter((s) => s.path === "/api/chat").at(-1)!.body);
    expect(chatBody.options).toMatchObject({ num_predict: 64, num_ctx: 32768 });
    expect((await p.getCapabilities("qwen3:8b")).toolCalling).toBe(true);
  });

  it("maps a missing model to not_found", async () => {
    routes.set("POST /api/chat", (_q, res) => res.writeHead(200).end(JSON.stringify({ error: "model 'x' not found" }) + "\n"));
    await expect(new OllamaProvider({ name: "o", baseUrl: base }).generate({ model: "x", messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({ code: "not_found" });
  });
});
