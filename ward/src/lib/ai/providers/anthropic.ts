import { env } from '@/lib/env';
import { parseArgs, postJson, sseData } from '@/lib/ai/http';
import { ProviderError, type ChatMessage, type ChatRequest, type ChatResult, type JsonSchema, type ProviderAdapter, type StreamEvent, type ToolCall } from '@/lib/ai/types';

/**
 * Anthropic Messages API (raw HTTP, `x-api-key`).
 *
 * Current-model rules this adapter follows (Claude Opus 5.5 / Sonnet 5.5 / Haiku 5.5 / Fable):
 *   - structured output uses `output_config.format` (forced `tool_choice` returns 400 on these models);
 *   - no `temperature` (non-default sampling values return 400);
 *   - assistant turns are echoed back exactly as received, thinking blocks included;
 *   - the tool list never changes inside a conversation: "answer without tools" is `tool_choice: none`;
 *   - `stop_reason: "refusal"` is surfaced as an error, and server-side fallbacks are requested
 *     on the models that support them.
 */

type Block = Record<string, unknown> & { type: string };

function toWire(messages: ChatMessage[]) {
  const out: { role: 'user' | 'assistant'; content: Block[] }[] = [];
  const push = (role: 'user' | 'assistant', blocks: Block[]) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const m of messages) {
    if (m.role === 'user') push('user', [{ type: 'text', text: m.content }]);
    else if (m.role === 'assistant') {
      if (m.raw?.provider === 'anthropic' && Array.isArray(m.raw.content) && m.raw.content.length) {
        push('assistant', m.raw.content as Block[]); // unchanged: keeps thinking blocks valid
        continue;
      }
      const blocks: Block[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args });
      if (blocks.length) push('assistant', blocks);
    } else push('user', [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }]);
  }
  return out;
}

const UNSUPPORTED_OUTPUT_KEYWORDS = new Set([
  '$schema', 'default', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minLength', 'maxLength', 'pattern', 'minItems', 'maxItems', 'uniqueItems', 'minProperties', 'maxProperties',
]);

/** JSON outputs accept a subset of JSON Schema; the full schema is still enforced in code (Zod). */
export function outputSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(outputSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (UNSUPPORTED_OUTPUT_KEYWORDS.has(k)) continue;
    out[k] =
      k === 'properties' && v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, outputSchema(pv)]))
        : outputSchema(v);
  }
  if (out.type === 'object') out.additionalProperties = false;
  return out;
}

/** Models with server-side refusal fallbacks (`fallbacks: "default"`). Haiku has none. */
const supportsFallbacks = (model: string) => /^claude-(fable|mythos|opus-5|sonnet-5-5)/.test(model);

function buildBody(req: ChatRequest, stream: boolean) {
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens,
    // Prompt caching for agent loops: a fixed breakpoint at the end of the static prefix
    // (tools render before system, so both are covered) plus automatic caching of the
    // growing conversation. Reads cost a fraction of input; prefixes too short simply don't cache.
    system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
    cache_control: { type: 'ephemeral' },
    messages: toWire(req.messages),
  };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    body.tool_choice = { type: req.toolChoice === 'none' ? 'none' : 'auto' };
  }
  if (req.responseSchema) {
    body.output_config = { format: { type: 'json_schema', schema: outputSchema(req.responseSchema.schema) as JsonSchema } };
  }
  if (supportsFallbacks(req.model)) body.fallbacks = 'default';
  if (stream) body.stream = true;
  return body;
}

const url = () => `${env().ANTHROPIC_BASE_URL.replace(/\/$/, '')}/v1/messages`;
const headers = (model: string) => ({
  'x-api-key': env().ANTHROPIC_API_KEY ?? '',
  'anthropic-version': '2023-06-01',
  ...(supportsFallbacks(model) ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
});

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

const usageOf = (u: AnthropicUsage | undefined): ChatResult['usage'] => ({
  inputTokens: u?.input_tokens ?? 0,
  outputTokens: u?.output_tokens ?? 0,
  cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
  cacheReadTokens: u?.cache_read_input_tokens ?? 0,
});

function refusal(stopReason: string | undefined, details: unknown): void {
  if (stopReason !== 'refusal') return;
  const category = details && typeof details === 'object' ? String((details as { category?: unknown }).category ?? 'unknown') : 'unknown';
  throw new ProviderError('anthropic', `refusal (${category})`, 200, false);
}

export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  configured: () => Boolean(env().ANTHROPIC_API_KEY),

  async chat(req) {
    const res = await postJson('anthropic', url(), headers(req.model), buildBody(req, false), req.signal);
    const data = (await res.json()) as {
      content?: Block[];
      model?: string;
      usage?: AnthropicUsage;
      stop_reason?: string;
      stop_details?: unknown;
    };
    refusal(data.stop_reason, data.stop_details);
    let text = '';
    const calls: ToolCall[] = [];
    for (const b of data.content ?? []) {
      if (b.type === 'text' && typeof b.text === 'string') text += b.text;
      else if (b.type === 'tool_use') calls.push({ id: String(b.id), name: String(b.name), args: (b.input as Record<string, unknown>) ?? {} });
    }
    return {
      text,
      toolCalls: calls,
      usage: usageOf(data.usage),
      stopReason: data.stop_reason ?? 'unknown',
      provider: 'anthropic',
      // A server-side fallback may have answered with another Claude model.
      model: data.model ?? req.model,
      raw: { provider: 'anthropic', content: data.content ?? [] },
    } satisfies ChatResult;
  },

  async *stream(req): AsyncGenerator<StreamEvent> {
    const res = await postJson('anthropic', url(), headers(req.model), buildBody(req, true), req.signal);
    let text = '';
    let stopReason = 'unknown';
    let stopDetails: unknown = null;
    let model = req.model;
    let usage: ChatResult['usage'] = { inputTokens: 0, outputTokens: 0 };
    const tools = new Map<number, { id: string; name: string; json: string }>();
    for await (const data of sseData(res)) {
      const ev = JSON.parse(data) as {
        type: string;
        index?: number;
        message?: { model?: string; usage?: AnthropicUsage };
        content_block?: { type: string; id?: string; name?: string };
        delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string; stop_details?: unknown };
        usage?: { output_tokens?: number };
        error?: { message?: string };
      };
      if (ev.type === 'message_start') {
        usage = usageOf(ev.message?.usage);
        model = ev.message?.model ?? model;
      } else if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
        tools.set(ev.index ?? 0, { id: ev.content_block.id ?? '', name: ev.content_block.name ?? '', json: '' });
      } else if (ev.type === 'content_block_delta') {
        if (ev.delta?.type === 'text_delta' && ev.delta.text) {
          text += ev.delta.text;
          yield { type: 'text', delta: ev.delta.text };
        } else if (ev.delta?.type === 'input_json_delta') {
          const b = tools.get(ev.index ?? 0);
          if (b) b.json += ev.delta.partial_json ?? '';
        }
      } else if (ev.type === 'message_delta') {
        usage.outputTokens = ev.usage?.output_tokens ?? usage.outputTokens;
        if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
        if (ev.delta?.stop_details) stopDetails = ev.delta.stop_details;
      } else if (ev.type === 'error') {
        throw new ProviderError('anthropic', `stream error: ${ev.error?.message ?? 'unknown'}`, null, true);
      }
    }
    refusal(stopReason, stopDetails);
    const calls = [...tools.values()].map((b) => ({ id: b.id, name: b.name, args: parseArgs(b.json) }));
    // Streaming is used for tool-less chat only, so no raw blocks are needed for replay.
    yield { type: 'done', result: { text, toolCalls: calls, usage, stopReason, provider: 'anthropic', model } };
  },
};
