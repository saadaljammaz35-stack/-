/**
 * Time is an injected dependency.
 *
 * Anything that expires — holds, OTPs, refresh tokens, consents, cooling
 * periods — reads the clock through this interface. Tests then drive expiry
 * deterministically instead of sleeping, and no test is flaky because a
 * boundary landed on a millisecond.
 */

export interface Clock {
  now(): Date;
  nowMs(): number;
}

export const systemClock: Clock = {
  now: () => new Date(),
  nowMs: () => Date.now(),
};

/** A clock the caller controls. Test-only, but shipped so tests can import it. */
export class FixedClock implements Clock {
  private current: number;

  constructor(start: Date | number = 0) {
    this.current = typeof start === 'number' ? start : start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  nowMs(): number {
    return this.current;
  }

  advance(ms: number): this {
    this.current += ms;
    return this;
  }

  set(value: Date | number): this {
    this.current = typeof value === 'number' ? value : value.getTime();
    return this;
  }
}

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
