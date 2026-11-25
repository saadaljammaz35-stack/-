import { z } from 'zod';
import { json, type Queryable } from '@/lib/db';

export const PROVIDERS = ['anthropic', 'openai', 'gemini', 'deepseek', 'ollama'] as const;
export type ProviderId = (typeof PROVIDERS)[number];

const price = z.object({
  input: z.number().min(0),
  output: z.number().min(0),
  /** USD per 1M cache-read tokens; defaults to 10% of `input` when absent. */
  cacheRead: z.number().min(0).optional(),
  verified: z.boolean().default(false),
});

/**
 * Organization settings with defaults. Values are editable by the founder in /os/settings.
 * Model names and prices are defaults, not claims: the founder sets what their accounts use.
 */
export const SETTINGS_SCHEMA = {
  agents_paused: z.boolean(),
  'limits.workflow_usd': z.number().positive().max(100),
  'limits.meeting_usd': z.number().positive().max(100),
  'limits.daily_usd': z.number().positive().max(1000),
  'limits.monthly_usd': z.number().positive().max(10000),
  'limits.max_steps': z.number().int().min(1).max(12),
  'limits.max_parallel': z.number().int().min(1).max(6),
  'ai.fallback_order': z.array(z.enum(PROVIDERS)).min(1),
  'ai.models': z.record(z.enum(PROVIDERS), z.object({ standard: z.string().min(1), economy: z.string().min(1) })),
  /** USD per 1M tokens, keyed `provider:model`. Unknown models use `ai.unknown_price` (deliberately high). */
  'ai.prices': z.record(z.string(), price),
  'ai.unknown_price': price,
} as const;

export type SettingKey = keyof typeof SETTINGS_SCHEMA;
export type Settings = { [K in SettingKey]: z.infer<(typeof SETTINGS_SCHEMA)[K]> };

export const DEFAULT_SETTINGS: Settings = {
  agents_paused: false,
  // Measured on real runs: a full 6-step command on Claude Opus 5.5 costs about $1.3–1.5.
  'limits.workflow_usd': 3,
  'limits.meeting_usd': 1,
  'limits.daily_usd': 10,
  'limits.monthly_usd': 60,
  'limits.max_steps': 8,
  'limits.max_parallel': 3,
  'ai.fallback_order': ['anthropic', 'openai', 'gemini', 'deepseek', 'ollama'],
  'ai.models': {
    anthropic: { standard: 'claude-opus-5-5', economy: 'claude-haiku-5-5' },
    openai: { standard: 'gpt-5', economy: 'gpt-5-mini' },
    gemini: { standard: 'gemini-2.5-pro', economy: 'gemini-2.5-flash' },
    deepseek: { standard: 'deepseek-chat', economy: 'deepseek-chat' },
    ollama: { standard: 'llama3.1', economy: 'llama3.1' },
  },
  // Anthropic first-party list prices (USD per 1M tokens, Claude API pricing as of Nov 2026;
  // Haiku 5.5 rate is for prompts up to 100K tokens). Local models cost nothing per token.
  // Any other model uses the conservative `ai.unknown_price` until the founder sets its price.
  'ai.prices': {
    'anthropic:claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, verified: true },
    'anthropic:claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1, verified: true },
    'anthropic:claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, verified: true },
    'ollama:llama3.1': { input: 0, output: 0, verified: true },
  },
  'ai.unknown_price': { input: 15, output: 75, verified: false },
};

export async function getSettings(q: Queryable, orgId: string): Promise<Settings> {
  const rows = await q.query<{ key: string; value: unknown }>(
    'select key, value from ward.system_settings where org_id = $1',
    [orgId],
  );
  const out: Settings = structuredClone(DEFAULT_SETTINGS);
  for (const row of rows) {
    const key = row.key as SettingKey;
    const schema = SETTINGS_SCHEMA[key];
    if (!schema) continue;
    const parsed = schema.safeParse(row.value);
    if (parsed.success) (out as Record<string, unknown>)[key] = parsed.data;
  }
  return out;
}

export async function setSetting<K extends SettingKey>(
  q: Queryable,
  orgId: string,
  key: K,
  value: Settings[K],
  userId: string | null,
): Promise<void> {
  const parsed = SETTINGS_SCHEMA[key].parse(value);
  await q.query(
    `insert into ward.system_settings (org_id, key, value, updated_by) values ($1, $2, $3::jsonb, $4)
     on conflict (org_id, key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
    [orgId, key, json(parsed), userId],
  );
}
