import type { ProviderId } from '@/lib/settings';

export type JsonSchema = Record<string, unknown>;

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** Provider-native assistant content, echoed back unchanged on the next turn (e.g. thinking blocks). */
export interface RawAssistant {
  provider: ProviderId;
  content: unknown[];
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[]; raw?: RawAssistant }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export interface ChatRequest {
  model: string;
  system: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  /** 'none' keeps the tool list unchanged but asks for a final answer without tool calls. */
  toolChoice?: 'auto' | 'none';
  /** Structured output: the provider must return JSON matching this schema. */
  responseSchema?: { name: string; schema: JsonSchema };
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface Usage {
  /** Uncached input tokens. */
  inputTokens: number;
  outputTokens: number;
  /** Prompt-cache writes and reads (Anthropic); billed differently from plain input. */
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
}

export interface ChatResult {
  text: string;
  toolCalls: ToolCall[];
  usage: Usage;
  stopReason: string;
  provider: ProviderId;
  model: string;
  raw?: RawAssistant;
}

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'done'; result: ChatResult };

export interface ProviderAdapter {
  readonly id: ProviderId;
  configured(): boolean;
  chat(req: ChatRequest): Promise<ChatResult>;
  stream(req: ChatRequest): AsyncGenerator<StreamEvent>;
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderId,
    message: string,
    public readonly status: number | null,
    public readonly retryable: boolean,
  ) {
    super(`[${provider}] ${message}`);
  }
}

export class NoProviderError extends Error {
  constructor() {
    super('no_provider_configured: لا يوجد مزود ذكاء اصطناعي مُعدّ. أضف مفتاح API لمزود واحد على الأقل في متغيرات البيئة.');
  }
}

export class CostLimitError extends Error {
  constructor(
    public readonly scope: 'workflow' | 'meeting' | 'daily' | 'monthly' | 'agent_daily' | 'automation',
    public readonly limitUsd: number,
    public readonly wouldSpendUsd: number,
  ) {
    super(`cost_limit_exceeded:${scope} (limit $${limitUsd.toFixed(4)}, would reach $${wouldSpendUsd.toFixed(4)})`);
  }
}
