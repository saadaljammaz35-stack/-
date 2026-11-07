export type ApiError = { code: string; message: string; details?: unknown };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

/** Same-origin JSON calls. The server enforces everything; this only reports. */
export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: ApiError };
    if (!res.ok) return { ok: false, status: res.status, error: data.error ?? { code: "http_" + res.status, message: res.statusText } };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: { code: "network", message: "Network error. Check your connection." } };
  }
}
