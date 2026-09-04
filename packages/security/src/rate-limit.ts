/**
 * Rate limiting and brute-force lockout.
 *
 * A sliding-window counter rather than a fixed window: a fixed window lets an
 * attacker send a full quota at 00:59 and another at 01:00, doubling the
 * intended rate at the boundary. The sliding window weights the previous
 * window's count by how much of it is still in view.
 *
 * The `RateLimitStore` port is backed by Redis in production; the in-memory
 * implementation here is for tests and single-node development only — it does
 * not share state across processes, so it is not a limiter in a cluster.
 */

import { type Clock, RateLimitError, systemClock } from '@nabd/shared';

export interface RateLimitRule {
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
}

/**
 * Defaults tuned per endpoint class. Money-moving and credential endpoints are
 * far tighter than reads, because their abuse cases are enumeration, credential
 * stuffing and payment fraud rather than load.
 */
export const RATE_LIMITS = {
  loginPerIp: { name: 'login:ip', limit: 20, windowMs: 15 * 60_000 },
  loginPerAccount: { name: 'login:account', limit: 5, windowMs: 15 * 60_000 },
  otpRequest: { name: 'otp:request', limit: 5, windowMs: 60 * 60_000 },
  otpVerify: { name: 'otp:verify', limit: 10, windowMs: 15 * 60_000 },
  transferCreate: { name: 'transfer:create', limit: 30, windowMs: 60_000 },
  beneficiaryAdd: { name: 'beneficiary:add', limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { name: 'password:reset', limit: 3, windowMs: 60 * 60_000 },
  readDefault: { name: 'read:default', limit: 300, windowMs: 60_000 },
  writeDefault: { name: 'write:default', limit: 60, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly limit: number;
  readonly retryAfterSeconds: number;
  readonly resetAt: number;
}

export interface RateLimitStore {
  /** Returns the count in the current window after incrementing. */
  increment(
    key: string,
    windowMs: number,
    now: number,
  ): Promise<{ current: number; previous: number; windowStart: number }>;
  reset(key: string): Promise<void>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<
    string,
    { start: number; count: number; prev: number }
  >();

  async increment(
    key: string,
    windowMs: number,
    now: number,
  ): Promise<{ current: number; previous: number; windowStart: number }> {
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const entry = this.windows.get(key);

    if (entry === undefined || entry.start < windowStart) {
      const previous =
        entry !== undefined && entry.start === windowStart - windowMs ? entry.count : 0;
      this.windows.set(key, { start: windowStart, count: 1, prev: previous });
      return { current: 1, previous, windowStart };
    }

    entry.count += 1;
    return { current: entry.count, previous: entry.prev, windowStart };
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key);
  }
}

export class RateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly clock: Clock = systemClock,
  ) {}

  async check(rule: RateLimitRule, identifier: string): Promise<RateLimitDecision> {
    const now = this.clock.nowMs();
    const key = `rl:${rule.name}:${identifier}`;
    const { current, previous, windowStart } = await this.store.increment(
      key,
      rule.windowMs,
      now,
    );

    // Weight the previous window by the fraction of it still inside the
    // sliding view. This is what closes the fixed-window boundary burst.
    const elapsed = now - windowStart;
    const previousWeight = Math.max(0, 1 - elapsed / rule.windowMs);
    const weighted = current + previous * previousWeight;

    const allowed = weighted <= rule.limit;
    const resetAt = windowStart + rule.windowMs;

    return {
      allowed,
      limit: rule.limit,
      remaining: Math.max(0, Math.floor(rule.limit - weighted)),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000)),
      resetAt,
    };
  }

  /** Check and throw. The API's guard uses this form. */
  async enforce(rule: RateLimitRule, identifier: string): Promise<RateLimitDecision> {
    const decision = await this.check(rule, identifier);
    if (!decision.allowed) {
      throw new RateLimitError(decision.retryAfterSeconds, {
        rule: rule.name,
        limit: rule.limit,
      });
    }
    return decision;
  }

  async reset(rule: RateLimitRule, identifier: string): Promise<void> {
    await this.store.reset(`rl:${rule.name}:${identifier}`);
  }
}

// ── account lockout ─────────────────────────────────────────────────────────

export interface LockoutState {
  readonly failedCount: number;
  readonly lockedUntil: Date | null;
}

/**
 * Exponential backoff after repeated credential failures, capped.
 *
 * Backoff rather than a permanent lock: a permanent lock hands an attacker a
 * cheap denial-of-service — they lock every account they can name. Escalating
 * delay makes online guessing worthless while a legitimate user gets back in
 * on their own.
 */
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_BASE_MS = 60_000;
export const LOCKOUT_MAX_MS = 60 * 60_000;

export function nextLockout(failedCount: number, now: Date): LockoutState {
  if (failedCount < LOCKOUT_THRESHOLD) {
    return { failedCount, lockedUntil: null };
  }
  const overage = failedCount - LOCKOUT_THRESHOLD;
  const delay = Math.min(LOCKOUT_BASE_MS * 2 ** overage, LOCKOUT_MAX_MS);
  return { failedCount, lockedUntil: new Date(now.getTime() + delay) };
}

export function isLockedOut(state: LockoutState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}
