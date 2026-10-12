// One assistant turn against the Claude API: the request, the tool loop and
// the handling of every stop reason. The client is injected so tests run
// against a fake; nothing here touches the database directly (tools do).
//
// API failures are returned, never thrown: callers decide whether that means
// a "reception will reply" notice (live chat) or a 502 (test console).

import { Anthropic } from "../deps.ts";
import { optionalEnv, requireEnv } from "../env.ts";
import { log } from "../log.ts";

export type BetaMessage = Anthropic.Beta.BetaMessage;
export type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
export type MessageCreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;

/** The slice of the SDK client this module uses. The real client satisfies it; tests pass a fake. */
export interface MessagesClientLike {
  beta: { messages: { create(params: MessageCreateParams): Promise<BetaMessage> } };
}

export const DEFAULT_MODEL = "claude-opus-5-5";
export type Effort = "low" | "medium" | "high";
const EFFORTS: readonly Effort[] = ["low", "medium", "high"];
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_TOKENS = 4096;
export const MAX_TOOL_ROUNDS = 3;

export interface AssistantConfig {
  model: string;
  effort: Effort;
}

export function assistantConfig(): AssistantConfig {
  const model = optionalEnv("ANTHROPIC_MODEL") ?? DEFAULT_MODEL;
  const raw = optionalEnv("ANTHROPIC_EFFORT");
  const effort = EFFORTS.find((value) => value === raw?.toLowerCase());
  if (raw !== undefined && effort === undefined) log.warn("ai.invalid_effort", { allowed: EFFORTS });
  return { model, effort: effort ?? "low" };
}

/** The real client. Throws ConfigError when ANTHROPIC_API_KEY is missing. */
export function createMessagesClient(): MessagesClientLike {
  return new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY"), maxRetries: 2, timeout: 45_000 });
}

export interface ToolExecution {
  result: Record<string, unknown>;
  isError: boolean;
}

/** Runs one tool call. Must not throw: failures come back as isError results the model can explain. */
export type ToolExecutor = (name: string, input: unknown) => Promise<ToolExecution>;

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export type FailureKind =
  | "auth"
  | "permission"
  | "rate_limited"
  | "bad_request"
  | "server"
  | "timeout"
  | "connection"
  | "api"
  | "max_tokens"
  | "tool_rounds"
  | "empty_reply"
  | "unexpected_stop"
  | "unknown";

interface RunBase {
  model: string;
  usage: TokenUsage;
  /** API calls that returned a response; tokens were spent whenever this is > 0. */
  apiCalls: number;
}

export type AssistantRun =
  | (RunBase & { ok: true; outcome: "answered"; reply: string })
  | (RunBase & { ok: true; outcome: "refused"; category: string | null })
  | (RunBase & { ok: false; failure: { kind: FailureKind; status: number | null } });

export interface RunAssistantInput {
  client: MessagesClientLike;
  config: AssistantConfig;
  system: Anthropic.Beta.BetaTextBlockParam[];
  tools: Anthropic.Beta.BetaTool[];
  messages: BetaMessageParam[];
  executeTool: ToolExecutor;
  maxToolRounds?: number;
}

function addUsage(total: TokenUsage, response: BetaMessage): void {
  const usage = response.usage;
  total.input_tokens += usage.input_tokens ?? 0;
  total.output_tokens += usage.output_tokens ?? 0;
  total.cache_read_input_tokens += usage.cache_read_input_tokens ?? 0;
  total.cache_creation_input_tokens += usage.cache_creation_input_tokens ?? 0;
}

/** Text of a response, read by block type: thinking and fallback blocks carry no reply text. */
export function replyText(response: BetaMessage): string {
  return response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
}

/** Maps SDK errors to a failure kind, most specific class first. Logs kind and status only. */
export function classifyError(error: unknown): { kind: FailureKind; status: number | null } {
  let kind: FailureKind;
  if (error instanceof Anthropic.AuthenticationError) kind = "auth";
  else if (error instanceof Anthropic.PermissionDeniedError) kind = "permission";
  else if (error instanceof Anthropic.RateLimitError) kind = "rate_limited";
  else if (error instanceof Anthropic.BadRequestError) kind = "bad_request";
  else if (error instanceof Anthropic.InternalServerError) kind = "server";
  else if (error instanceof Anthropic.APIConnectionTimeoutError) kind = "timeout";
  else if (error instanceof Anthropic.APIConnectionError) kind = "connection";
  else if (error instanceof Anthropic.APIError) kind = "api";
  else kind = "unknown";
  const status = error instanceof Anthropic.APIError && typeof error.status === "number" ? error.status : null;
  if (kind === "auth") log.error("ai.auth_failed", { status });
  else if (kind === "unknown") {
    // Not an SDK error, so most likely a bug here; the class name is the only useful clue and carries no data.
    log.error("ai.request_failed", { kind, status, error_name: error instanceof Error ? error.name : null });
  } else log.error("ai.request_failed", { kind, status });
  return { kind, status };
}

/** A throwing executor is a bug, but it must still end as an is_error result rather than a lost turn. */
async function safeExecute(execute: ToolExecutor, name: string, toolInput: unknown): Promise<ToolExecution> {
  try {
    return await execute(name, toolInput);
  } catch (error) {
    log.error("ai.tool_executor_threw", {
      tool: name.slice(0, 64),
      error_name: error instanceof Error ? error.name : null,
    });
    return { result: { ok: false, error: "A system error occurred and nothing was saved." }, isError: true };
  }
}

export async function runAssistant(input: RunAssistantInput): Promise<AssistantRun> {
  const maxRounds = input.maxToolRounds ?? MAX_TOOL_ROUNDS;
  const messages: BetaMessageParam[] = [...input.messages];
  const usage: TokenUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
  let model = input.config.model;
  let apiCalls = 0;
  let toolRounds = 0;
  const fail = (kind: FailureKind, status: number | null = null): AssistantRun => ({
    ok: false,
    failure: { kind, status },
    model,
    usage,
    apiCalls,
  });

  while (true) {
    let response: BetaMessage;
    try {
      response = await input.client.beta.messages.create({
        model: input.config.model,
        max_tokens: MAX_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: input.config.effort },
        system: input.system,
        tools: input.tools,
        tool_choice: { type: "auto" },
        messages: [...messages],
      });
    } catch (error) {
      const failure = classifyError(error);
      return fail(failure.kind, failure.status);
    }
    apiCalls++;
    addUsage(usage, response);
    // After a server-side fallback the response names the model that actually answered.
    if (typeof response.model === "string" && response.model !== "") model = response.model;

    switch (response.stop_reason) {
      case "refusal":
        log.warn("ai.refused", { category: response.stop_details?.category ?? null, model });
        return {
          ok: true,
          outcome: "refused",
          category: response.stop_details?.category ?? null,
          model,
          usage,
          apiCalls,
        };
      case "max_tokens":
        log.error("ai.max_tokens", { model, output_tokens: usage.output_tokens });
        return fail("max_tokens");
      case "tool_use": {
        if (toolRounds >= maxRounds) {
          log.error("ai.tool_rounds_exceeded", { rounds: toolRounds });
          return fail("tool_rounds");
        }
        toolRounds++;
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const execution = await safeExecute(input.executeTool, block.name, block.input);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(execution.result),
            ...(execution.isError ? { is_error: true } : {}),
          });
        }
        if (results.length === 0) return fail("unexpected_stop");
        // Thinking blocks must go back exactly as received within the turn.
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: results });
        continue;
      }
      case "end_turn":
      case "stop_sequence": {
        const reply = replyText(response);
        if (reply === "") {
          log.error("ai.empty_reply", { model });
          return fail("empty_reply");
        }
        return { ok: true, outcome: "answered", reply, model, usage, apiCalls };
      }
      default:
        log.error("ai.unexpected_stop", { stop_reason: response.stop_reason ?? null });
        return fail("unexpected_stop");
    }
  }
}
