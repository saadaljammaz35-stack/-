import "server-only";
import { z } from "zod";

const bool = (def: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const isProd = process.env.NODE_ENV === "production";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_SSL: bool(false),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  // 32 random bytes, base64. Seals provider API keys stored in the database.
  OMNIX_SECRETS_KEY: z.string().optional(),
  // false = nobody can create new accounts (existing users still sign in).
  OMNIX_REGISTRATION_OPEN: bool(true),
  OMNIX_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 90).default(24 * 7),
  OMNIX_PUBLIC_ORIGIN: z.string().url().optional(),

  OMNIX_STORAGE_DIR: z.string().default(".storage"),
  OMNIX_MODELS_DIR: z.string().default(".models"),
  OMNIX_MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(25).default(25),
  OMNIX_INLINE_JOBS: bool(!isProd),

  // Platform model providers (server-side only; never exposed to browsers).
  OMNIX_LOCAL_ONNX_ENABLED: bool(!isProd),
  OMNIX_LOCAL_ONNX_MODEL: z.string().default("onnx-community/Qwen2.5-0.5B-Instruct"),
  OMNIX_LOCAL_ONNX_BASE_MODEL: z.string().default("Qwen/Qwen2.5-0.5B-Instruct"),
  OMNIX_LOCAL_ONNX_DTYPE: z.enum(["fp32", "fp16", "q8", "int8", "uint8", "q4", "q4f16", "bnb4"]).default("q8"),
  OMNIX_ALLOW_MODEL_DOWNLOAD: bool(!isProd),
  OLLAMA_URL: z.string().url().optional(),
  VLLM_URL: z.string().url().optional(),
  OPENAI_COMPAT_URL: z.string().url().optional(),
  OPENAI_COMPAT_NAME: z.string().default("openai-compatible"),
  HF_INFERENCE_URL: z.string().url().default("https://router.huggingface.co/v1"),

  // Embeddings
  // "none": no embedding model (e.g. serverless hosting without a model
  // server). Knowledge search and memory recall then use keyword matching
  // only; set a provider later and press Knowledge → Re-index all.
  EMBEDDING_PROVIDER: z.enum(["local_onnx", "ollama", "openai_compatible", "none"]).default("local_onnx"),
  EMBEDDING_MODEL: z.enum(["intfloat/multilingual-e5-small", "BAAI/bge-m3"]).default("intfloat/multilingual-e5-small"),
  EMBEDDING_URL: z.string().url().optional(),

  // Default base model recorded for new personal models.
  OMNIX_DEFAULT_PROVIDER: z.string().optional(),
  OMNIX_DEFAULT_BASE_MODEL: z.string().optional(),
  OMNIX_DEFAULT_PROVIDER_MODEL: z.string().optional(),

  OMNIX_ENABLE_FETCH_TOOL: bool(false),
  OMNIX_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default(isProd ? "info" : "debug"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid OMNIX configuration: ${issues}`);
  }
  cached = parsed.data;
  if (cached.NODE_ENV === "production") assertProductionSafety(cached);
  return cached;
}

/** Fail the boot instead of running production in an unsafe configuration. */
export function assertProductionSafety(e: Env): void {
  const problems: string[] = [];
  const key = e.OMNIX_SECRETS_KEY ? Buffer.from(e.OMNIX_SECRETS_KEY, "base64") : null;
  if (!key || key.length !== 32) problems.push("OMNIX_SECRETS_KEY must be 32 random bytes, base64-encoded");
  if (e.OMNIX_SECRETS_KEY && /dev|test|change|example/i.test(e.OMNIX_SECRETS_KEY)) {
    problems.push("OMNIX_SECRETS_KEY looks like a placeholder");
  }
  if (!e.OMNIX_PUBLIC_ORIGIN?.startsWith("https://")) problems.push("OMNIX_PUBLIC_ORIGIN must be an https:// origin");
  if (/password|_dev@|:omnix_app_dev/i.test(e.DATABASE_URL)) problems.push("DATABASE_URL uses a development credential");
  if (e.OMNIX_ALLOW_MODEL_DOWNLOAD) problems.push("OMNIX_ALLOW_MODEL_DOWNLOAD must be false in production (pin artifacts)");
  if (problems.length) throw new Error(`Refusing to start in production:\n - ${problems.join("\n - ")}`);
}

/** For tests only. */
export function resetEnvCache(): void {
  cached = null;
}
