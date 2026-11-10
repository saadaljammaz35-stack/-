import { AppError } from "@/lib/http/errors";
import type { ChatMessage } from "../providers/types";
import { estimateMessagesTokens, estimateTokens } from "../tokens";

// =============================================================================
// Layer D — Context manager. Fits the conversation into the model's real
// context window. Drop order when over budget:
//   1. oldest history turns
//   2. lowest-ranked knowledge sources
//   3. output budget (down to a floor)
// The system prompt and the current user message are never dropped; if they
// alone do not fit, the request fails with CONTEXT_TOO_LONG.
// =============================================================================

export interface FitInput<S> {
  system: string;
  sources: S[];
  renderContext: (sources: S[]) => string | null;
  history: ChatMessage[];
  user: string;
  contextLength: number;
  maxOutputTokens: number;
}

export interface FitResult<S> {
  messages: ChatMessage[];
  sources: S[];
  maxTokens: number;
  inputTokensEstimate: number;
  droppedHistory: number;
  droppedSources: number;
}

const MIN_OUTPUT = 128;

export function fitContext<S>(input: FitInput<S>): FitResult<S> {
  const margin = Math.max(64, Math.floor(input.contextLength * 0.03));
  let maxTokens = Math.min(input.maxOutputTokens, Math.floor(input.contextLength / 2));
  const fixed = estimateMessagesTokens([
    { role: "system", content: input.system },
    { role: "user", content: input.user },
  ]);

  let available = input.contextLength - margin - maxTokens - fixed;
  if (available < 0) {
    // Shrink the answer budget before giving up.
    maxTokens = Math.max(MIN_OUTPUT, maxTokens + available);
    available = input.contextLength - margin - maxTokens - fixed;
    if (available < 0) {
      throw new AppError("CONTEXT_TOO_LONG", "The message is too long for this model's context window", {
        details: { contextLength: input.contextLength, estimatedInputTokens: fixed },
      });
    }
  }

  // Sources get at most 60% of what is left; history fills the rest.
  let sources = input.sources;
  let ctxText = input.renderContext(sources);
  const sourceCap = Math.floor(available * 0.6);
  while (sources.length && ctxText && estimateTokens(ctxText) + 6 > sourceCap) {
    sources = sources.slice(0, -1);
    ctxText = input.renderContext(sources);
  }
  const ctxTokens = ctxText ? estimateTokens(ctxText) + 6 : 0;
  let remaining = available - ctxTokens;

  const kept: ChatMessage[] = [];
  for (let i = input.history.length - 1; i >= 0; i--) {
    const m = input.history[i]!;
    const t = estimateTokens(m.content) + 6;
    if (t > remaining) break;
    kept.unshift(m);
    remaining -= t;
  }
  // Never start the window on an orphaned assistant turn.
  while (kept[0]?.role === "assistant") kept.shift();

  const messages: ChatMessage[] = [
    { role: "system", content: input.system },
    ...(ctxText ? [{ role: "system" as const, content: ctxText }] : []),
    ...kept,
    { role: "user", content: input.user },
  ];
  return {
    messages,
    sources,
    maxTokens,
    inputTokensEstimate: estimateMessagesTokens(messages),
    droppedHistory: input.history.length - kept.length,
    droppedSources: input.sources.length - sources.length,
  };
}
