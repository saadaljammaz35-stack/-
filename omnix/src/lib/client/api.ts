"use client";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** JSON fetch for client components. Same-origin cookies; errors become ApiError with the server's code. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body !== undefined || init.form ? "POST" : "GET"),
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    signal: init.signal,
    credentials: "same-origin",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.location.assign(new URL("/login", window.location.origin).href);
    throw new ApiError(data?.error?.code ?? "ERROR", data?.error?.message ?? res.statusText, res.status, data?.error?.details);
  }
  return data as T;
}

export interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

/** POST that reads a Server-Sent Events stream, calling onEvent for each event. Abort with the signal to stop generation. */
export async function postSse(path: string, body: unknown, onEvent: (e: SseEvent) => void, signal: AbortSignal): Promise<void> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal, credentials: "same-origin" });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data?.error?.code ?? "ERROR", data?.error?.message ?? res.statusText, res.status);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (ev && data) onEvent({ event: ev, data: JSON.parse(data) });
    }
  }
}
