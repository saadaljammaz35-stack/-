/**
 * Resilience primitives for every external call.
 *
 * An external provider will be slow, will fail, and will occasionally lie about
 * having succeeded. These wrappers exist so that none of those turn into a
 * customer's money being lost or double-sent.
 *
 * The rule that matters most is at the bottom of this file: **only retry
 * operations that are safe to repeat.** A retried `createPayment` without an
 * idempotency key is how a customer gets charged twice.
 */

import {
  CircuitOpenError,
  type Clock,
  ProviderTimeoutError,
  systemClock,
} from '@nabd/shared';

// ── timeout ─────────────────────────────────────────────────────────────────

/**
 * Bound how long we wait. Without this, one hung provider socket occupies a
 * request handler indefinitely and the whole API runs out of capacity — a
 * single slow dependency taking down an unrelated service.
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  providerName: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ProviderTimeoutError(providerName, timeoutMs)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ── retry ───────────────────────────────────────────────────────────────────

export interface RetryOptions {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  /** Only errors this returns true for are retried. */
  readonly isRetryable: (error: unknown) => boolean;
  readonly sleep?: (ms: number) => Promise<void>;
  /** Injectable for deterministic tests. */
  readonly random?: () => number;
}

export const DEFAULT_RETRY: Omit<RetryOptions, 'isRetryable'> = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 2_000,
};

/**
 * Exponential backoff with full jitter.
 *
 * The jitter is not decoration. Without it, every client that failed during an
 * outage retries at the same instant, and the provider is hit by a synchronised
 * thundering herd the moment it comes back — turning a brief outage into a long
 * one.
 */
export function backoffDelay(
  attempt: number,
  options: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs'>,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(options.baseDelayMs * 2 ** attempt, options.maxDelayMs);
  return Math.floor(random() * exponential);
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  let lastError: unknown;

  for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!options.isRetryable(error)) throw error;
      if (attempt === options.maxAttempts - 1) break;
      await sleep(backoffDelay(attempt, options, random));
    }
  }
  throw lastError;
}

// ── circuit breaker ─────────────────────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  /** How long to stay open before probing. */
  readonly resetTimeoutMs: number;
  /** Consecutive successes needed in HALF_OPEN to close again. */
  readonly successThreshold: number;
}

export const DEFAULT_CIRCUIT: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  successThreshold: 2,
};

/**
 * Stops hammering a provider that is already down.
 *
 * Once open, calls fail immediately instead of each waiting for a timeout. That
 * protects our own capacity and gives the provider room to recover rather than
 * being held down by our retries.
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions = DEFAULT_CIRCUIT,
    private readonly clock: Clock = systemClock,
  ) {}

  get currentState(): CircuitState {
    return this.state;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.clock.nowMs() - this.openedAt >= this.options.resetTimeoutMs) {
        // Let a single probe through to see whether the provider recovered.
        this.state = 'HALF_OPEN';
        this.successes = 0;
      } else {
        throw new CircuitOpenError(`Circuit open for ${this.name}`, {
          provider: this.name,
          retryInMs: this.options.resetTimeoutMs - (this.clock.nowMs() - this.openedAt),
        });
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successes += 1;
      if (this.successes >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
      }
      return;
    }
    this.failures = 0;
  }

  private onFailure(): void {
    // A failed probe sends us straight back to open — one success is not
    // evidence of recovery.
    if (this.state === 'HALF_OPEN') {
      this.trip();
      return;
    }
    this.failures += 1;
    if (this.failures >= this.options.failureThreshold) this.trip();
  }

  private trip(): void {
    this.state = 'OPEN';
    this.openedAt = this.clock.nowMs();
    this.successes = 0;
  }

  /** Test and operational escape hatch. */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
  }
}

/**
 * Whether an operation may be retried at all.
 *
 * A read is always safe. A write is safe only when it carries an idempotency
 * key that the provider actually honours — which is why every method on the
 * provider contracts takes one. Retrying a non-idempotent write is how a
 * customer gets charged twice, so the default here is `false`.
 */
export function isSafeToRetry(operation: {
  kind: 'READ' | 'WRITE';
  hasIdempotencyKey: boolean;
}): boolean {
  if (operation.kind === 'READ') return true;
  return operation.hasIdempotencyKey;
}
