export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "CONTEXT_TOO_LONG"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR"
  | "GPU_UNAVAILABLE"
  | "DEPLOY_GATE"
  | "PRECONDITION_FAILED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  CONTEXT_TOO_LONG: 413,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_TIMEOUT: 504,
  PROVIDER_ERROR: 502,
  GPU_UNAVAILABLE: 503,
  DEPLOY_GATE: 409,
  PRECONDITION_FAILED: 412,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(code: ErrorCode, message: string, opts: { details?: unknown; headers?: Record<string, string>; cause?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = opts.details;
    this.headers = opts.headers;
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found`);

interface PgError {
  code?: string;
  hint?: string;
  message?: string;
  constraint?: string;
}

/** Converts database errors into stable API errors without leaking SQL. */
export function fromDbError(err: unknown): AppError | null {
  const e = err as PgError;
  if (!e || typeof e.code !== "string" || !/^[0-9A-Z]{5}$/.test(e.code)) return null;
  switch (e.code) {
    case "23505":
      return new AppError("CONFLICT", "A resource with these details already exists", { details: { constraint: e.constraint } });
    case "23503":
      return new AppError("NOT_FOUND", "A referenced resource does not exist or is not accessible");
    case "23514":
      if (e.hint === "omnix_deploy_gate") {
        return new AppError("DEPLOY_GATE", "This version has not passed a full evaluation run and cannot be deployed");
      }
      return new AppError("VALIDATION_FAILED", "The request violates a data constraint", { details: { constraint: e.constraint } });
    case "23502":
    case "22P02":
    case "22001":
    case "22003":
      return new AppError("VALIDATION_FAILED", "Invalid value");
    case "42501":
      // Row level security or missing privilege: never reveal whether the row exists.
      return new AppError("FORBIDDEN", "You do not have access to this resource");
    case "40001":
    case "40P01":
      return new AppError("CONFLICT", "Concurrent update, please retry");
    default:
      return null;
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  return fromDbError(err) ?? new AppError("INTERNAL", "Internal error", { cause: err });
}

export function errorBody(err: AppError, requestId: string) {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
      requestId,
    },
  };
}
