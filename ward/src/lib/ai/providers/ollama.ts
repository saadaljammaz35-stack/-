import { env } from '@/lib/env';
import { callId, lines, parseArgs, postJson } from '@/lib/ai/http';
import type { ChatMessage, ChatRequest, ChatResult, ProviderAdapter, StreamEvent, ToolCall } from '@/lib/ai/types';

/** Local models through Ollama's `/api/chat`. Only enabled when OLLAMA_BASE_URL is set. */

function toWire(system: string, messages: ChatMessage[]) {
  const out: Record<string, unknown>[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.content,
        ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.args } })) } : {}),
      });
    } else out.push({ role: 'tool', content: m.content, tool_name: m.name });
  }
  return out;
}

function buildBody(req: ChatRequest, stream: boolean) {
  const options: Record<string, unknown> = { num_predict: req.maxTokens };
  if (req.temperature !== undefined) options.temperature = req.temperature;
  const body: Record<string, unknown> = { model: req.model, messages: toWire(req.system, req.messages), stream, options };
  // Ollama has no tool_choice: "answer without tools" means not offering them.
  if (req.tools?.length && req.toolChoice !== 'none') body.tools = req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  if (req.responseSchema) body.format = req.responseSchema.schema;
  return body;
}

type Chunk = {
  message?: { content?: string; tool_calls?: { function: { name: string; arguments: unknown } }[] };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

const url = () => `${(env().OLLAMA_BASE_URL ?? '').replace(/\/$/, '')}/api/chat`;

function calls(chunk: Chunk): ToolCall[] {
  return (chunk.message?.tool_calls ?? []).map((c) => ({ id: callId('ollama'), name: c.function.name, args: parseArgs(c.function.arguments) }));
}

export const ollamaAdapter: ProviderAdapter = {
  id: 'ollama',
  configured: () => Boolean(env().OLLAMA_BASE_URL),

  async chat(req): Promise<ChatResult> {
    const res = await postJson('ollama', url(), {}, buildBody(req, false), req.signal);
    const data = (await res.json()) as Chunk;
    return {
      text: data.message?.content ?? '',
      toolCalls: calls(data),
      usage: { inputTokens: data.prompt_eval_count ?? 0, outputTokens: data.eval_count ?? 0 },
      stopReason: data.done_reason ?? 'unknown',
      provider: 'ollama',
      model: req.model,
    };
  },

  async *stream(req): AsyncGenerator<StreamEvent> {
    const res = await postJson('ollama', url(), {}, buildBody(req, true), req.signal);
    let text = '';
    const toolCalls: ToolCall[] = [];
    const usage = { inputTokens: 0, outputTokens: 0 };
    let stopReason = 'unknown';
    for await (const line of lines(res)) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line) as Chunk;
      if (chunk.message?.content) {
        text += chunk.message.content;
        yield { type: 'text', delta: chunk.message.content };
      }
      toolCalls.push(...calls(chunk));
      if (chunk.done) {
        usage.inputTokens = chunk.prompt_eval_count ?? 0;
        usage.outputTokens = chunk.eval_count ?? 0;
        stopReason = chunk.done_reason ?? 'stop';
      }
    }
    yield { type: 'done', result: { text, toolCalls, usage, stopReason, provider: 'ollama', model: req.model } };
  },
};
