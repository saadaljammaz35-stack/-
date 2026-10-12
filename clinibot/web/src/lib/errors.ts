import { isAuthError } from "@supabase/supabase-js";
import { hasMessage, type MessageKey, type TFunction } from "@/i18n";
import { ApiError, isApiError } from "./api";

/**
 * Normalised view of any error the app can meet: ApiError (Edge Functions),
 * PostgrestError (supabase.from / supabase.rpc), AuthError (supabase.auth),
 * network failures and plain Errors.
 */
export interface ErrorInfo {
  /** Key in the "errors" namespace, without the prefix (e.g. "slug_taken"). */
  code: string;
  status: number | null;
  requestId: string | null;
  retryAfterSeconds: number | null;
}

/** Postgres `hint` values raised by our SQL functions and triggers (see supabase/migrations). */
const POSTGRES_HINTS = new Set([
  "slug_taken",
  "org_limit",
  "last_owner",
  "seat_limit",
  "assistant_not_tested",
  "confirm_mismatch",
]);

/** Postgres / PostgREST error codes → errors.* keys. */
const POSTGRES_CODES: Record<string, string> = {
  "42501": "forbidden", // insufficient_privilege (RLS, role checks)
  "23505": "unique_violation",
  "23514": "check_violation",
  "23503": "invalid_request", // foreign_key_violation
  "23502": "invalid_request", // not_null_violation
  "22023": "invalid_request", // invalid_parameter_value
  "22P02": "invalid_request", // invalid_text_representation (bad uuid, enum)
  "22001": "invalid_request", // string too long
  PGRST116: "not_found", // .single() matched no rows
  PGRST301: "unauthorized", // JWT expired / invalid
  PGRST303: "unauthorized",
};

/** Supabase Auth error codes → errors.* keys (anything else falls back by status). */
const AUTH_CODES: Record<string, string> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  user_already_exists: "user_already_exists",
  email_exists: "user_already_exists",
  weak_password: "weak_password",
  same_password: "same_password",
  over_email_send_rate_limit: "over_email_send_rate_limit",
  over_request_rate_limit: "rate_limited",
  signup_disabled: "signup_disabled",
  email_provider_disabled: "signup_disabled",
  session_not_found: "session_expired",
  session_expired: "session_expired",
  refresh_token_not_found: "session_expired",
  refresh_token_already_used: "session_expired",
  otp_expired: "link_expired",
  flow_state_expired: "link_expired",
  flow_state_not_found: "link_expired",
  bad_code_verifier: "link_expired",
  email_address_invalid: "email_address_invalid",
  email_address_not_authorized: "email_address_invalid",
  validation_failed: "invalid_request",
  request_timeout: "network_error",
};

/** auth-js error classes that carry no code. */
const AUTH_ERROR_NAMES: Record<string, string> = {
  AuthSessionMissingError: "session_expired",
  AuthPKCEGrantCodeExchangeError: "link_expired",
  AuthImplicitGrantRedirectError: "link_expired",
  AuthInvalidCredentialsError: "invalid_request",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true; // fetch() rejects with TypeError
  const name = asRecord(error)?.name;
  return name === "AuthRetryableFetchError" || name === "FunctionsFetchError";
}

export function describeError(error: unknown): ErrorInfo {
  const info: ErrorInfo = { code: "unknown", status: null, requestId: null, retryAfterSeconds: null };

  if (isApiError(error)) {
    return {
      code: error.code,
      status: error.status,
      requestId: error.requestId,
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }

  if (isAuthError(error)) {
    info.status = error.status ?? null;
    const mapped = (error.code ? AUTH_CODES[error.code] : undefined) ?? AUTH_ERROR_NAMES[error.name];
    if (isNetworkFailure(error) || !error.status) {
      // AuthRetryableFetchError has status 0 or undefined when the server was unreachable.
      info.code = mapped ?? "network_error";
      return info;
    }
    if (mapped) info.code = mapped;
    else if (error.status === 429) info.code = "rate_limited";
    else if (error.status === 422 || error.status === 400) info.code = "invalid_request";
    else if (error.status === 401 || error.status === 403) info.code = "session_expired";
    else if (error.status >= 500) info.code = "internal_error";
    return info;
  }

  if (isNetworkFailure(error)) {
    info.code = "network_error";
    return info;
  }

  const record = asRecord(error);
  if (record) {
    // PostgrestError: { code, message, details, hint }
    const hint = typeof record.hint === "string" ? record.hint : null;
    const code = typeof record.code === "string" ? record.code : null;
    if (hint && POSTGRES_HINTS.has(hint)) {
      info.code = hint;
      return info;
    }
    const mapped = code ? POSTGRES_CODES[code] : undefined;
    if (mapped) {
      info.code = mapped;
      return info;
    }
    // supabase-js reports fetch failures inside PostgrestError.message
    if (typeof record.message === "string" && /failed to fetch|network|load failed/i.test(record.message)) {
      info.code = "network_error";
      return info;
    }
  }

  return info;
}

function errorKey(code: string): MessageKey {
  const key = `errors.${code}`;
  return hasMessage(key) ? key : "errors.unknown";
}

/**
 * The message to show for any error, in the current language:
 *
 *   catch (error) { setFormError(errorText(t, error)); }
 *
 * Unknown codes fall back to errors.unknown. Server-provided English text is
 * never shown to users.
 */
export function errorText(t: TFunction, error: unknown): string {
  const info = describeError(error);
  if (info.code === "rate_limited" && info.retryAfterSeconds !== null) {
    return t("errors.rate_limited_retry", { seconds: Math.max(1, Math.ceil(info.retryAfterSeconds)) });
  }
  return t(errorKey(info.code));
}

/** The support reference (Edge Function request_id) for an error, if any. */
export function errorReference(error: unknown): string | null {
  return describeError(error).requestId;
}

/** True when retrying the same request cannot succeed (4xx except 408/429). */
export function isPermanentError(error: unknown): boolean {
  const { status, code } = describeError(error);
  if (code === "network_error" || code === "rate_limited") return false;
  if (status !== null && status >= 400 && status < 500) return status !== 408;
  return code !== "unknown" && code !== "internal_error" && code !== "database_error" && code !== "upstream_error";
}

export { ApiError };
