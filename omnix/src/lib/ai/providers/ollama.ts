import { estimateMessagesTokens, estimateTokens } from "../tokens";
import { collect, DEFAULT_RETRY, guardStream, ndjsonLines, parseJsonOrThrow, providerFetch, toolCallId, withRetry, type RetryPolicy } from "./resilience";
import {
  ProviderError,
  type ChatMessage,
  type GenerateRequest,
  type GenerateResult,
  type ModelInfo,
  type ModelProvider,
  type ProviderCapabilities,
  type ProviderHealth,
  type StreamEvent,
  type ToolCall,
} from "./types";

interface OllamaChunk {
  model?: string;
  message?: { role?: string; content?: string; tool_calls?: { function: { name: string; arguments: unknown } }[] };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

function toOllamaMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.toolCalls?.length
      ? { tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: safeJson(c.arguments) } })) }
      : {}),
  }));
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/**
 * Ollama native API: `/api/chat` (NDJSON stream), `/api/show`, `/api/tags`,
 * `/api/ps`, `/api/version`. Models load on first use; `keep_alive` on
 * `/api/generate` loads or evicts one explicitly.
 */
export class OllamaProvider implements ModelProvider {
  readonly type = "ollama" as const;
  readonly name: string;
  private readonly base: string;
  private readonly connectTimeoutMs: number;
  private readonly retry: RetryPolicy;
  private readonly contextCache = new Map<string, number | null>();

  constructor(opts: { name: string; baseUrl: string; connectTimeoutMs?: number; retry?: RetryPolicy }) {
    this.name = opts.name;
    this.base = opts.baseUrl.replace(/\/+$/, "");
    // Ollama may need to load a model from disk before the first byte.
    this.connectTimeoutMs = opts.connectTimeoutMs ?? 120_000;
    this.retry = opts.retry ?? DEFAULT_RETRY;
  }

  generate(req: GenerateRequest): Promise<GenerateResult> {
    return collect(this.stream(req));
  }

  stream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    return guardStream((signal) => this.rawStream(req, signal), req);
  }

  private async *rawStream(req: GenerateRequest, signal: AbortSignal): AsyncGenerator<StreamEvent> {
    const started = performance.now();
    const ctx = await this.contextLength(req.model).catch(() => null);
    const body = {
      model: req.model,
      messages: toOllamaMessages(req.messages),
      stream: true,
      options: {
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.topP !== undefined ? { top_p: req.topP } : {}),
        ...(req.maxTokens !== undefined ? { num_predict: req.maxTokens } : {}),
        ...(req.stop?.length ? { stop: req.stop } : {}),
        // Ollama defaults to a small window; ask for the model's real one (capped for memory).
        ...(ctx ? { num_ctx: Math.min(ctx, 32_768) } : {}),
      },
      ...(req.tools?.length ? { tools: req.tools.map((t) => ({ type: "function", function: t })) } : {}),
    };
    const res = await withRetry(
      () =>
        providerFetch(`${this.base}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          timeoutMs: this.connectTimeoutMs,
          signal,
        }),
      this.retry,
      signal,
    );
    if (!res.body) throw new ProviderError("protocol", "Empty response body");

    let text = "";
    let firstTokenMs: number | null = null;
    let final: OllamaChunk | null = null;
    const toolCalls: ToolCall[] = [];
    for await (const line of ndjsonLines(res.body)) {
      const chunk = parseJsonOrThrow(line) as OllamaChunk;
      if (chunk.error) {
        throw new ProviderError(/not found/i.test(chunk.error) ? "not_found" : "server", chunk.error);
      }
      const delta = chunk.message?.content;
      if (delta) {
        firstTokenMs ??= performance.now() - started;
        text += delta;
        yield { type: "delta", text: delta };
      }
      for (const tc of chunk.message?.tool_calls ?? []) {
        const call = { id: toolCallId(), name: tc.function.name, arguments: JSON.stringify(tc.function.arguments ?? {}) };
        toolCalls.push(call);
        yield { type: "tool_call", call };
      }
      if (chunk.done) {
        final = chunk;
        break;
      }
    }
    if (!final) throw new ProviderError("protocol", "Ollama stream ended without done=true");
    const hasUsage = final.prompt_eval_count != null && final.eval_count != null;
    yield {
      type: "done",
      result: {
        text,
        toolCalls,
        finishReason: toolCalls.length ? "tool_calls" : final.done_reason === "length" ? "length" : "stop",
        usage: hasUsage
          ? { inputTokens: final.prompt_eval_count!, outputTokens: final.eval_count!, source: "provider" }
          : { inputTokens: estimateMessagesTokens(req.messages), outputTokens: estimateTokens(text), source: "estimate" },
        model: final.model ?? req.model,
        latencyMs: Math.round(performance.now() - started),
        firstTokenMs: firstTokenMs === null ? null : Math.round(firstTokenMs),
      },
    };
  }

  async healthCheck(signal?: AbortSignal): Promise<ProviderHealth> {
    const t = performance.now();
    try {
      const r = await providerFetch(`${this.base}/api/version`, { method: "GET", timeoutMs: 5000, signal });
      const v = (await r.json()) as { version?: string };
      return { status: "healthy", latencyMs: Math.round(performance.now() - t), version: v.version };
    } catch (err) {
      return { status: "down", latencyMs: Math.round(performance.now() - t), error: (err as Error).message };
    }
  }

  async getCapabilities(model?: string): Promise<ProviderCapabilities> {
    let toolCalling = false;
    let vision = false;
    if (model) {
      const info = await this.getModelInfo(model).catch(() => null);
      toolCalling = info?.capabilities?.includes("tools") ?? false;
      vision = info?.capabilities?.includes("vision") ?? false;
    }
    return { streaming: true, toolCalling, vision, embeddings: true, loadUnload: true, loraAdapters: false };
  }

  private async contextLength(model: string): Promise<number | null> {
    if (this.contextCache.has(model)) return this.contextCache.get(model)!;
    const info = await this.getModelInfo(model);
    this.contextCache.set(model, info.contextLength);
    return info.contextLength;
  }

  async getModelInfo(model: string): Promise<ModelInfo> {
    const r = await providerFetch(`${this.base}/api/show`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model }),
      timeoutMs: 15_000,
    });
    const j = (await r.json()) as {
      model_info?: Record<string, unknown>;
      details?: { family?: string; parameter_size?: string; quantization_level?: string };
      capabilities?: string[];
    };
    const mi = j.model_info ?? {};
    const ctxKey = Object.keys(mi).find((k) => k.endsWith(".context_length"));
    const loaded = await this.loadedModels().catch(() => new Set<string>());
    return {
      id: model,
      contextLength: ctxKey ? Number(mi[ctxKey]) : null,
      parameterCount: typeof mi["general.parameter_count"] === "number" ? (mi["general.parameter_count"] as number) : null,
      quantization: j.details?.quantization_level ?? null,
      family: j.details?.family ?? null,
      capabilities: j.capabilities ?? [],
      loaded: loaded.has(model),
    };
  }

  private async loadedModels(): Promise<Set<string>> {
    const r = await providerFetch(`${this.base}/api/ps`, { method: "GET", timeoutMs: 5000 });
    const j = (await r.json()) as { models?: { name: string }[] };
    return new Set((j.models ?? []).map((m) => m.name));
  }

  async listModels(): Promise<ModelInfo[]> {
    const r = await providerFetch(`${this.base}/api/tags`, { method: "GET", timeoutMs: 10_000 });
    const j = (await r.json()) as { models?: { name: string; details?: { family?: string; quantization_level?: string } }[] };
    const loaded = await this.loadedModels().catch(() => new Set<string>());
    return (j.models ?? []).map((m) => ({
      id: m.name,
      contextLength: null,
      family: m.details?.family ?? null,
      quantization: m.details?.quantization_level ?? null,
      loaded: loaded.has(m.name),
    }));
  }

  async loadModel(model: string): Promise<void> {
    await providerFetch(`${this.base}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, keep_alive: "30m" }),
      timeoutMs: 300_000,
    });
  }

  async unloadModel(model: string): Promise<void> {
    await providerFetch(`${this.base}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, keep_alive: 0 }),
      timeoutMs: 60_000,
    });
  }

  /** Ollama `/api/embed`, used by the embeddings layer. */
  async embed(model: string, input: string[], signal?: AbortSignal): Promise<number[][]> {
    const r = await providerFetch(`${this.base}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, input }),
      timeoutMs: 120_000,
      signal,
    });
    const j = (await r.json()) as { embeddings?: number[][] };
    if (!j.embeddings || j.embeddings.length !== input.length) throw new ProviderError("protocol", "Unexpected embeddings response");
    return j.embeddings;
  }
}
