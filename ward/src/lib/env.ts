import { z } from 'zod';

/**
 * Server-side environment. Read lazily (never at import time) so tests and scripts can
 * set process.env first. API keys are only ever read here, on the server, and are never
 * serialized to the client or stored in the database.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  PGLITE_DATA_DIR: z.string().default('.data/pglite'),
  WARD_ORG_SLUG: z.string().default('ward'),
  WARD_SITE_URL: z.string().url().optional(),
  WARD_INLINE_JOBS: z.enum(['true', 'false']).default('true'),
  CRON_SECRET: z.string().min(24).optional(),

  WARD_FOUNDER_EMAIL: z.string().email().optional(),
  WARD_FOUNDER_PASSWORD: z.string().min(12).optional(),
  WARD_FOUNDER_NAME: z.string().default('المؤسس'),

  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_BASE_URL: z.string().url().default('https://api.anthropic.com'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com/v1beta'),
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com/v1'),
  OLLAMA_BASE_URL: z.string().url().optional(),

  // Montage (automatic editing). Storage/runner default by environment — see src/lib/media.
  WARD_MEDIA_STORAGE: z.enum(['local', 'vercel-blob']).optional(),
  WARD_MEDIA_RUNNER: z.enum(['local', 'sandbox']).optional(),
  WARD_MEDIA_DIR: z.string().default('.data/media'),
  WARD_MEDIA_WORK_DIR: z.string().default('.data/media-work'),
  WARD_MEDIA_MAX_MB: z.coerce.number().int().min(10).max(500_000).default(8192),
  WARD_SANDBOX_VCPUS: z.coerce.number().int().min(1).max(8).default(4),
  WARD_SANDBOX_TIMEOUT_MIN: z.coerce.number().int().min(5).max(300).default(45),
  WARD_WHISPER_MODEL: z.string().default('large-v3-turbo'),

  RESEND_API_KEY: z.string().min(1).optional(),
  WARD_EMAIL_FROM: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function env(): Env {
  const parsed = schema.safeParse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== '')));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

export const isProduction = () => process.env.NODE_ENV === 'production';
