import "server-only";
import path from "node:path";
import { guardStream, collect } from "./resilience";
import {
  ProviderError,
  type GenerateRequest,
  type GenerateResult,
  type ModelInfo,
  type ModelProvider,
  type ProviderCapabilities,
  type ProviderHealth,
  type StreamEvent,
} from "./types";

// In-process inference with @huggingface/transformers (ONNX Runtime, CPU).
// Purpose: development and CI without any model server, so the full chat →
// stream → RAG path is exercised against a real open-weight model. It is
// not a production serving path (one request at a time, CPU only).

type TJs = typeof import("@huggingface/transformers");
type Generator = Awaited<ReturnType<TJs["pipeline"]>> & {
  tokenizer: {
    apply_chat_template: (m: unknown, o: Record<string, unknown>) => unknown;
  };
  model: { config: Record<string, unknown> };
  dispose: () => Promise<void>;
};

interface LoadedModel {
  gen: Generator;
  contextLength: number | null;
}

const g = globalThis as unknown as {
  __omnixOnnx?: Map<string, Promise<LoadedModel>>;
  __omnixOnnxQueue?: Promise<unknown>;
};
g.__omnixOnnx ??= new Map();

async function tjs(): Promise<TJs> {
  const mod = await import("@huggingface/transformers");
  mod.env.cacheDir = path.resolve(process.env.OMNIX_MODELS_DIR ?? ".models");
  mod.env.allowRemoteModels = process.env.OMNIX_ALLOW_MODEL_DOWNLOAD !== "false" && process.env.NODE_ENV !== "production";
  mod.env.allowLocalModels = true;
  return mod;
}

/** One generation at a time per process: ONNX Runtime on CPU would only thrash otherwise. */
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__omnixOnnxQueue ?? Promise.resolve()).then(fn, fn);
  g.__omnixOnnxQueue = run.catch(() => undefined);
  return run;
}

/** Minimal async queue bridging callback-based streaming to an AsyncIterator. */
class Channel<T> {
  private items: T[] = [];
  private waiters: ((v: IteratorResult<T>) => void)[] = [];
  private closed = false;
  private failure: unknown = null;
  push(v: T) {
    const w = this.waiters.shift();
    if (w) w({ value: v, done: false });
    else this.items.push(v);
  }
  close(err?: unknown) {
    this.closed = true;
    this.failure = err ?? null;
    for (const w of this.waiters.splice(0)) w({ value: undefined as T, done: true });
  }
  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    for (;;) {
      if (this.items.length) {
        yield this.items.shift()!;
        continue;
      }
      if (this.closed) {
        if (this.failure) throw this.failure;
        return;
      }
      const r = await new Promise<IteratorResult<T>>((res) => this.waiters.push(res));
      if (r.done) {
        if (this.failure) throw this.failure;
        return;
      }
      yield r.value;
    }
  }
}

export class LocalOnnxProvider implements ModelProvider {
  readonly type = "local_onnx" as const;
  readonly name: string;
  private readonly onnxModel: string;
  private readonly dtype: string;

  constructor(opts: { name: string; onnxModel: string; dtype: string }) {
    this.name = opts.name;
    this.onnxModel = opts.onnxModel;
    this.dtype = opts.dtype;
  }

  private load(): Promise<LoadedModel> {
    const key = `${this.onnxModel}@${this.dtype}`;
    let p = g.__omnixOnnx!.get(key);
    if (!p) {
      p = (async () => {
        const { pipeline } = await tjs();
        try {
          const gen = (await pipeline("text-generation", this.onnxModel, { dtype: this.dtype as "q8" })) as unknown as Generator;
          const cfg = gen.model.config;
          const ctx = Number(cfg.max_position_embeddings ?? 0) || null;
          return { gen, contextLength: ctx };
        } catch (err) {
          throw new ProviderError("unavailable", `Local model ${this.onnxModel} could not be loaded: ${(err as Error).message}`, {
            retryable: false,
            cause: err,
          });
        }
      })();
      p.catch(() => g.__omnixOnnx!.delete(key));
      g.__omnixOnnx!.set(key, p);
    }
    return p;
  }

  generate(req: GenerateRequest): Promise<GenerateResult> {
    return collect(this.stream(req));
  }

  stream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    return guardStream((signal) => this.rawStream(req, signal), req);
  }

  private async *rawStream(req: GenerateRequest, signal: AbortSignal): AsyncGenerator<StreamEvent> {
    if (req.tools?.length) {
      // Honest capability: this path does not implement tool calling. The
      // engine checks getCapabilities() and never sends tools here.
      throw new ProviderError("unsupported", "local_onnx does not support tool calling");
    }
    const started = performance.now();
    const { TextStreamer, InterruptableStoppingCriteria } = await tjs();
    const { gen } = await this.load();
    const messages = req.messages.map((m) => ({ role: m.role === "tool" ? "user" : m.role, content: m.content }));
    const encoded = gen.tokenizer.apply_chat_template(messages, {
      tokenize: true,
      add_generation_prompt: true,
      return_tensor: false,
      return_dict: false,
    }) as number[] | { input_ids?: number[] };
    const ids = Array.isArray(encoded) ? encoded : (encoded.input_ids ?? []);
    const inputTokens = ids.length;

    const channel = new Channel<string>();
    const stopper = new InterruptableStoppingCriteria();
    const onAbort = () => stopper.interrupt();
    signal.addEventListener("abort", onAbort, { once: true });
    let outputTokens = 0;
    let firstTokenMs: number | null = null;
    let text = "";

    const streamer = new TextStreamer(gen.tokenizer as never, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (t: string) => {
        if (!t) return;
        firstTokenMs ??= performance.now() - started;
        channel.push(t);
      },
      token_callback_function: (ids: bigint[]) => {
        outputTokens += ids.length;
      },
    });

    const maxNew = Math.max(1, Math.min(req.maxTokens ?? 512, 2048));
    const sample = (req.temperature ?? 0) > 0.01;
    const run = serialize(async () => {
      if (signal.aborted) return;
      await (gen as unknown as (m: unknown, o: Record<string, unknown>) => Promise<unknown>)(messages, {
        max_new_tokens: maxNew,
        do_sample: sample,
        ...(sample ? { temperature: req.temperature, top_p: req.topP ?? 0.9 } : {}),
        repetition_penalty: 1.1,
        streamer,
        stopping_criteria: stopper,
      });
    });
    run.then(
      () => channel.close(),
      (err) => channel.close(new ProviderError("server", `Local generation failed: ${(err as Error).message}`, { retryable: false, cause: err })),
    );

    try {
      for await (const delta of channel) {
        text += delta;
        yield { type: "delta", text: delta };
      }
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
    if (signal.aborted) throw new ProviderError("cancelled", "Request cancelled");

    yield {
      type: "done",
      result: {
        text,
        toolCalls: [],
        finishReason: outputTokens >= maxNew ? "length" : "stop",
        // Counted with the model's own tokenizer: exact, not estimated.
        usage: { inputTokens, outputTokens, source: "provider" },
        model: this.onnxModel,
        latencyMs: Math.round(performance.now() - started),
        firstTokenMs: firstTokenMs === null ? null : Math.round(firstTokenMs),
      },
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const t = performance.now();
    try {
      await this.load();
      return { status: "healthy", latencyMs: Math.round(performance.now() - t), version: "transformers.js" };
    } catch (err) {
      return { status: "down", latencyMs: Math.round(performance.now() - t), error: (err as Error).message };
    }
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return { streaming: true, toolCalling: false, vision: false, embeddings: true, loadUnload: true, loraAdapters: false };
  }

  async getModelInfo(model: string): Promise<ModelInfo> {
    const { contextLength } = await this.load();
    return { id: model, contextLength, quantization: this.dtype, loaded: true };
  }

  async listModels(): Promise<ModelInfo[]> {
    const key = `${this.onnxModel}@${this.dtype}`;
    return [{ id: this.onnxModel, contextLength: null, quantization: this.dtype, loaded: g.__omnixOnnx!.has(key) }];
  }

  async loadModel(): Promise<void> {
    await this.load();
  }

  async unloadModel(): Promise<void> {
    const key = `${this.onnxModel}@${this.dtype}`;
    const p = g.__omnixOnnx!.get(key);
    g.__omnixOnnx!.delete(key);
    if (p) await (await p).gen.dispose().catch(() => {});
  }
}
