import { estimateMessagesTokens, estimateTokens } from "../tokens";
import {
  collect,
  finalizeToolCalls,
  guardStream,
  parseJsonOrThrow,
  providerFetch,
  sseData,
  withRetry,
  type RetryPolicy,
  DEFAULT_RETRY,
} from "./resilience";
import {
  ProviderError,
  type ChatMessage,
  type FinishReason,
  type GenerateRequest,
  type GenerateResult,
  type ModelInfo,
  type ModelProvider,
  type ProviderCapabilities,
  type ProviderHealth,
  type ProviderType,
  type StreamEvent,
  type ToolCall,
} from "./types";

export interface OpenAICompatibleOptions {
  name: string;
  /** Base URL; `/v1` is appended when missing. */
  baseUrl: string;
  apiKey?: string | null;
  connectTimeoutMs?: number;
  retry?: RetryPolicy;
  extraHeaders?: Record<string, string>;
}

interface OAIChunk {
  model?: string;
  choices?: {
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  error?: { message?: string };
}

function toOpenAIMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function mapFinish(reason: string | null | undefined, hasTools: boolean): FinishReason {
  if (hasTools) return "tool_calls";
  return reason === "length" ? "length" : "stop";
}

/**
 * Speaks the OpenAI Chat Completions protocol, which vLLM, Hugging Face TGI /
 * Inference router and many hosted servers implement.
 */
export class OpenAICompatibleProvider implements ModelProvider {
  readonly type: ProviderType = "openai_compatible";
  readonly name: string;
  protected readonly v1: string;
  protected readonly root: string;
  protected readonly apiKey: string | null;
  protected readonly connectTimeoutMs: number;
  protected readonly retry: RetryPolicy;
  protected readonly extraHeaders: Record<string, string>;

  constructor(opts: OpenAICompatibleOptions) {
    this.name = opts.name;
    const trimmed = opts.baseUrl.replace(/\/+$/, "");
    this.v1 = trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
    this.root = this.v1.replace(/\/v1$/, "");
    this.apiKey = opts.apiKey ?? null;
    this.connectTimeoutMs = opts.connectTimeoutMs ?? 30_000;
    this.retry = opts.retry ?? DEFAULT_RETRY;
    this.extraHeaders = opts.extraHeaders ?? {};
  }

  protected headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      ...this.extraHeaders,
    };
  }

  /** The model name sent on the wire; vLLM serves LoRA adapters under their own name. */
  protected wireModel(req: GenerateRequest): string {
    return req.adapter || req.model;
  }

  generate(req: GenerateRequest): Promise<GenerateResult> {
    return collect(this.stream(req));
  }

  stream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    return guardStream((signal) => this.rawStream(req, signal), req);
  }

  private async *rawStream(req: GenerateRequest, signal: AbortSignal): AsyncGenerator<StreamEvent> {
    const started = performance.now();
    const body = {
      model: this.wireModel(req),
      messages: toOpenAIMessages(req.messages),
      stream: true,
      stream_options: { include_usage: true },
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.topP !== undefined ? { top_p: req.topP } : {}),
      ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
      ...(req.stop?.length ? { stop: req.stop } : {}),
      ...(req.tools?.length
        ? { tools: req.tools.map((t) => ({ type: "function", function: t })), tool_choice: "auto" }
        : {}),
    };
    // Retries happen only while connecting. Once tokens flow, a failure is
    // surfaced to the caller instead of silently regenerating a different answer.
    const res = await withRetry(
      () =>
        providerFetch(`${this.v1}/chat/completions`, {
          method: "POST",
          headers: this.headers(),
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
    let finish: string | null | undefined = null;
    let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
    let model = req.model;
    const calls = new Map<number, ToolCall>();

    for await (const data of sseData(res.body)) {
      if (data === "[DONE]") break;
      const chunk = parseJsonOrThrow(data) as OAIChunk;
      if (chunk.error) throw new ProviderError("server", chunk.error.message ?? "Provider stream error");
      if (chunk.model) model = chunk.model;
      if (chunk.usage) usage = chunk.usage;
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta?.content;
      if (delta) {
        firstTokenMs ??= performance.now() - started;
        text += delta;
        yield { type: "delta", text: delta };
      }
      for (const tc of choice.delta?.tool_calls ?? []) {
        firstTokenMs ??= performance.now() - started;
        const cur = calls.get(tc.index) ?? { id: tc.id ?? `call_${tc.index}`, name: "", arguments: "" };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) cur.arguments += tc.function.arguments;
        calls.set(tc.index, cur);
      }
      if (choice.finish_reason) finish = choice.finish_reason;
    }

    const toolCalls = finalizeToolCalls(calls);
    for (const call of toolCalls) yield { type: "tool_call", call };
    const hasUsage = usage?.prompt_tokens != null && usage?.completion_tokens != null;
    yield {
      type: "done",
      result: {
        text,
        toolCalls,
        finishReason: mapFinish(finish, toolCalls.length > 0),
        usage: hasUsage
          ? { inputTokens: usage!.prompt_tokens!, outputTokens: usage!.completion_tokens!, source: "provider" }
          : { inputTokens: estimateMessagesTokens(req.messages), outputTokens: estimateTokens(text), source: "estimate" },
        model,
        latencyMs: Math.round(performance.now() - started),
        firstTokenMs: firstTokenMs === null ? null : Math.round(firstTokenMs),
      },
    };
  }

  async healthCheck(signal?: AbortSignal): Promise<ProviderHealth> {
    const t = performance.now();
    try {
      await providerFetch(`${this.v1}/models`, { method: "GET", headers: this.headers(), timeoutMs: 5000, signal });
      return { status: "healthy", latencyMs: Math.round(performance.now() - t) };
    } catch (err) {
      return { status: "down", latencyMs: Math.round(performance.now() - t), error: (err as Error).message };
    }
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return { streaming: true, toolCalling: true, vision: false, embeddings: false, loadUnload: false, loraAdapters: false };
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await providerFetch(`${this.v1}/models`, { method: "GET", headers: this.headers(), timeoutMs: 10_000 });
    const json = (await res.json()) as { data?: { id: string; max_model_len?: number }[] };
    return (json.data ?? []).map((m) => ({ id: m.id, contextLength: m.max_model_len ?? null, loaded: true }));
  }

  async getModelInfo(model: string): Promise<ModelInfo> {
    const all = await this.listModels();
    const found = all.find((m) => m.id === model);
    if (!found) throw new ProviderError("not_found", `Model ${model} is not served by ${this.name}`);
    return found;
  }

  async loadModel(_model: string, _opts?: { adapterName?: string; adapterPath?: string }): Promise<void> {
    throw new ProviderError("unsupported", `${this.name} does not support loading models at run time`);
  }

  async unloadModel(_model: string, _opts?: { adapterName?: string }): Promise<void> {
    throw new ProviderError("unsupported", `${this.name} does not support unloading models at run time`);
  }
}
