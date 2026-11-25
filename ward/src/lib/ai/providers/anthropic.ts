import { env } from '@/lib/env';
import { parseArgs, postJson, sseData } from '@/lib/ai/http';
import type { ChatMessage, ChatRequest, ChatResult, ProviderAdapter, StreamEvent, ToolCall } from '@/lib/ai/types';

/** Anthropic Messages API. Structured output is obtained by forcing a single tool call. */

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

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
      const blocks: Block[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args });
      if (blocks.length) push('assistant', blocks);
    } else push('user', [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }]);
  }
  return out;
}

function buildBody(req: ChatRequest, stream: boolean) {
  const tools = (req.tools ?? []).map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: toWire(req.messages),
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.responseSchema) {
    tools.push({ name: req.responseSchema.name, description: 'Return the final structured result.', input_schema: req.responseSchema.schema });
    body.tool_choice = { type: 'tool', name: req.responseSchema.name };
  }
  if (tools.length) body.tools = tools;
  if (stream) body.stream = true;
  return body;
}

const url = () => `${env().ANTHROPIC_BASE_URL.replace(/\/$/, '')}/v1/messages`;
const headers = () => ({ 'x-api-key': env().ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' });

function finalize(req: ChatRequest, text: string, calls: ToolCall[], usage: ChatResult['usage'], stopReason: string): ChatResult {
  if (req.responseSchema) {
    const structured = calls.find((c) => c.name === req.responseSchema!.name);
    if (structured) return { text: JSON.stringify(structured.args), toolCalls: [], usage, stopReason, provider: 'anthropic', model: req.model };
  }
  return { text, toolCalls: calls, usage, stopReason, provider: 'anthropic', model: req.model };
}

export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  configured: () => Boolean(env().ANTHROPIC_API_KEY),

  async chat(req) {
    const res = await postJson('anthropic', url(), headers(), buildBody(req, false), req.signal);
    const data = (await res.json()) as {
      content?: Block[];
      usage?: { input_tokens?: number; output_tokens?: number };
      stop_reason?: string;
    };
    let text = '';
    const calls: ToolCall[] = [];
    for (const b of data.content ?? []) {
      if (b.type === 'text') text += b.text;
      else if (b.type === 'tool_use') calls.push({ id: b.id, name: b.name, args: b.input ?? {} });
    }
    const usage = { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
    return finalize(req, text, calls, usage, data.stop_reason ?? 'unknown');
  },

  async *stream(req): AsyncGenerator<StreamEvent> {
    const res = await postJson('anthropic', url(), headers(), buildBody(req, true), req.signal);
    let text = '';
    let stopReason = 'unknown';
    const usage = { inputTokens: 0, outputTokens: 0 };
    const blocks = new Map<number, { id: string; name: string; json: string }>();
    for await (const data of sseData(res)) {
      const ev = JSON.parse(data) as {
        type: string;
        index?: number;
        message?: { usage?: { input_tokens?: number } };
        content_block?: { type: string; id?: string; name?: string };
        delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string };
        usage?: { output_tokens?: number };
        error?: { message?: string };
      };
      if (ev.type === 'message_start') usage.inputTokens = ev.message?.usage?.input_tokens ?? 0;
      else if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
        blocks.set(ev.index ?? 0, { id: ev.content_block.id ?? '', name: ev.content_block.name ?? '', json: '' });
      } else if (ev.type === 'content_block_delta') {
        if (ev.delta?.type === 'text_delta' && ev.delta.text) {
          text += ev.delta.text;
          if (!req.responseSchema) yield { type: 'text', delta: ev.delta.text };
        } else if (ev.delta?.type === 'input_json_delta') {
          const b = blocks.get(ev.index ?? 0);
          if (b) b.json += ev.delta.partial_json ?? '';
        }
      } else if (ev.type === 'message_delta') {
        usage.outputTokens = ev.usage?.output_tokens ?? usage.outputTokens;
        if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
      } else if (ev.type === 'error') {
        throw new Error(`[anthropic] stream error: ${ev.error?.message ?? 'unknown'}`);
      }
    }
    const calls = [...blocks.values()].map((b) => ({ id: b.id, name: b.name, args: parseArgs(b.json) }));
    yield { type: 'done', result: finalize(req, text, calls, usage, stopReason) };
  },
};
