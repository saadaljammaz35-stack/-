import "server-only";
import path from "node:path";
import { env } from "@/lib/config/env";
import { AppError } from "@/lib/http/errors";
import { EMBEDDING_MODELS, type EmbeddingModelId } from "../models/catalog";
import { OllamaProvider } from "../providers/ollama";
import { providerFetch } from "../providers/resilience";

export interface Embedder {
  readonly model: EmbeddingModelId;
  readonly dims: number;
  embed(texts: string[], kind: "query" | "passage", signal?: AbortSignal): Promise<number[][]>;
}

type FeatureExtractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

const g = globalThis as unknown as { __omnixEmbedder?: Embedder; __omnixEmbedPipe?: Promise<FeatureExtractor> };

function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/** e5 models were trained with "query: " / "passage: " prefixes and lose quality without them. */
function prefixed(model: EmbeddingModelId, texts: string[], kind: "query" | "passage"): string[] {
  return EMBEDDING_MODELS[model].prefixes ? texts.map((t) => `${kind}: ${t}`) : texts;
}

class LocalOnnxEmbedder implements Embedder {
  readonly dims: number;
  constructor(readonly model: EmbeddingModelId) {
    this.dims = EMBEDDING_MODELS[model].dims;
    if (!EMBEDDING_MODELS[model].onnx) throw new AppError("PRECONDITION_FAILED", `${model} has no ONNX build configured`);
  }
  private pipe(): Promise<FeatureExtractor> {
    g.__omnixEmbedPipe ??= (async () => {
      const t = await import("@huggingface/transformers");
      t.env.cacheDir = path.resolve(process.env.OMNIX_MODELS_DIR ?? ".models");
      t.env.allowRemoteModels = process.env.OMNIX_ALLOW_MODEL_DOWNLOAD !== "false" && process.env.NODE_ENV !== "production";
      return (await t.pipeline("feature-extraction", EMBEDDING_MODELS[this.model].onnx!, { dtype: "q8" })) as unknown as FeatureExtractor;
    })().catch((err) => {
      g.__omnixEmbedPipe = undefined;
      throw new AppError("PROVIDER_UNAVAILABLE", `Embedding model could not be loaded: ${(err as Error).message}`);
    });
    return g.__omnixEmbedPipe;
  }
  async embed(texts: string[], kind: "query" | "passage"): Promise<number[][]> {
    if (texts.length === 0) return [];
    const p = await this.pipe();
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 16) {
      const batch = prefixed(this.model, texts.slice(i, i + 16), kind);
      out.push(...(await p(batch, { pooling: "mean", normalize: true })).tolist());
    }
    return out;
  }
}

class OllamaEmbedder implements Embedder {
  readonly dims: number;
  private readonly client: OllamaProvider;
  constructor(readonly model: EmbeddingModelId, baseUrl: string) {
    this.dims = EMBEDDING_MODELS[model].dims;
    this.client = new OllamaProvider({ name: "ollama-embed", baseUrl });
  }
  async embed(texts: string[], kind: "query" | "passage", signal?: AbortSignal): Promise<number[][]> {
    const tag = EMBEDDING_MODELS[this.model].ollamaTag ?? this.model;
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 32) {
      out.push(...(await this.client.embed(tag, prefixed(this.model, texts.slice(i, i + 32), kind), signal)).map(normalize));
    }
    return out;
  }
}

/** Text Embeddings Inference, vLLM and OpenAI-style `/v1/embeddings`. */
class OpenAICompatEmbedder implements Embedder {
  readonly dims: number;
  constructor(readonly model: EmbeddingModelId, private readonly baseUrl: string) {
    this.dims = EMBEDDING_MODELS[model].dims;
  }
  async embed(texts: string[], kind: "query" | "passage", signal?: AbortSignal): Promise<number[][]> {
    const url = `${this.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1/embeddings`;
    const key = process.env.OMNIX_PROVIDER_SECRET_EMBEDDINGS;
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 32) {
      const res = await providerFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ model: this.model, input: prefixed(this.model, texts.slice(i, i + 32), kind) }),
        timeoutMs: 120_000,
        signal,
      });
      const j = (await res.json()) as { data?: { embedding: number[]; index: number }[] };
      out.push(...(j.data ?? []).sort((a, b) => a.index - b.index).map((d) => normalize(d.embedding)));
    }
    return out;
  }
}

/** Test hook: lets integration tests use a deterministic embedder. */
export function setEmbedderForTests(e: Embedder | undefined): void {
  g.__omnixEmbedder = e;
}

export function embedder(): Embedder {
  if (g.__omnixEmbedder) return g.__omnixEmbedder;
  const e = env();
  const model = e.EMBEDDING_MODEL;
  let em: Embedder;
  if (e.EMBEDDING_PROVIDER === "local_onnx") em = new LocalOnnxEmbedder(model);
  else if (e.EMBEDDING_PROVIDER === "ollama") {
    const url = e.EMBEDDING_URL ?? e.OLLAMA_URL;
    if (!url) throw new AppError("PRECONDITION_FAILED", "EMBEDDING_PROVIDER=ollama needs EMBEDDING_URL or OLLAMA_URL");
    em = new OllamaEmbedder(model, url);
  } else {
    if (!e.EMBEDDING_URL) throw new AppError("PRECONDITION_FAILED", "EMBEDDING_PROVIDER=openai_compatible needs EMBEDDING_URL");
    em = new OpenAICompatEmbedder(model, e.EMBEDDING_URL);
  }
  g.__omnixEmbedder = em;
  return em;
}

/** pgvector text literal. Values are finite floats produced by our code, never user text. */
export function toVectorLiteral(v: number[]): string {
  if (!v.every(Number.isFinite)) throw new AppError("INTERNAL", "Non-finite embedding value");
  return `[${v.map((x) => x.toFixed(7)).join(",")}]`;
}
