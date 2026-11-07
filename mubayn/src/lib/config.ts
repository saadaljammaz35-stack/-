import { z } from "zod";

/**
 * Runtime configuration. Parsed once, on first use (not at import time, so
 * `next build` does not need production secrets).
 *
 * Development conveniences — the local storage driver, the console e-mail
 * driver, API base-URL overrides — are REFUSED when NODE_ENV=production, so a
 * misconfigured deployment fails loudly instead of quietly faking a feature.
 */

const bool = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: bool,
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),

  // 32 random bytes, base64. Encrypts MFA secrets at rest.
  ENCRYPTION_KEY: z.string().min(40),

  // Storage
  STORAGE_DRIVER: z.enum(["s3", "local"]).default("local"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool,
  LOCAL_STORAGE_DIR: z.string().default(".storage"),

  // E-mail
  // "none": no e-mail at all. Accounts work at once and reset passwords
  // with one-time recovery codes; results are only shown on the site.
  EMAIL_DRIVER: z.enum(["resend", "console", "none"]).default("console"),
  RESEND_API_KEY: z.string().trim().optional(),
  EMAIL_FROM: z.string().default("MUBAYN <no-reply@localhost>"),

  // AI
  ANTHROPIC_API_KEY: z.string().trim().optional(),
  ANTHROPIC_BASE_URL_OVERRIDE: z.string().url().optional(),
  AI_MODEL: z.string().default("claude-opus-5-5"),
  AI_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("high"),

  // Operations
  CRON_SECRET: z.string().min(24).optional(),
  TRUST_PROXY: bool,
  CHROMIUM_EXECUTABLE_PATH: z.string().optional(),
  FFMPEG_PATH: z.string().optional(),

  // Business identity. Shown on receipts and legal pages. Never invented:
  // if a value is missing the page says it is missing.
  BUSINESS_LEGAL_NAME: z.string().optional(),
  BUSINESS_CR_NUMBER: z.string().optional(),
  BUSINESS_ADDRESS: z.string().optional(),
  BUSINESS_COUNTRY: z.string().default("SA"),
  SUPPORT_EMAIL: z.string().email().optional(),
});

export type Config = z.infer<typeof schema>;

let cached: Config | null = null;

export class ConfigError extends Error {}

export function config(): Config {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new ConfigError(`Invalid configuration: ${issues}`);
  }
  const c = parsed.data;
  if (c.NODE_ENV === "production") assertProductionSafe(c);
  cached = c;
  return c;
}

/** For tests only. */
export function resetConfigForTests(): void {
  cached = null;
}

function assertProductionSafe(c: Config): void {
  const problems: string[] = [];
  if (!c.APP_URL.startsWith("https://")) problems.push("APP_URL must be https in production");
  if (c.STORAGE_DRIVER !== "s3") problems.push("STORAGE_DRIVER=local is not allowed in production");
  if (c.EMAIL_DRIVER === "console") problems.push("EMAIL_DRIVER=console is not allowed in production");
  if (c.ANTHROPIC_BASE_URL_OVERRIDE) problems.push("ANTHROPIC_BASE_URL_OVERRIDE is test-only");
  if (c.ENCRYPTION_KEY.includes("dev")) problems.push("ENCRYPTION_KEY looks like a development key");
  if (problems.length) throw new ConfigError(`Refusing to start: ${problems.join("; ")}`);
}

/** False when the deployment sends no e-mail at all (EMAIL_DRIVER=none). */
export function emailEnabled(): boolean {
  return config().EMAIL_DRIVER !== "none";
}

export function isProduction(): boolean {
  return config().NODE_ENV === "production";
}

/**
 * API keys are sent as HTTP header values, so anything other than the bare
 * key (a pasted curl command, quotes, spaces) cannot work and would end up
 * quoted in error messages. Such a value is treated as not configured.
 */
export function apiKeyProblem(value: string | undefined): "missing" | "malformed" | null {
  if (!value) return "missing";
  return /^[A-Za-z0-9_-]{16,}$/.test(value) ? null : "malformed";
}

export const MALFORMED_KEY_DETAIL = "malformed: paste only the key itself, without a command, quotes or spaces";

/** What is wired up for real, and what still blocks selling. Shown in admin. */
export function launchReadiness(): { item: string; itemAr: string; ok: boolean; detail: string }[] {
  const c = config();
  const has = (v?: string) => Boolean(v && v.trim());
  return [
    { item: "HTTPS app URL", itemAr: "رابط الموقع بـ HTTPS", ok: c.APP_URL.startsWith("https://"), detail: c.APP_URL },
    { item: "Private object storage (S3-compatible)", itemAr: "تخزين خاص للأدلة", ok: c.STORAGE_DRIVER === "s3" && has(c.S3_BUCKET), detail: c.STORAGE_DRIVER },
    c.EMAIL_DRIVER === "none"
      ? { item: "E-mail (off by choice: accounts use recovery codes)", itemAr: "البريد الإلكتروني (معطّل باختيارك: الحسابات تستخدم رموز الاستعادة)", ok: true, detail: "none" }
      : { item: "Transactional e-mail (Resend)", itemAr: "البريد الإلكتروني (Resend)", ok: c.EMAIL_DRIVER === "resend" && apiKeyProblem(c.RESEND_API_KEY) === null, detail: apiKeyProblem(c.RESEND_API_KEY) === "malformed" ? MALFORMED_KEY_DETAIL : c.EMAIL_DRIVER === "resend" && !c.RESEND_API_KEY ? "missing" : c.EMAIL_DRIVER },
    { item: "AI provider key (Anthropic)", itemAr: "مفتاح الذكاء الاصطناعي (Anthropic)", ok: apiKeyProblem(c.ANTHROPIC_API_KEY) === null, detail: apiKeyProblem(c.ANTHROPIC_API_KEY) === "malformed" ? MALFORMED_KEY_DETAIL : !c.ANTHROPIC_API_KEY ? "missing" : c.AI_MODEL },
    { item: "Cron secret for the job runner", itemAr: "مفتاح المهمة المجدولة", ok: has(c.CRON_SECRET), detail: "" },
    { item: "TRUST_PROXY=true behind the host's proxy (per-IP rate limits)", itemAr: "تحديد معدل الطلبات لكل عنوان IP (TRUST_PROXY)", ok: c.TRUST_PROXY, detail: c.TRUST_PROXY ? "on" : "off: every visitor shares one rate-limit bucket" },
    { item: "Business legal name", itemAr: "الاسم النظامي للمشغّل", ok: has(c.BUSINESS_LEGAL_NAME), detail: c.BUSINESS_LEGAL_NAME ?? "missing" },
    { item: "Commercial registration / freelance licence number (if operating as a business)", itemAr: "رقم السجل التجاري أو وثيقة العمل الحر", ok: has(c.BUSINESS_CR_NUMBER), detail: c.BUSINESS_CR_NUMBER ?? "missing" },
    { item: "Business address", itemAr: "عنوان المشغّل", ok: has(c.BUSINESS_ADDRESS), detail: c.BUSINESS_ADDRESS ?? "missing" },
    { item: "Support e-mail", itemAr: "بريد الدعم", ok: has(c.SUPPORT_EMAIL), detail: c.SUPPORT_EMAIL ?? "missing" },
  ];
}
