/**
 * The error type thrown by callFunction() (src/lib/api.ts). Kept in its own
 * module, free of the Supabase client, so error helpers stay out of the
 * public pages' bundle.
 */

/** A field error from a 400 `invalid_request` response. */
export interface FieldIssue {
  path: string;
  message: string;
}

export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string | null;
}

/**
 * Error thrown by callFunction(). `code` is the machine code from docs/API.md
 * (`"rate_limited"`, `"seat_limit"`, …), or with status 0: `"network_error"`
 * when the server could not be reached, `"timeout"` when it did not answer
 * within `timeout` (it may still have done the work), `"aborted"` when the
 * caller's signal cancelled it. Show it with errorText(t, error).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? null;
    this.requestId = init.requestId ?? null;
  }

  /** Field errors for `invalid_request` (empty for every other error). */
  get fieldIssues(): FieldIssue[] {
    if (!Array.isArray(this.details)) return [];
    return this.details.filter(
      (item): item is FieldIssue =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).path === "string" &&
        typeof (item as Record<string, unknown>).message === "string",
    );
  }

  /** `details.retry_after_seconds` on 429 responses. */
  get retryAfterSeconds(): number | null {
    const details = this.details as Record<string, unknown> | null;
    const value = details && typeof details === "object" ? details.retry_after_seconds : undefined;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Fallback code when a non-2xx response has no `error` field (e.g. gateway errors). */
export function codeForStatus(status: number): string {
  if (status === 400) return "invalid_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 413) return "payload_too_large";
  if (status === 429) return "rate_limited";
  if (status === 502 || status === 504) return "upstream_error";
  return "internal_error";
}
