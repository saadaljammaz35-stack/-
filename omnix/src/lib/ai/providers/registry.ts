import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/config/env";
import type { Db } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { log } from "@/lib/log";
import { resolveSecretReference } from "@/lib/security/secrets";
import { findCandidate } from "../models/catalog";
import { HuggingFaceProvider } from "./huggingface";
import { LocalOnnxProvider } from "./local-onnx";
import { OllamaProvider } from "./ollama";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { ModelProvider, ProviderType } from "./types";
import { VllmProvider } from "./vllm";

export interface ProviderRecord {
  id: string;
  ownerId: string | null;
  providerName: string;
  providerType: ProviderType;
  endpoint: string | null;
  capabilities: Record<string, unknown>;
  status: string;
  lastHealthAt: string | null;
  lastHealthError: string | null;
  lastLatencyMs: number | null;
}

export function providerFromRow(r: Record<string, unknown>): ProviderRecord {
  return {
    id: r.id as string,
    ownerId: (r.owner_id as string | null) ?? null,
    providerName: r.provider_name as string,
    providerType: r.provider_type as ProviderType,
    endpoint: (r.endpoint as string | null) ?? null,
    capabilities: (r.capabilities as Record<string, unknown>) ?? {},
    status: r.status as string,
    lastHealthAt: r.last_health_at ? new Date(r.last_health_at as string).toISOString() : null,
    lastHealthError: (r.last_health_error as string | null) ?? null,
    lastLatencyMs: (r.last_latency_ms as number | null) ?? null,
  };
}

/** Platform providers come from server configuration, never from users. */
export function platformProviderConfigs(): { name: string; type: ProviderType; endpoint: string | null; capabilities: Record<string, unknown> }[] {
  const e = env();
  const out: { name: string; type: ProviderType; endpoint: string | null; capabilities: Record<string, unknown> }[] = [];
  if (e.VLLM_URL) out.push({ name: "vllm", type: "vllm", endpoint: e.VLLM_URL, capabilities: { tier: "production" } });
  if (e.OLLAMA_URL) out.push({ name: "ollama", type: "ollama", endpoint: e.OLLAMA_URL, capabilities: { tier: "development" } });
  if (e.OPENAI_COMPAT_URL) {
    out.push({ name: e.OPENAI_COMPAT_NAME, type: "openai_compatible", endpoint: e.OPENAI_COMPAT_URL, capabilities: {} });
  }
  if (process.env.OMNIX_PROVIDER_SECRET_HUGGINGFACE) {
    out.push({ name: "huggingface", type: "huggingface", endpoint: e.HF_INFERENCE_URL, capabilities: { tier: "hosted" } });
  }
  if (e.OMNIX_LOCAL_ONNX_ENABLED) {
    out.push({
      name: "local-onnx",
      type: "local_onnx",
      endpoint: null,
      capabilities: { tier: "development", onnxModel: e.OMNIX_LOCAL_ONNX_MODEL, dtype: e.OMNIX_LOCAL_ONNX_DTYPE },
    });
  }
  return out;
}

const synced = globalThis as unknown as { __omnixProvidersSynced?: string };

export async function syncPlatformProviders(db: Db): Promise<void> {
  const configs = platformProviderConfigs();
  const fingerprint = JSON.stringify(configs);
  if (synced.__omnixProvidersSynced === fingerprint) return;
  for (const c of configs) {
    await db.query("SELECT omnix_upsert_platform_provider($1, $2, $3, $4)", [c.name, c.type, c.endpoint, c.capabilities]);
  }
  synced.__omnixProvidersSynced = fingerprint;
}

const cache = new Map<string, ModelProvider>();

function platformSecret(name: string): string | null {
  const key = `OMNIX_PROVIDER_SECRET_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return process.env[key] ?? null;
}

export function buildProvider(rec: ProviderRecord, secret: string | null): ModelProvider {
  const fp = createHash("sha256").update(`${rec.id}|${rec.endpoint}|${secret ?? ""}|${JSON.stringify(rec.capabilities)}`).digest("hex");
  const hit = cache.get(fp);
  if (hit) return hit;
  let p: ModelProvider;
  switch (rec.providerType) {
    case "ollama":
      p = new OllamaProvider({ name: rec.providerName, baseUrl: rec.endpoint! });
      break;
    case "vllm":
      p = new VllmProvider({ name: rec.providerName, baseUrl: rec.endpoint!, apiKey: secret });
      break;
    case "openai_compatible":
      p = new OpenAICompatibleProvider({ name: rec.providerName, baseUrl: rec.endpoint!, apiKey: secret });
      break;
    case "huggingface":
      p = new HuggingFaceProvider({ name: rec.providerName, baseUrl: rec.endpoint!, apiKey: secret });
      break;
    case "local_onnx": {
      if (!env().OMNIX_LOCAL_ONNX_ENABLED) throw new AppError("PROVIDER_UNAVAILABLE", "The in-process provider is disabled on this server");
      const caps = rec.capabilities as { onnxModel?: string; dtype?: string };
      p = new LocalOnnxProvider({
        name: rec.providerName,
        onnxModel: caps.onnxModel ?? env().OMNIX_LOCAL_ONNX_MODEL,
        dtype: caps.dtype ?? env().OMNIX_LOCAL_ONNX_DTYPE,
      });
      break;
    }
  }
  cache.set(fp, p);
  return p;
}

/** Loads a provider visible to the current RLS user and resolves its credential. */
export async function loadProvider(db: Db, providerId: string): Promise<{ record: ProviderRecord; provider: ModelProvider }> {
  const r = await db.query("SELECT * FROM ai_model_providers WHERE id = $1", [providerId]);
  if (!r.rowCount) throw new AppError("NOT_FOUND", "Model provider not found");
  const record = providerFromRow(r.rows[0]);
  if (record.status === "disabled") throw new AppError("PROVIDER_UNAVAILABLE", `Provider ${record.providerName} is disabled`);
  let secret: string | null = null;
  if (record.ownerId === null) {
    secret = platformSecret(record.providerName);
  } else {
    const c = await db.query<{ secret_reference: string }>("SELECT secret_reference FROM ai_model_connections WHERE provider_id = $1", [providerId]);
    if (c.rows[0]) secret = resolveSecretReference(c.rows[0].secret_reference);
  }
  return { record, provider: buildProvider(record, secret) };
}

export async function recordHealth(db: Db, providerId: string, provider: ModelProvider): Promise<{ status: string; latencyMs: number; error?: string; version?: string }> {
  const h = await provider.healthCheck();
  await db.query("SELECT omnix_record_provider_health($1, $2, $3, $4)", [providerId, h.status, h.error ?? null, h.latencyMs]);
  if (h.status !== "healthy") log.warn("provider.unhealthy", { providerId, error: h.error });
  return h;
}

/**
 * Which provider and model a brand-new personal model starts on. Preference
 * order puts real serving infrastructure first; the in-process model is the
 * fallback for development.
 */
export async function defaultBaseSelection(db: Db): Promise<{ providerId: string; baseModel: string; providerModel: string; providerType: ProviderType }> {
  await syncPlatformProviders(db);
  const e = env();
  const rows = (await db.query("SELECT * FROM ai_model_providers WHERE owner_id IS NULL AND status <> 'disabled'")).rows.map(providerFromRow);
  const order: ProviderType[] = ["vllm", "ollama", "openai_compatible", "huggingface", "local_onnx"];
  const chosen =
    (e.OMNIX_DEFAULT_PROVIDER && rows.find((p) => p.providerName === e.OMNIX_DEFAULT_PROVIDER)) ||
    order.map((t) => rows.find((p) => p.providerType === t)).find(Boolean);
  if (!chosen) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "No model provider is configured. Set VLLM_URL or OLLAMA_URL, or enable OMNIX_LOCAL_ONNX_ENABLED for development.",
    );
  }
  if (chosen.providerType === "local_onnx") {
    return { providerId: chosen.id, baseModel: e.OMNIX_LOCAL_ONNX_BASE_MODEL, providerModel: e.OMNIX_LOCAL_ONNX_MODEL, providerType: "local_onnx" };
  }
  const baseModel = e.OMNIX_DEFAULT_BASE_MODEL ?? "Qwen/Qwen3-8B";
  const providerModel =
    e.OMNIX_DEFAULT_PROVIDER_MODEL ?? (chosen.providerType === "ollama" ? (findCandidate(baseModel)?.ollamaTag ?? baseModel) : baseModel);
  return { providerId: chosen.id, baseModel, providerModel, providerType: chosen.providerType };
}
