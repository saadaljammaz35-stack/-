import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { candidates, complete, completeJson, configuredProviders, streamComplete } from '@/lib/ai/gateway';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { NoProviderError } from '@/lib/ai/types';
import { anthropicAdapter } from '@/lib/ai/providers/anthropic';
import { openaiAdapter, deepseekAdapter } from '@/lib/ai/providers/openai';
import { geminiAdapter } from '@/lib/ai/providers/gemini';
import { ollamaAdapter } from '@/lib/ai/providers/ollama';

const KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'OLLAMA_BASE_URL'];

type Captured = { url: string; init: RequestInit; body: Record<string, unknown> };

function mockFetch(responder: (c: Captured) => Response): Captured[] {
  const seen: Captured[] = [];
  vi.stubGlobal('fetch', async (url: string | URL, init: RequestInit) => {
    const c = { url: String(url), init, body: JSON.parse(String(init.body ?? '{}')) as Record<string, unknown> };
    seen.push(c);
    return responder(c);
  });
  return seen;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const sse = (events: unknown[]) =>
  new Response(events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });

const tool = { name: 'search_knowledge', description: 'search', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false } };

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  process.env.WARD_RETRY_BASE_MS = '1';
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of KEYS) delete process.env[k];
});

describe('provider adapters (wire format)', () => {
  it('Anthropic: messages, tools, tool results and usage', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const seen = mockFetch(() =>
      json({ content: [{ type: 'text', text: 'سأبحث' }, { type: 'tool_use', id: 'tu_1', name: 'search_knowledge', input: { query: 'وارد' } }], usage: { input_tokens: 120, output_tokens: 30 }, stop_reason: 'tool_use' }),
    );
    const r = await anthropicAdapter.chat({
      model: 'claude-sonnet-5-5', system: 'sys', maxTokens: 500, tools: [tool],
      messages: [
        { role: 'user', content: 'ابحث' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'tu_0', name: 'search_knowledge', args: { query: 'a' } }] },
        { role: 'tool', toolCallId: 'tu_0', name: 'search_knowledge', content: '{"results":[]}' },
      ],
    });
    expect(seen[0]!.url).toBe('https://api.anthropic.com/v1/messages');
    const h = seen[0]!.init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('sk-ant-test');
    expect(h['anthropic-version']).toBe('2023-06-01');
    expect(seen[0]!.body).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 500, system: 'sys', tools: [{ name: 'search_knowledge', input_schema: tool.parameters }] });
    const msgs = seen[0]!.body.messages as { role: string; content: { type: string }[] }[];
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(msgs[2]!.content[0]!.type).toBe('tool_result');
    expect(r).toMatchObject({ text: 'سأبحث', toolCalls: [{ id: 'tu_1', name: 'search_knowledge', args: { query: 'وارد' } }], usage: { inputTokens: 120, outputTokens: 30 } });
  });

  it('Anthropic: structured output is a forced tool call', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    const seen = mockFetch(() => json({ content: [{ type: 'tool_use', id: 'x', name: 'plan', input: { ok: true } }], usage: { input_tokens: 1, output_tokens: 1 } }));
    const r = await anthropicAdapter.chat({ model: 'm', system: 's', maxTokens: 10, messages: [{ role: 'user', content: 'u' }], responseSchema: { name: 'plan', schema: { type: 'object' } } });
    expect(seen[0]!.body.tool_choice).toEqual({ type: 'tool', name: 'plan' });
    expect(JSON.parse(r.text)).toEqual({ ok: true });
    expect(r.toolCalls).toEqual([]);
  });

  it('Anthropic: streaming text deltas and usage', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    mockFetch(() =>
      sse([
        { type: 'message_start', message: { usage: { input_tokens: 11 } } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'كل شيء ' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'وارد.' } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 4 } },
      ]),
    );
    const parts: string[] = [];
    let done: unknown;
    for await (const ev of anthropicAdapter.stream({ model: 'm', system: 's', maxTokens: 10, messages: [{ role: 'user', content: 'u' }] })) {
      if (ev.type === 'text') parts.push(ev.delta);
      else done = ev.result;
    }
    expect(parts.join('')).toBe('كل شيء وارد.');
    expect(done).toMatchObject({ text: 'كل شيء وارد.', usage: { inputTokens: 11, outputTokens: 4 }, stopReason: 'end_turn' });
  });

  it('OpenAI: chat completions with tools, json_schema and usage; no temperature for gpt-5', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const seen = mockFetch(() =>
      json({ choices: [{ message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'search_knowledge', arguments: '{"query":"x"}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 50, completion_tokens: 9 } }),
    );
    const r = await openaiAdapter.chat({ model: 'gpt-5', system: 's', maxTokens: 300, temperature: 0.7, tools: [tool], messages: [{ role: 'user', content: 'u' }], responseSchema: { name: 'out', schema: { type: 'object' } } });
    expect(seen[0]!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect((seen[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    expect(seen[0]!.body).toMatchObject({ model: 'gpt-5', max_completion_tokens: 300, response_format: { type: 'json_schema', json_schema: { name: 'out' } } });
    expect(seen[0]!.body.temperature).toBeUndefined();
    expect((seen[0]!.body.messages as { role: string }[])[0]!.role).toBe('system');
    expect(r).toMatchObject({ toolCalls: [{ id: 'c1', name: 'search_knowledge', args: { query: 'x' } }], usage: { inputTokens: 50, outputTokens: 9 } });
  });

  it('OpenAI: streaming assembles tool-call fragments and final usage', async () => {
    process.env.OPENAI_API_KEY = 'k';
    mockFetch(() =>
      sse([
        { choices: [{ delta: { content: 'أهلًا' } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c9', function: { name: 'search_', arguments: '{"que' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'knowledge', arguments: 'ry":"y"}' } }] }, finish_reason: 'tool_calls' }] },
        { choices: [], usage: { prompt_tokens: 7, completion_tokens: 3 } },
        '[DONE]',
      ]),
    );
    let result: { toolCalls: unknown[]; usage: unknown; text: string } | undefined;
    for await (const ev of openaiAdapter.stream({ model: 'gpt-5-mini', system: 's', maxTokens: 10, messages: [{ role: 'user', content: 'u' }] })) if (ev.type === 'done') result = ev.result;
    expect(result).toMatchObject({ text: 'أهلًا', toolCalls: [{ id: 'c9', name: 'search_knowledge', args: { query: 'y' } }], usage: { inputTokens: 7, outputTokens: 3 } });
  });

  it('DeepSeek: OpenAI-compatible endpoint, JSON mode with the schema in the prompt', async () => {
    process.env.DEEPSEEK_API_KEY = 'ds';
    const seen = mockFetch(() => json({ choices: [{ message: { content: '{"a":1}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    await deepseekAdapter.chat({ model: 'deepseek-chat', system: 'sys', maxTokens: 50, messages: [{ role: 'user', content: 'u' }], responseSchema: { name: 'n', schema: { type: 'object' } } });
    expect(seen[0]!.url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(seen[0]!.body).toMatchObject({ max_tokens: 50, response_format: { type: 'json_object' } });
    expect(((seen[0]!.body.messages as { content: string }[])[0]!.content)).toContain('JSON Schema');
  });

  it('Gemini: generateContent with function declarations (sanitized schema) and usage', async () => {
    process.env.GEMINI_API_KEY = 'g';
    const seen = mockFetch(() =>
      json({ candidates: [{ content: { parts: [{ functionCall: { name: 'search_knowledge', args: { query: 'z' } } }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 5 } }),
    );
    const r = await geminiAdapter.chat({ model: 'gemini-2.5-flash', system: 'sys', maxTokens: 100, tools: [tool], messages: [{ role: 'user', content: 'u' }] });
    expect(seen[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect((seen[0]!.init.headers as Record<string, string>)['x-goog-api-key']).toBe('g');
    const decl = (seen[0]!.body.tools as { functionDeclarations: { parameters: Record<string, unknown> }[] }[])[0]!.functionDeclarations[0]!;
    expect(decl.parameters.additionalProperties).toBeUndefined();
    expect(seen[0]!.body.systemInstruction).toEqual({ parts: [{ text: 'sys' }] });
    expect(r).toMatchObject({ toolCalls: [{ name: 'search_knowledge', args: { query: 'z' } }], usage: { inputTokens: 40, outputTokens: 5 } });
  });

  it('Ollama: local /api/chat with tool calls and eval counts', async () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    const seen = mockFetch(() => json({ message: { content: '', tool_calls: [{ function: { name: 'search_knowledge', arguments: { query: 'q' } } }] }, done: true, done_reason: 'stop', prompt_eval_count: 9, eval_count: 2 }));
    const r = await ollamaAdapter.chat({ model: 'llama3.1', system: 's', maxTokens: 64, tools: [tool], messages: [{ role: 'user', content: 'u' }] });
    expect(seen[0]!.url).toBe('http://localhost:11434/api/chat');
    expect(seen[0]!.body).toMatchObject({ model: 'llama3.1', stream: false, options: { num_predict: 64 } });
    expect(r).toMatchObject({ toolCalls: [{ name: 'search_knowledge', args: { query: 'q' } }], usage: { inputTokens: 9, outputTokens: 2 } });
  });
});

describe('gateway behaviour', () => {
  it('with no keys configured, nothing is called and the error is explicit', async () => {
    const seen = mockFetch(() => json({}));
    expect(configuredProviders()).toEqual([]);
    await expect(complete({ settings: DEFAULT_SETTINGS, tier: 'standard', request: { system: 's', messages: [{ role: 'user', content: 'u' }], maxTokens: 10 } })).rejects.toBeInstanceOf(NoProviderError);
    expect(seen).toHaveLength(0);
  });

  it('uses the agent’s preferred provider/model, the economy model for simple work, then the fallback order', () => {
    process.env.OPENAI_API_KEY = 'k';
    process.env.GEMINI_API_KEY = 'k';
    expect(candidates(DEFAULT_SETTINGS, 'standard', { provider: 'gemini', model: 'gemini-custom' })).toEqual([
      { provider: 'gemini', model: 'gemini-custom' },
      { provider: 'openai', model: 'gpt-5' },
    ]);
    expect(candidates(DEFAULT_SETTINGS, 'economy')).toEqual([
      { provider: 'openai', model: 'gpt-5-mini' },
      { provider: 'gemini', model: 'gemini-2.5-flash' },
    ]);
  });

  it('retries a 5xx, then falls back to the next provider and records every attempt', async () => {
    process.env.ANTHROPIC_API_KEY = 'a';
    process.env.OPENAI_API_KEY = 'o';
    const seen = mockFetch((c) =>
      c.url.includes('anthropic') ? json({ error: 'overloaded' }, 529) : json({ choices: [{ message: { content: 'from openai' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10 } }),
    );
    const attempts: { provider: string; ok: boolean }[] = [];
    const r = await complete({
      settings: DEFAULT_SETTINGS, tier: 'standard',
      request: { system: 's', messages: [{ role: 'user', content: 'u' }], maxTokens: 10 },
      record: (a) => void attempts.push({ provider: a.provider, ok: a.ok }),
    });
    expect(r.text).toBe('from openai');
    expect(r.provider).toBe('openai');
    expect(seen.filter((c) => c.url.includes('anthropic'))).toHaveLength(3);
    expect(attempts).toEqual([
      { provider: 'anthropic', ok: false }, { provider: 'anthropic', ok: false }, { provider: 'anthropic', ok: false }, { provider: 'openai', ok: true },
    ]);
    // Unknown (unverified) price → conservative estimate is used for cost.
    expect(r.priceVerified).toBe(false);
    expect(r.costUsd).toBeCloseTo((10 * 15 + 10 * 75) / 1e6, 10);
  });

  it('does not retry an auth error on the same provider; the guard can stop a call before it is made', async () => {
    process.env.ANTHROPIC_API_KEY = 'bad';
    const seen = mockFetch(() => json({ error: 'invalid x-api-key' }, 401));
    await expect(complete({ settings: DEFAULT_SETTINGS, tier: 'standard', request: { system: 's', messages: [{ role: 'user', content: 'u' }], maxTokens: 10 } })).rejects.toThrow(/HTTP 401/);
    expect(seen).toHaveLength(1);
    await expect(
      complete({ settings: DEFAULT_SETTINGS, tier: 'standard', request: { system: 's', messages: [{ role: 'user', content: 'u' }], maxTokens: 10 }, guard: () => { throw new Error('blocked by guard'); } }),
    ).rejects.toThrow('blocked by guard');
    expect(seen).toHaveLength(1);
  });

  it('validates structured output and repairs once', async () => {
    process.env.OPENAI_API_KEY = 'o';
    let n = 0;
    mockFetch(() => {
      n++;
      const content = n === 1 ? 'هذه خطتي: {"items": "not-an-array"}' : '```json\n{"items": ["a", "b"]}\n```';
      return json({ choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 5 } });
    });
    const { data, result } = await completeJson({
      settings: DEFAULT_SETTINGS, tier: 'standard', name: 'list', schema: z.object({ items: z.array(z.string()) }),
      request: { system: 's', messages: [{ role: 'user', content: 'u' }], maxTokens: 50 },
    });
    expect(data.items).toEqual(['a', 'b']);
    expect(result.usage.outputTokens).toBe(10);
  });

  it('streams through the gateway and reports cost at the end', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    mockFetch(() => sse([{ type: 'message_start', message: { usage: { input_tokens: 100 } } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'مرحبا' } }, { type: 'message_delta', usage: { output_tokens: 20 } }]));
    const out: string[] = [];
    let cost = -1;
    for await (const ev of streamComplete({ settings: DEFAULT_SETTINGS, tier: 'standard', request: { system: 's', messages: [{ role: 'user', content: 'u' }], maxTokens: 50 } })) {
      if (ev.type === 'text') out.push(ev.delta);
      else cost = ev.result.costUsd;
    }
    expect(out.join('')).toBe('مرحبا');
    expect(cost).toBeCloseTo((100 * 15 + 20 * 75) / 1e6, 10);
  });
});
