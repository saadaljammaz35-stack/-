import { env } from '@/lib/env';
import type { ProviderId } from '@/lib/settings';
import { callId, parseArgs, postJson, sseData } from '@/lib/ai/http';
import type { ChatMessage, ChatRequest, ChatResult, ProviderAdapter, StreamEvent, ToolCall } from '@/lib/ai/types';

/**
 * OpenAI Chat Completions. DeepSeek exposes the same wire format, so one adapter
 * serves both; the differences (JSON mode, token parameter) are flags.
 */
interface Flavor {
  id: Extract<ProviderId, 'openai' | 'deepseek'>;
  key: () => string | undefined;
  baseUrl: () => string;
  jsonSchemaSupported: boolean;
  tokenParam: 'max_completion_tokens' | 'max_tokens';
}

function toWire(system: string, messages: ChatMessage[]) {
  const out: Record<string, unknown>[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.content || null,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.name, arguments: JSON.stringify(c.args) },
              })),
            }
          : {}),
      });
    } else out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
  }
  return out;
}

// Reasoning-family models reject a custom temperature.
const fixedTemperature = (model: string) => /^(o\d|gpt-5)/.test(model);

function buildBody(f: Flavor, req: ChatRequest, stream: boolean) {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: toWire(
      req.responseSchema && !f.jsonSchemaSupported
        ? `${req.system}\n\nReturn ONLY a JSON object that matches this JSON Schema:\n${JSON.stringify(req.responseSchema.schema)}`
        : req.system,
      req.messages,
    ),
    [f.tokenParam]: req.maxTokens,
  };
  if (req.temperature !== undefined && !fixedTemperature(req.model)) body.temperature = req.temperature;
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  }
  if (req.responseSchema) {
    body.response_format = f.jsonSchemaSupported
      ? { type: 'json_schema', json_schema: { name: req.responseSchema.name, schema: req.responseSchema.schema, strict: false } }
      : { type: 'json_object' };
  }
  if (stream) {
    body.stream = true;
    body.stream_options = { include_usage: true };
  }
  return body;
}

function makeAdapter(f: Flavor): ProviderAdapter {
  const headers = () => ({ authorization: `Bearer ${f.key() ?? ''}` });
  const url = () => `${f.baseUrl().replace(/\/$/, '')}/chat/completions`;

  return {
    id: f.id,
    configured: () => Boolean(f.key()),

    async chat(req): Promise<ChatResult> {
      const res = await postJson(f.id, url(), headers(), buildBody(f, req, false), req.signal);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = data.choices?.[0];
      return {
        text: choice?.message?.content ?? '',
        toolCalls: (choice?.message?.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, args: parseArgs(c.function.arguments) })),
        usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
        stopReason: choice?.finish_reason ?? 'unknown',
        provider: f.id,
        model: req.model,
      };
    },

    async *stream(req): AsyncGenerator<StreamEvent> {
      const res = await postJson(f.id, url(), headers(), buildBody(f, req, true), req.signal);
      let text = '';
      let stopReason = 'unknown';
      const usage = { inputTokens: 0, outputTokens: 0 };
      const partial = new Map<number, { id: string; name: string; args: string }>();
      for await (const data of sseData(res)) {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: string; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
        };
        const choice = chunk.choices?.[0];
        if (choice?.delta?.content) {
          text += choice.delta.content;
          yield { type: 'text', delta: choice.delta.content };
        }
        for (const tc of choice?.delta?.tool_calls ?? []) {
          const cur = partial.get(tc.index) ?? { id: tc.id ?? callId('call'), name: '', args: '' };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          partial.set(tc.index, cur);
        }
        if (choice?.finish_reason) stopReason = choice.finish_reason;
        if (chunk.usage) {
          usage.inputTokens = chunk.usage.prompt_tokens ?? usage.inputTokens;
          usage.outputTokens = chunk.usage.completion_tokens ?? usage.outputTokens;
        }
      }
      const toolCalls: ToolCall[] = [...partial.values()].map((p) => ({ id: p.id, name: p.name, args: parseArgs(p.args) }));
      yield { type: 'done', result: { text, toolCalls, usage, stopReason, provider: f.id, model: req.model } };
    },
  };
}

export const openaiAdapter = makeAdapter({
  id: 'openai',
  key: () => env().OPENAI_API_KEY,
  baseUrl: () => env().OPENAI_BASE_URL,
  jsonSchemaSupported: true,
  tokenParam: 'max_completion_tokens',
});

export const deepseekAdapter = makeAdapter({
  id: 'deepseek',
  key: () => env().DEEPSEEK_API_KEY,
  baseUrl: () => env().DEEPSEEK_BASE_URL,
  jsonSchemaSupported: false,
  tokenParam: 'max_tokens',
});
