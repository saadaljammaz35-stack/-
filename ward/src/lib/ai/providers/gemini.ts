import { env } from '@/lib/env';
import { callId, postJson, sseData } from '@/lib/ai/http';
import type { ChatMessage, ChatRequest, ChatResult, JsonSchema, ProviderAdapter, StreamEvent, ToolCall } from '@/lib/ai/types';

/** Google Gemini `generateContent` (v1beta). */

/** Gemini accepts an OpenAPI subset for function parameters: drop keywords it rejects. */
export function sanitizeSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sanitizeSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === 'additionalProperties' || k === '$schema' || k === 'default') continue;
    out[k] = k === 'properties' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, sanitizeSchema(pv)])) : sanitizeSchema(v);
  }
  return out;
}

type Part = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: { name: string; response: Record<string, unknown> } };

function toWire(messages: ChatMessage[]) {
  const out: { role: 'user' | 'model'; parts: Part[] }[] = [];
  const push = (role: 'user' | 'model', parts: Part[]) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else out.push({ role, parts });
  };
  for (const m of messages) {
    if (m.role === 'user') push('user', [{ text: m.content }]);
    else if (m.role === 'assistant') {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const c of m.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: c.args } });
      if (parts.length) push('model', parts);
    } else push('user', [{ functionResponse: { name: m.name, response: { content: m.content } } }]);
  }
  return out;
}

function buildBody(req: ChatRequest) {
  const generationConfig: Record<string, unknown> = { maxOutputTokens: req.maxTokens };
  if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
  if (req.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseJsonSchema = sanitizeSchema(req.responseSchema.schema) as JsonSchema;
  }
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: toWire(req.messages),
    generationConfig,
  };
  if (req.tools?.length) {
    body.tools = [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: sanitizeSchema(t.parameters) })) }];
  }
  return body;
}

type GenResponse = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

const base = () => env().GEMINI_BASE_URL.replace(/\/$/, '');
const headers = () => ({ 'x-goog-api-key': env().GEMINI_API_KEY ?? '' });

function readParts(parts: Part[] | undefined, calls: ToolCall[]): string {
  let text = '';
  for (const p of parts ?? []) {
    if (p.text) text += p.text;
    if (p.functionCall) calls.push({ id: callId('gemini'), name: p.functionCall.name, args: p.functionCall.args ?? {} });
  }
  return text;
}

export const geminiAdapter: ProviderAdapter = {
  id: 'gemini',
  configured: () => Boolean(env().GEMINI_API_KEY),

  async chat(req): Promise<ChatResult> {
    const model = encodeURIComponent(req.model);
    const res = await postJson('gemini', `${base()}/models/${model}:generateContent`, headers(), buildBody(req), req.signal);
    const data = (await res.json()) as GenResponse;
    const calls: ToolCall[] = [];
    const cand = data.candidates?.[0];
    const text = readParts(cand?.content?.parts, calls);
    return {
      text,
      toolCalls: calls,
      usage: { inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0 },
      stopReason: cand?.finishReason ?? 'unknown',
      provider: 'gemini',
      model: req.model,
    };
  },

  async *stream(req): AsyncGenerator<StreamEvent> {
    const model = encodeURIComponent(req.model);
    const res = await postJson('gemini', `${base()}/models/${model}:streamGenerateContent?alt=sse`, headers(), buildBody(req), req.signal);
    let text = '';
    let stopReason = 'unknown';
    const usage = { inputTokens: 0, outputTokens: 0 };
    const calls: ToolCall[] = [];
    for await (const data of sseData(res)) {
      const chunk = JSON.parse(data) as GenResponse;
      const cand = chunk.candidates?.[0];
      const delta = readParts(cand?.content?.parts, calls);
      if (delta) {
        text += delta;
        yield { type: 'text', delta };
      }
      if (cand?.finishReason) stopReason = cand.finishReason;
      if (chunk.usageMetadata) {
        usage.inputTokens = chunk.usageMetadata.promptTokenCount ?? usage.inputTokens;
        usage.outputTokens = chunk.usageMetadata.candidatesTokenCount ?? usage.outputTokens;
      }
    }
    yield { type: 'done', result: { text, toolCalls: calls, usage, stopReason, provider: 'gemini', model: req.model } };
  },
};
