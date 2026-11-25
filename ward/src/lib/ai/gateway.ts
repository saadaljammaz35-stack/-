import { z, type ZodType } from 'zod';
import { PROVIDERS, type ProviderId, type Settings } from '@/lib/settings';
import { anthropicAdapter } from '@/lib/ai/providers/anthropic';
import { deepseekAdapter, openaiAdapter } from '@/lib/ai/providers/openai';
import { geminiAdapter } from '@/lib/ai/providers/gemini';
import { ollamaAdapter } from '@/lib/ai/providers/ollama';
import {
  CostLimitError,
  NoProviderError,
  ProviderError,
  type ChatRequest,
  type ChatResult,
  type JsonSchema,
  type ProviderAdapter,
  type Usage,
} from '@/lib/ai/types';

/**
 * One entry point for every model call in WARD OS:
 *   provider selection per agent → economy tier for simple work → retries with backoff →
 *   fallback across configured providers → cost estimate checked BEFORE the call →
 *   token usage and real cost recorded AFTER every attempt.
 * Nothing here fabricates output: with no configured provider the call fails loudly.
 */

const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  gemini: geminiAdapter,
  deepseek: deepseekAdapter,
  ollama: ollamaAdapter,
};

const overrides = new Map<ProviderId, ProviderAdapter>();

/** Test hook: replace an adapter with a scripted one. Refuses to run in production. */
export function __setAdapterForTests(id: ProviderId, adapter: ProviderAdapter | null): void {
  if (process.env.NODE_ENV === 'production') throw new Error('Adapter overrides are disabled in production');
  if (adapter) overrides.set(id, adapter);
  else overrides.delete(id);
}

export function adapterFor(id: ProviderId): ProviderAdapter {
  return overrides.get(id) ?? ADAPTERS[id];
}

export function configuredProviders(): ProviderId[] {
  return PROVIDERS.filter((p) => adapterFor(p).configured());
}

export interface Price {
  input: number;
  output: number;
  cacheRead?: number;
  verified: boolean;
}

export function priceFor(settings: Settings, provider: ProviderId, model: string): Price {
  return settings['ai.prices'][`${provider}:${model}`] ?? settings['ai.unknown_price'];
}

/** Cache writes (5-minute TTL) bill at 1.25× input; cache reads at the model's read price. */
export function costOf(price: Price, usage: Usage): number {
  const cacheRead = price.cacheRead ?? price.input * 0.1;
  return (
    usage.inputTokens * price.input +
    (usage.cacheWriteTokens ?? 0) * price.input * 1.25 +
    (usage.cacheReadTokens ?? 0) * cacheRead +
    usage.outputTokens * price.output
  ) / 1_000_000;
}

/** Total prompt size, cached or not (what was actually sent). */
export const totalInput = (u: Usage) => u.inputTokens + (u.cacheWriteTokens ?? 0) + (u.cacheReadTokens ?? 0);

/** Deliberately pessimistic: ~2.5 characters per token (Arabic tokenizes densely). */
export function estimateInputTokens(req: Omit<ChatRequest, 'model'>): number {
  const chars =
    req.system.length +
    req.messages.reduce((n, m) => n + m.content.length + ('toolCalls' in m && m.toolCalls ? JSON.stringify(m.toolCalls).length : 0), 0) +
    (req.tools ? JSON.stringify(req.tools).length : 0) +
    (req.responseSchema ? JSON.stringify(req.responseSchema.schema).length : 0);
  return Math.ceil(chars / 2.5);
}

export interface Candidate {
  provider: ProviderId;
  model: string;
}

export interface Preference {
  provider?: ProviderId | null;
  model?: string | null;
  economyModel?: string | null;
}

export function candidates(settings: Settings, tier: 'standard' | 'economy', prefer?: Preference): Candidate[] {
  const list: Candidate[] = [];
  if (prefer?.provider) {
    const chosen = tier === 'economy' ? prefer.economyModel : prefer.model;
    list.push({ provider: prefer.provider, model: chosen || settings['ai.models'][prefer.provider][tier] });
  }
  for (const p of settings['ai.fallback_order']) {
    if (!list.some((c) => c.provider === p)) list.push({ provider: p, model: settings['ai.models'][p][tier] });
  }
  return list.filter((c) => adapterFor(c.provider).configured());
}

export interface Attempt {
  provider: ProviderId;
  model: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
  usage: Usage;
  costUsd: number;
  priceVerified: boolean;
}

export interface CompleteOptions {
  settings: Settings;
  tier: 'standard' | 'economy';
  prefer?: Preference;
  request: Omit<ChatRequest, 'model'>;
  /** Called before every attempt with the worst-case cost; throw CostLimitError to stop. */
  guard?: (estimateUsd: number) => Promise<void> | void;
  /** Called after every attempt (success or failure) so usage is recorded even on errors. */
  record?: (attempt: Attempt) => Promise<void> | void;
}

export type CompleteResult = ChatResult & { costUsd: number; priceVerified: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryBase = () => Number(process.env.WARD_RETRY_BASE_MS ?? 500);
const MAX_ATTEMPTS_PER_PROVIDER = 3;

export async function complete(opts: CompleteOptions): Promise<CompleteResult> {
  const list = candidates(opts.settings, opts.tier, opts.prefer);
  if (list.length === 0) throw new NoProviderError();

  let lastError: unknown = null;
  for (const c of list) {
    const price = priceFor(opts.settings, c.provider, c.model);
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROVIDER; attempt++) {
      if (opts.request.signal?.aborted) throw new Error('aborted');
      await opts.guard?.(costOf(price, { inputTokens: estimateInputTokens(opts.request), outputTokens: opts.request.maxTokens }));
      const started = Date.now();
      try {
        const result = await adapterFor(c.provider).chat({ ...opts.request, model: c.model });
        const costUsd = costOf(price, result.usage);
        await opts.record?.({ provider: c.provider, model: c.model, ok: true, latencyMs: Date.now() - started, usage: result.usage, costUsd, priceVerified: price.verified });
        return { ...result, costUsd, priceVerified: price.verified };
      } catch (err) {
        if (err instanceof CostLimitError) throw err;
        lastError = err;
        await opts.record?.({
          provider: c.provider,
          model: c.model,
          ok: false,
          error: err instanceof Error ? err.message.slice(0, 500) : String(err),
          latencyMs: Date.now() - started,
          usage: { inputTokens: 0, outputTokens: 0 },
          costUsd: 0,
          priceVerified: price.verified,
        });
        if (err instanceof ProviderError && err.retryable && attempt < MAX_ATTEMPTS_PER_PROVIDER - 1) {
          await sleep(retryBase() * 2 ** attempt);
          continue;
        }
        break; // non-retryable or exhausted: fall back to the next configured provider
      }
    }
  }
  throw lastError ?? new NoProviderError();
}

/** Pull the first JSON object out of a model reply (tolerates code fences and prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('no JSON object in model output');
  }
}

export function jsonSchemaOf(schema: ZodType): JsonSchema {
  const out = z.toJSONSchema(schema) as JsonSchema;
  delete out.$schema;
  return out;
}

/**
 * Structured output with validation. One repair round is allowed; after that the
 * call fails instead of passing unvalidated data downstream.
 */
export async function completeJson<T>(
  opts: CompleteOptions & { name: string; schema: ZodType<T> },
): Promise<{ data: T; result: CompleteResult }> {
  const responseSchema = { name: opts.name, schema: jsonSchemaOf(opts.schema) };
  const request = { ...opts.request, responseSchema };
  const first = await complete({ ...opts, request });
  const parse = (text: string) => {
    try {
      return opts.schema.safeParse(extractJson(text));
    } catch (err) {
      return { success: false as const, error: err as Error };
    }
  };
  let parsed = parse(first.text);
  if (parsed.success) return { data: parsed.data, result: first };

  const problem = parsed.error instanceof Error ? parsed.error.message : String(parsed.error);
  const second = await complete({
    ...opts,
    request: {
      ...request,
      messages: [
        ...request.messages,
        { role: 'assistant', content: first.text.slice(0, 4000) },
        { role: 'user', content: `Your reply did not match the required JSON schema (${problem.slice(0, 400)}). Reply again with ONLY the corrected JSON object.` },
      ],
    },
  });
  parsed = parse(second.text);
  if (!parsed.success) throw new Error(`structured_output_invalid: ${opts.name}`);
  return {
    data: parsed.data,
    result: {
      ...second,
      usage: {
        inputTokens: first.usage.inputTokens + second.usage.inputTokens,
        outputTokens: first.usage.outputTokens + second.usage.outputTokens,
      },
      costUsd: first.costUsd + second.costUsd,
    },
  };
}

/**
 * Streaming completion. Falls back to the next provider only if a failure happens
 * before the first token; once text has been sent the stream cannot be swapped.
 */
export async function* streamComplete(opts: CompleteOptions): AsyncGenerator<{ type: 'text'; delta: string } | { type: 'done'; result: CompleteResult }> {
  const list = candidates(opts.settings, opts.tier, opts.prefer);
  if (list.length === 0) throw new NoProviderError();
  let lastError: unknown = null;
  for (const c of list) {
    const price = priceFor(opts.settings, c.provider, c.model);
    await opts.guard?.(costOf(price, { inputTokens: estimateInputTokens(opts.request), outputTokens: opts.request.maxTokens }));
    const started = Date.now();
    let emitted = false;
    try {
      for await (const ev of adapterFor(c.provider).stream({ ...opts.request, model: c.model })) {
        if (ev.type === 'text') {
          emitted = true;
          yield ev;
        } else {
          const costUsd = costOf(price, ev.result.usage);
          await opts.record?.({ provider: c.provider, model: c.model, ok: true, latencyMs: Date.now() - started, usage: ev.result.usage, costUsd, priceVerified: price.verified });
          yield { type: 'done', result: { ...ev.result, costUsd, priceVerified: price.verified } };
          return;
        }
      }
    } catch (err) {
      lastError = err;
      await opts.record?.({
        provider: c.provider,
        model: c.model,
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 500) : String(err),
        latencyMs: Date.now() - started,
        usage: { inputTokens: 0, outputTokens: 0 },
        costUsd: 0,
        priceVerified: price.verified,
      });
      if (emitted) throw err;
    }
  }
  throw lastError ?? new NoProviderError();
}
