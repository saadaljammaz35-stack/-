/**
 * The NABD error taxonomy.
 *
 * Every error carries a stable machine-readable `code` that clients switch on,
 * and a `publicMessage` that is safe to show an end user. Anything sensitive
 * goes in `details`, which the API layer logs but never serialises to a
 * customer response.
 */

export type ErrorCategory =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'RATE_LIMIT'
  | 'PROVIDER'
  | 'INTERNAL';

export interface SerializedError {
  readonly code: string;
  readonly message: string;
  readonly category: ErrorCategory;
  readonly status: number;
  readonly requestId?: string;
}

export abstract class NabdError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;
  abstract readonly status: number;

  /** Extra context for logs and incident review. Never returned to a customer. */
  readonly details: Readonly<Record<string, unknown>>;

  /** True when a client may safely retry the identical request. */
  readonly retryable: boolean = false;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.details = Object.freeze({ ...details });
    Error.captureStackTrace?.(this, new.target);
  }

  /** The customer-safe rendering. Subclasses override when the raw message leaks. */
  get publicMessage(): string {
    return this.message;
  }

  toJSON(requestId?: string): SerializedError {
    return {
      code: this.code,
      message: this.publicMessage,
      category: this.category,
      status: this.status,
      ...(requestId === undefined ? {} : { requestId }),
    };
  }
}

// ── validation ────────────────────────────────────────────────────────────

export class ValidationError extends NabdError {
  readonly code = 'validation_error';
  readonly category: ErrorCategory = 'VALIDATION';
  readonly status = 422;
}

export class InvalidAmountError extends NabdError {
  readonly code = 'invalid_amount';
  readonly category: ErrorCategory = 'VALIDATION';
  readonly status = 422;
}

export class CurrencyMismatchError extends NabdError {
  readonly code = 'currency_mismatch';
  readonly category: ErrorCategory = 'VALIDATION';
  readonly status = 422;

  constructor(expected: string, received: string) {
    super(`Currency mismatch: expected ${expected}, received ${received}`, {
      expected,
      received,
    });
  }
}

// ── auth ──────────────────────────────────────────────────────────────────

export class AuthenticationError extends NabdError {
  readonly code = 'authentication_failed';
  readonly category: ErrorCategory = 'AUTHENTICATION';
  readonly status = 401;

  /**
   * Authentication failures are deliberately vague to the caller: telling an
   * attacker whether the identifier or the secret was wrong is an enumeration
   * oracle. The specific reason goes to `details` for our own logs.
   */
  override get publicMessage(): string {
    return 'Invalid credentials';
  }
}

export class SessionExpiredError extends NabdError {
  readonly code = 'session_expired';
  readonly category: ErrorCategory = 'AUTHENTICATION';
  readonly status = 401;
}

export class TokenReuseDetectedError extends NabdError {
  readonly code = 'token_reuse_detected';
  readonly category: ErrorCategory = 'AUTHENTICATION';
  readonly status = 401;

  override get publicMessage(): string {
    return 'Session ended for security reasons. Please sign in again.';
  }
}

export class MfaRequiredError extends NabdError {
  readonly code = 'mfa_required';
  readonly category: ErrorCategory = 'AUTHENTICATION';
  readonly status = 401;
}

export class ForbiddenError extends NabdError {
  readonly code = 'forbidden';
  readonly category: ErrorCategory = 'AUTHORIZATION';
  readonly status = 403;

  override get publicMessage(): string {
    return 'You do not have permission to perform this action';
  }
}

export class StrongAuthRequiredError extends NabdError {
  readonly code = 'strong_auth_required';
  readonly category: ErrorCategory = 'AUTHORIZATION';
  readonly status = 403;
}

// ── lookup / conflict ─────────────────────────────────────────────────────

export class NotFoundError extends NabdError {
  readonly code = 'not_found';
  readonly category: ErrorCategory = 'NOT_FOUND';
  readonly status = 404;

  constructor(resource: string, id?: string) {
    super(`${resource} not found`, id === undefined ? { resource } : { resource, id });
  }
}

export class IdempotencyConflictError extends NabdError {
  readonly code = 'idempotency_conflict';
  readonly category: ErrorCategory = 'CONFLICT';
  readonly status = 409;

  override get publicMessage(): string {
    return 'This idempotency key was already used with a different request body';
  }
}

export class RequestInProgressError extends NabdError {
  readonly code = 'request_in_progress';
  readonly category: ErrorCategory = 'CONFLICT';
  readonly status = 409;
  override readonly retryable = true;
}

export class ConcurrencyConflictError extends NabdError {
  readonly code = 'concurrency_conflict';
  readonly category: ErrorCategory = 'CONFLICT';
  readonly status = 409;
  override readonly retryable = true;
}

// ── business rules ────────────────────────────────────────────────────────

export class InsufficientFundsError extends NabdError {
  readonly code = 'insufficient_funds';
  readonly category: ErrorCategory = 'BUSINESS_RULE';
  readonly status = 422;

  /**
   * The available balance is intentionally kept out of the public message. The
   * caller can read their own balance through the accounts endpoint; echoing it
   * inside a failed-payment error makes balance probing trivial for anyone
   * holding a leaked token.
   */
  override get publicMessage(): string {
    return 'Insufficient funds';
  }
}

export class UnbalancedJournalError extends NabdError {
  readonly code = 'unbalanced_journal';
  readonly category: ErrorCategory = 'BUSINESS_RULE';
  readonly status = 500;

  constructor(debits: bigint, credits: bigint, details: Record<string, unknown> = {}) {
    super(
      `Journal does not balance: debits=${debits.toString()} credits=${credits.toString()}`,
      { ...details, debits: debits.toString(), credits: credits.toString() },
    );
  }

  override get publicMessage(): string {
    return 'Transaction could not be posted';
  }
}

export class ImmutableRecordError extends NabdError {
  readonly code = 'immutable_record';
  readonly category: ErrorCategory = 'BUSINESS_RULE';
  readonly status = 409;
}

export class InvalidStateTransitionError extends NabdError {
  readonly code = 'invalid_state_transition';
  readonly category: ErrorCategory = 'BUSINESS_RULE';
  readonly status = 409;

  constructor(entity: string, from: string, to: string) {
    super(`${entity} cannot move from ${from} to ${to}`, { entity, from, to });
  }
}

export class AccountNotActiveError extends NabdError {
  readonly code = 'account_not_active';
  readonly category: ErrorCategory = 'BUSINESS_RULE';
  readonly status = 422;
}

export class LimitExceededError extends NabdError {
  readonly code = 'limit_exceeded';
  readonly category: ErrorCategory = 'BUSINESS_RULE';
  readonly status = 422;
}

export class ComplianceBlockError extends NabdError {
  readonly code = 'compliance_block';
  readonly category: ErrorCategory = 'BUSINESS_RULE';
  readonly status = 403;

  /** Never tell the subject of a screening hit why they were blocked. */
  override get publicMessage(): string {
    return 'This transaction cannot be completed. Please contact support.';
  }
}

// ── infrastructure ────────────────────────────────────────────────────────

export class RateLimitError extends NabdError {
  readonly code = 'rate_limited';
  readonly category: ErrorCategory = 'RATE_LIMIT';
  readonly status = 429;
  override readonly retryable = true;

  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, details: Record<string, unknown> = {}) {
    super('Too many requests', { ...details, retryAfterSeconds });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ProviderError extends NabdError {
  // Widened deliberately: ProviderTimeoutError narrows these further.
  readonly code: string = 'provider_error';
  readonly category: ErrorCategory = 'PROVIDER';
  readonly status: number = 502;
  override readonly retryable: boolean;

  constructor(
    provider: string,
    message: string,
    retryable = true,
    details: Record<string, unknown> = {},
  ) {
    super(`[${provider}] ${message}`, { ...details, provider });
    this.retryable = retryable;
  }

  override get publicMessage(): string {
    return 'A downstream service is unavailable. Please try again shortly.';
  }
}

export class ProviderTimeoutError extends ProviderError {
  override readonly code = 'provider_timeout';
  override readonly status = 504;

  constructor(provider: string, timeoutMs: number) {
    super(provider, `Timed out after ${timeoutMs}ms`, true, { timeoutMs });
  }
}

export class CircuitOpenError extends NabdError {
  readonly code = 'circuit_open';
  readonly category: ErrorCategory = 'PROVIDER';
  readonly status = 503;
  override readonly retryable = true;
}

export class ConfigurationError extends NabdError {
  readonly code = 'configuration_error';
  readonly category: ErrorCategory = 'INTERNAL';
  readonly status = 500;

  override get publicMessage(): string {
    return 'Service misconfigured';
  }
}

export class InternalError extends NabdError {
  readonly code = 'internal_error';
  readonly category: ErrorCategory = 'INTERNAL';
  readonly status = 500;

  override get publicMessage(): string {
    return 'An unexpected error occurred';
  }
}

export function isNabdError(error: unknown): error is NabdError {
  return error instanceof NabdError;
}
