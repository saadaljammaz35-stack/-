import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { ApiError, codeForStatus } from "./apiError";
import { supabase } from "./supabase";

export {
  ApiError,
  isApiError,
  codeForStatus,
  type ApiErrorInit,
  type FieldIssue,
} from "./apiError";

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
