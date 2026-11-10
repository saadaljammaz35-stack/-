// =============================================================================
// Layer B — Model provider contract. The engine depends on this interface
// only; every backend (Ollama, vLLM, OpenAI-compatible, Hugging Face,
// in-process ONNX) is an adapter behind it.
// =============================================================================

export type ProviderType = "ollama" | "vllm" | "openai_compatible" | "huggingface" | "local_onnx";

export interface ToolCall {
  id: string;
  name: string;
  /** Raw JSON text as produced by the model. Validated by the tool layer, never trusted. */
  arguments: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GenerateRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stop?: string[];
  tools?: ToolSpec[];
  /** LoRA adapter name already loaded on the server (vLLM). */
  adapter?: string | null;
  signal?: AbortSignal;
  /** Time allowed to receive the first token. */
  firstTokenTimeoutMs?: number;
  /** Time allowed for the whole generation. */
  totalTimeoutMs?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  /** 'provider' when the backend reported counts, 'estimate' otherwise. */
  source: "provider" | "estimate";
}

export type FinishReason = "stop" | "length" | "tool_calls" | "cancelled";

export interface GenerateResult {
  text: string;
  toolCalls: ToolCall[];
  finishReason: FinishReason;
  usage: Usage;
  model: string;
  latencyMs: number;
  firstTokenMs: number | null;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool_call"; call: ToolCall }
  | { type: "done"; result: GenerateResult };

export interface ProviderCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  vision: boolean;
  embeddings: boolean;
  loadUnload: boolean;
  loraAdapters: boolean;
}

export interface ModelInfo {
  id: string;
  contextLength: number | null;
  parameterCount?: number | null;
  quantization?: string | null;
  family?: string | null;
  loaded?: boolean;
  capabilities?: string[];
}

export interface ProviderHealth {
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  version?: string;
  error?: string;
}

export interface ModelProvider {
  readonly type: ProviderType;
  readonly name: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  stream(req: GenerateRequest): AsyncIterable<StreamEvent>;
  healthCheck(signal?: AbortSignal): Promise<ProviderHealth>;
  getCapabilities(model?: string): Promise<ProviderCapabilities>;
  getModelInfo(model: string): Promise<ModelInfo>;
  listModels(): Promise<ModelInfo[]>;
  loadModel(model: string, opts?: { adapterName?: string; adapterPath?: string }): Promise<void>;
  unloadModel(model: string, opts?: { adapterName?: string }): Promise<void>;
}

export type ProviderErrorCode =
  | "unavailable"
  | "timeout"
  | "cancelled"
  | "bad_request"
  | "auth"
  | "rate_limited"
  | "not_found"
  | "context_length"
  | "unsupported"
  | "protocol"
  | "server";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  constructor(code: ProviderErrorCode, message: string, opts: { status?: number; retryable?: boolean; cause?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = "ProviderError";
    this.code = code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? ["unavailable", "rate_limited", "server", "timeout"].includes(code);
  }
}
