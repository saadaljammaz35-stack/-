import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Edge Functions documented in docs/API.md. Add a name here when a new
 * function ships so typos fail the type check.
 */
export type FunctionName =
  | "public-chat"
  | "assistant-test"
  | "system-status"
  | "whatsapp-connect"
  | "conversation-reply"
  | "appointment-notify"
  | "invite-member"
  | "demo-request";

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
 * (`"rate_limited"`, `"seat_limit"`, …) or `"network_error"` when the server
 * could not be reached (status 0). Show it with errorText(t, error).
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function readErrorBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await response.clone().text();
    if (!text) return null;
    return asRecord(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Turns whatever supabase.functions.invoke failed with into an ApiError. */
export async function toApiError(error: unknown): Promise<ApiError> {
  if (error instanceof ApiError) return error;

  if (error instanceof FunctionsHttpError || error instanceof FunctionsRelayError) {
    const response: unknown = error.context;
    if (response instanceof Response) {
      const body = await readErrorBody(response);
      const status = response.status;
      const code =
        typeof body?.error === "string" && body.error ? body.error : codeForStatus(status);
      const message =
        typeof body?.message === "string"
          ? body.message
          : typeof body?.msg === "string"
            ? body.msg
            : error.message;
      const requestId =
        typeof body?.request_id === "string"
          ? body.request_id
          : (response.headers.get("x-request-id") ?? response.headers.get("sb-request-id"));
      return new ApiError({ status, code, message, details: body?.details ?? null, requestId });
    }
    return new ApiError({ status: 500, code: "internal_error", message: error.message });
  }

  if (error instanceof FunctionsFetchError || error instanceof TypeError) {
    return new ApiError({ status: 0, code: "network_error", message: error.message });
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError({ status: 0, code: "aborted", message: "Request aborted" });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ApiError({ status: 0, code: "network_error", message });
}

export interface CallFunctionOptions {
  signal?: AbortSignal;
  /** Milliseconds before the request is aborted (default: no timeout). */
  timeout?: number;
}

/**
 * Calls a Supabase Edge Function with the signed-in user's token and returns
 * the parsed JSON body. Throws ApiError on any failure.
 *
 *   const status = await callFunction<SystemStatus>("system-status", { organization_id: org.id });
 */
export async function callFunction<T>(
  name: FunctionName,
  body?: Record<string, unknown>,
  options: CallFunctionOptions = {},
): Promise<T> {
  let result: Awaited<ReturnType<typeof supabase.functions.invoke<T>>>;
  try {
    result = await supabase.functions.invoke<T>(name, {
      method: "POST",
      body: body ?? {},
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.timeout ? { timeout: options.timeout } : {}),
    });
  } catch (error) {
    throw await toApiError(error);
  }
  if (result.error) throw await toApiError(result.error);
  return result.data as T;
}
