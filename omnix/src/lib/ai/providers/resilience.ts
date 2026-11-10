import { ProviderError, type GenerateRequest, type GenerateResult, type StreamEvent, type ToolCall } from "./types";

export interface RetryPolicy {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { retries: 2, baseDelayMs: 300, maxDelayMs: 3000 };

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ProviderError("cancelled", "Request cancelled"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new ProviderError("cancelled", "Request cancelled"));
      },
      { once: true },
    );
  });
}

/** Full-jitter exponential backoff. Only retryable ProviderErrors are retried. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, policy: RetryPolicy = DEFAULT_RETRY, signal?: AbortSignal): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      const pe = err instanceof ProviderError ? err : null;
      if (!pe?.retryable || attempt >= policy.retries || signal?.aborted) throw err;
      const cap = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
      await sleep(Math.random() * cap, signal);
      attempt++;
    }
  }
}

/**
 * Fetch for provider HTTP calls: combines the caller's cancellation signal
 * with a connect/first-byte timeout and maps failures to ProviderError.
 */
export async function providerFetch(
  url: string,
  init: RequestInit & { timeoutMs: number; signal?: AbortSignal },
): Promise<Response> {
  const timeout = AbortSignal.timeout(init.timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal });
  } catch (err) {
    if (init.signal?.aborted) throw new ProviderError("cancelled", "Request cancelled", { cause: err });
    if (timeout.aborted) throw new ProviderError("timeout", `Provider did not respond within ${init.timeoutMs} ms`, { cause: err });
    throw new ProviderError("unavailable", `Provider unreachable: ${(err as Error).message}`, { cause: err });
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 500);
    throw httpError(res.status, text);
  }
  return res;
}

export function httpError(status: number, body: string): ProviderError {
  const msg = `Provider HTTP ${status}${body ? `: ${body}` : ""}`;
  if (status === 401 || status === 403) return new ProviderError("auth", msg, { status });
  if (status === 404) return new ProviderError("not_found", msg, { status });
  if (status === 429) return new ProviderError("rate_limited", msg, { status });
  if (status === 400 && /context|too long|maximum.*length|max_model_len|token/i.test(body)) {
    return new ProviderError("context_length", msg, { status, retryable: false });
  }
  if (status >= 400 && status < 500) return new ProviderError("bad_request", msg, { status });
  return new ProviderError("server", msg, { status });
}

/**
 * Applies a total-time budget and a first-token deadline to a provider
 * stream, and makes sure cancellation propagates.
 */
export async function* guardStream(
  source: (signal: AbortSignal) => AsyncIterable<StreamEvent>,
  req: Pick<GenerateRequest, "signal" | "firstTokenTimeoutMs" | "totalTimeoutMs">,
): AsyncGenerator<StreamEvent> {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort(new ProviderError("cancelled", "Request cancelled"));
  req.signal?.addEventListener("abort", onAbort, { once: true });
  if (req.signal?.aborted) onAbort();
  let firstTimer: ReturnType<typeof setTimeout> | undefined;
  let totalTimer: ReturnType<typeof setTimeout> | undefined;
  if (req.firstTokenTimeoutMs) {
    firstTimer = setTimeout(
      () => ctl.abort(new ProviderError("timeout", `No output within ${req.firstTokenTimeoutMs} ms`)),
      req.firstTokenTimeoutMs,
    );
  }
  if (req.totalTimeoutMs) {
    totalTimer = setTimeout(
      () => ctl.abort(new ProviderError("timeout", `Generation exceeded ${req.totalTimeoutMs} ms`)),
      req.totalTimeoutMs,
    );
  }
  try {
    for await (const ev of source(ctl.signal)) {
      if (firstTimer) {
        clearTimeout(firstTimer);
        firstTimer = undefined;
      }
      if (ctl.signal.aborted) break;
      yield ev;
    }
    if (ctl.signal.aborted) throw ctl.signal.reason ?? new ProviderError("cancelled", "Request cancelled");
  } catch (err) {
    if (ctl.signal.aborted && ctl.signal.reason instanceof ProviderError) throw ctl.signal.reason;
    throw err;
  } finally {
    clearTimeout(firstTimer);
    clearTimeout(totalTimer);
    req.signal?.removeEventListener("abort", onAbort);
  }
}

/** Default generate(): drain stream() and return the final result. */
export async function collect(stream: AsyncIterable<StreamEvent>): Promise<GenerateResult> {
  let last: GenerateResult | null = null;
  for await (const ev of stream) if (ev.type === "done") last = ev.result;
  if (!last) throw new ProviderError("protocol", "Stream ended without a final result");
  return last;
}

/** Splits a byte stream into SSE `data:` payloads. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let idx: number;
      while ((idx = buf.search(/\r?\n\r?\n/)) >= 0) {
        const event = buf.slice(0, idx);
        buf = buf.slice(idx).replace(/^\r?\n\r?\n/, "");
        const data = event
          .split(/\r?\n/)
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data) yield data;
      }
    }
    const tail = buf
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("\n");
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

/** Splits a byte stream into newline-delimited JSON lines. */
export async function* ndjsonLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) yield line;
      }
    }
    if (buf.trim()) yield buf.trim();
  } finally {
    reader.releaseLock();
  }
}

export function parseJsonOrThrow(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch (err) {
    throw new ProviderError("protocol", "Provider sent malformed JSON", { cause: err });
  }
}

export function toolCallId(): string {
  return `call_${Math.random().toString(36).slice(2, 12)}`;
}

export function finalizeToolCalls(calls: Map<number, ToolCall>): ToolCall[] {
  return [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
}
