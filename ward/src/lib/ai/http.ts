import type { ProviderId } from '@/lib/settings';
import { ProviderError } from '@/lib/ai/types';

const REQUEST_TIMEOUT_MS = 120_000;

function combine(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function postJson(
  provider: ProviderId,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: combine(signal),
    });
  } catch (err) {
    const aborted = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
    throw new ProviderError(provider, aborted ? 'request timed out or was aborted' : `network error: ${String(err)}`, null, !signal?.aborted);
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      /* ignore */
    }
    // Never echo request headers (they carry the key); the body excerpt is the provider's own error text.
    const retryable = res.status === 408 || res.status === 409 || res.status === 429 || res.status >= 500;
    throw new ProviderError(provider, `HTTP ${res.status}: ${detail}`, res.status, retryable);
  }
  return res;
}

/** Parse a `text/event-stream` body into `data:` payload strings. */
export async function* sseData(res: Response): AsyncGenerator<string> {
  for await (const line of lines(res)) {
    if (line.startsWith('data:')) {
      const data = line.slice(5).trim();
      if (data && data !== '[DONE]') yield data;
    }
  }
}

/** Split a streamed body into lines (also used for Ollama's NDJSON). */
export async function* lines(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      yield line;
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) yield buffer.trim();
}

export function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : { value: v };
  } catch {
    return { _raw: raw };
  }
}

let counter = 0;
export function callId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}
