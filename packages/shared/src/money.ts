/**
 * Money — an immutable value object over integer minor units.
 *
 * Rules this file exists to enforce:
 *   1. Amounts are `bigint` minor units. `number` never holds an amount.
 *   2. Two Money values of different currencies never combine silently.
 *   3. Every operation that can lose precision takes an explicit rounding mode.
 *   4. Splitting money conserves the total to the last minor unit.
 */

import {
  type CurrencyCode,
  currencyExponent,
  getCurrency,
  isCurrencyCode,
  minorUnitsPerMajor,
} from './currency.js';
import { CurrencyMismatchError, InvalidAmountError } from './errors.js';

export type RoundingMode =
  /** Round toward zero — truncate. */
  | 'DOWN'
  /** Round away from zero. */
  | 'UP'
  /** Round toward +∞. */
  | 'CEILING'
  /** Round toward −∞. */
  | 'FLOOR'
  /** Ties away from zero. Common for consumer-facing fees. */
  | 'HALF_UP'
  /** Ties toward zero. */
  | 'HALF_DOWN'
  /** Ties to the even neighbour — banker's rounding. Default for rates/FX. */
  | 'HALF_EVEN';

/** Serialised form used on the wire and in JSONB columns. */
export interface MoneyJSON {
  /** Minor units as a decimal string — JSON has no bigint. */
  readonly amount: string;
  readonly currency: CurrencyCode;
  /** Convenience for clients; always derivable from amount + currency. */
  readonly formatted: string;
}

function abs(v: bigint): bigint {
  return v < 0n ? -v : v;
}

/**
 * Divide `numerator` by `denominator`, rounding per `mode`.
 * Pure bigint arithmetic — no float ever touches an amount.
 */
export function divideRound(
  numerator: bigint,
  denominator: bigint,
  mode: RoundingMode,
): bigint {
  if (denominator === 0n) {
    throw new InvalidAmountError('Division by zero');
  }

  // Normalise so the sign lives on the numerator only.
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }

  const negative = n < 0n;
  const an = abs(n);
  const quotient = an / d;
  const remainder = an % d;

  if (remainder === 0n) {
    return negative ? -quotient : quotient;
  }

  const twiceRemainder = remainder * 2n;
  let roundAway: boolean;

  switch (mode) {
    case 'DOWN':
      roundAway = false;
      break;
    case 'UP':
      roundAway = true;
      break;
    case 'CEILING':
      roundAway = !negative;
      break;
    case 'FLOOR':
      roundAway = negative;
      break;
    case 'HALF_UP':
      roundAway = twiceRemainder >= d;
      break;
    case 'HALF_DOWN':
      roundAway = twiceRemainder > d;
      break;
    case 'HALF_EVEN':
      if (twiceRemainder > d) {
        roundAway = true;
      } else if (twiceRemainder < d) {
        roundAway = false;
      } else {
        // Exactly half — go to the even neighbour.
        roundAway = quotient % 2n !== 0n;
      }
      break;
    default: {
      const exhaustive: never = mode;
      throw new InvalidAmountError(`Unknown rounding mode: ${String(exhaustive)}`);
    }
  }

  const magnitude = roundAway ? quotient + 1n : quotient;
  return negative ? -magnitude : magnitude;
}

export class Money {
  /** Signed count of minor units. 12 850.75 SAR is 1285075n. */
  readonly minor: bigint;
  readonly currency: CurrencyCode;

  private constructor(minor: bigint, currency: CurrencyCode) {
    this.minor = minor;
    this.currency = currency;
    Object.freeze(this);
  }

  // ── construction ────────────────────────────────────────────────────────

  /** Build from a raw minor-unit count. This is the storage representation. */
  static fromMinor(minor: bigint | number | string, currency: CurrencyCode): Money {
    if (!isCurrencyCode(currency)) {
      throw new InvalidAmountError(`Unknown currency: ${String(currency)}`);
    }
    let value: bigint;
    if (typeof minor === 'bigint') {
      value = minor;
    } else if (typeof minor === 'number') {
      if (!Number.isSafeInteger(minor)) {
        throw new InvalidAmountError(
          `Minor units must be a safe integer, received ${minor}`,
        );
      }
      value = BigInt(minor);
    } else {
      if (!/^-?\d+$/.test(minor)) {
        throw new InvalidAmountError(
          `Minor units must be an integer string, received "${minor}"`,
        );
      }
      value = BigInt(minor);
    }
    return new Money(value, currency);
  }

  /**
   * Parse a human-entered major-unit amount: "12,850.75" → 1285075n for SAR.
   * Rejects anything with more decimal places than the currency allows, rather
   * than silently rounding a customer's input.
   */
  static fromMajor(input: string | number, currency: CurrencyCode): Money {
    if (!isCurrencyCode(currency)) {
      throw new InvalidAmountError(`Unknown currency: ${String(currency)}`);
    }

    const raw = typeof input === 'number' ? String(input) : input.trim();
    if (raw === '') {
      throw new InvalidAmountError('Amount is empty');
    }
    if (typeof input === 'number' && !Number.isFinite(input)) {
      throw new InvalidAmountError(`Amount is not finite: ${input}`);
    }

    // Normalise the Arabic thousands separator to ASCII and drop whitespace,
    // then validate the *grouping structure* before removing it. Stripping
    // separators first would quietly turn "1,," into 1.00 — a malformed
    // amount must be rejected, never guessed at.
    const normalised = raw.replace(/٬/g, ',').replace(/[\s  ]/g, '');
    const match = /^(-)?((?:\d+|\d{1,3}(?:,\d{3})+)?)(?:\.(\d+))?$/.exec(normalised);
    if (!match) {
      throw new InvalidAmountError(`Malformed amount: "${raw}"`);
    }

    const groupedWhole = match[2] ?? '';
    const fractionPart = match[3] ?? '';
    if (groupedWhole === '' && fractionPart === '') {
      throw new InvalidAmountError(`Malformed amount: "${raw}"`);
    }

    const sign = match[1] === '-' ? -1n : 1n;
    const wholePart = groupedWhole === '' ? '0' : groupedWhole.replace(/,/g, '');
    const exponent = currencyExponent(currency);

    if (fractionPart.length > exponent) {
      throw new InvalidAmountError(
        `${currency} supports ${exponent} decimal place(s), received "${raw}"`,
      );
    }

    const padded = fractionPart.padEnd(exponent, '0');
    const combined =
      BigInt(wholePart) * minorUnitsPerMajor(currency) + BigInt(padded || '0');
    return new Money(sign * combined, currency);
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(0n, currency);
  }

  // ── arithmetic ──────────────────────────────────────────────────────────

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor + other.minor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor - other.minor, this.currency);
  }

  negate(): Money {
    return new Money(-this.minor, this.currency);
  }

  absolute(): Money {
    return new Money(abs(this.minor), this.currency);
  }

  /** Multiply by a whole number — safe, exact, no rounding needed. */
  multiplyInteger(factor: bigint | number): Money {
    const f = typeof factor === 'bigint' ? factor : BigInt(factor);
    if (typeof factor === 'number' && !Number.isSafeInteger(factor)) {
      throw new InvalidAmountError(`Factor must be a whole number, received ${factor}`);
    }
    return new Money(this.minor * f, this.currency);
  }

  /**
   * Apply a rational rate — a fee of 1.5% is `applyRate(15n, 1000n, 'HALF_UP')`.
   * Rates are expressed as an explicit fraction so no decimal literal, and
   * therefore no binary-float error, can enter a financial calculation.
   */
  applyRate(
    numerator: bigint,
    denominator: bigint,
    mode: RoundingMode = 'HALF_EVEN',
  ): Money {
    return new Money(divideRound(this.minor * numerator, denominator, mode), this.currency);
  }

  /**
   * Convert to another currency at a rational rate. FX is deliberately explicit:
   * the caller supplies the rate as a fraction and the rounding mode, and the
   * result carries the target currency.
   */
  convert(
    to: CurrencyCode,
    rateNumerator: bigint,
    rateDenominator: bigint,
    mode: RoundingMode = 'HALF_EVEN',
  ): Money {
    if (!isCurrencyCode(to)) {
      throw new InvalidAmountError(`Unknown currency: ${String(to)}`);
    }
    // Rebase across differing exponents so 1 unit maps to 1 unit correctly.
    const fromScale = minorUnitsPerMajor(this.currency);
    const toScale = minorUnitsPerMajor(to);
    const value = divideRound(
      this.minor * rateNumerator * toScale,
      rateDenominator * fromScale,
      mode,
    );
    return new Money(value, to);
  }

  /**
   * Split into `parts` shares that sum back to exactly this amount.
   * The remainder is spread one minor unit at a time across the leading shares,
   * so nothing is ever created or lost by a division.
   */
  split(parts: number): Money[] {
    if (!Number.isSafeInteger(parts) || parts <= 0) {
      throw new InvalidAmountError(
        `Split count must be a positive integer, received ${parts}`,
      );
    }
    const n = BigInt(parts);
    const negative = this.minor < 0n;
    const magnitude = abs(this.minor);
    const base = magnitude / n;
    let remainder = magnitude % n;

    const out: Money[] = [];
    for (let i = 0; i < parts; i += 1) {
      let share = base;
      if (remainder > 0n) {
        share += 1n;
        remainder -= 1n;
      }
      out.push(new Money(negative ? -share : share, this.currency));
    }
    return out;
  }

  /**
   * Split proportionally to integer weights, conserving the total exactly.
   * Used for fee apportionment and multi-leg settlement.
   */
  allocate(weights: readonly (bigint | number)[]): Money[] {
    if (weights.length === 0) {
      throw new InvalidAmountError('Allocation requires at least one weight');
    }
    const w = weights.map((x) => (typeof x === 'bigint' ? x : BigInt(x)));
    if (w.some((x) => x < 0n)) {
      throw new InvalidAmountError('Allocation weights must not be negative');
    }
    const total = w.reduce((a, b) => a + b, 0n);
    if (total === 0n) {
      throw new InvalidAmountError('Allocation weights must not sum to zero');
    }

    const negative = this.minor < 0n;
    const magnitude = abs(this.minor);

    const shares = w.map((weight) => (magnitude * weight) / total);
    let remainder = magnitude - shares.reduce((a, b) => a + b, 0n);

    // Hand the leftover minor units to the largest weights first.
    const order = w
      .map((weight, index) => ({ weight, index }))
      .sort((a, b) =>
        b.weight === a.weight ? a.index - b.index : b.weight > a.weight ? 1 : -1,
      );

    let cursor = 0;
    while (remainder > 0n) {
      const target = order[cursor % order.length];
      if (target === undefined) break;
      // Zero-weight participants never receive a remainder unit.
      if (target.weight > 0n) {
        shares[target.index] = (shares[target.index] as bigint) + 1n;
        remainder -= 1n;
      }
      cursor += 1;
      if (cursor > order.length * 2) break;
    }

    return shares.map((share) => new Money(negative ? -share : share, this.currency));
  }

  // ── comparison ──────────────────────────────────────────────────────────

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.minor < other.minor) return -1;
    if (this.minor > other.minor) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minor === other.minor;
  }

  greaterThan(other: Money): boolean {
    return this.compare(other) === 1;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.compare(other) >= 0;
  }

  lessThan(other: Money): boolean {
    return this.compare(other) === -1;
  }

  lessThanOrEqual(other: Money): boolean {
    return this.compare(other) <= 0;
  }

  get isZero(): boolean {
    return this.minor === 0n;
  }

  get isPositive(): boolean {
    return this.minor > 0n;
  }

  get isNegative(): boolean {
    return this.minor < 0n;
  }

  // ── presentation ────────────────────────────────────────────────────────

  /** Major-unit decimal string with the currency's full precision: "12850.75". */
  toMajorString(): string {
    const exponent = currencyExponent(this.currency);
    const negative = this.minor < 0n;
    const digits = abs(this.minor)
      .toString()
      .padStart(exponent + 1, '0');
    const whole = digits.slice(0, digits.length - exponent);
    const fraction = exponent === 0 ? '' : `.${digits.slice(digits.length - exponent)}`;
    return `${negative ? '-' : ''}${whole}${fraction}`;
  }

  /**
   * Localised display string. `ar` yields Arabic-Indic grouping conventions via
   * Intl; `en` yields Western. Formatting is presentation only — it never feeds
   * back into arithmetic.
   */
  format(locale: 'ar' | 'en' = 'en', options?: { showCode?: boolean }): string {
    const exponent = currencyExponent(this.currency);
    const def = getCurrency(this.currency);
    const negative = this.minor < 0n;
    const digits = abs(this.minor)
      .toString()
      .padStart(exponent + 1, '0');
    const whole = digits.slice(0, digits.length - exponent);
    const fraction = digits.slice(digits.length - exponent);

    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const body = exponent === 0 ? grouped : `${grouped}.${fraction}`;
    const sign = negative ? '-' : '';
    const showCode = options?.showCode ?? true;
    if (!showCode) return `${sign}${body}`;

    return locale === 'ar'
      ? `${sign}${body} ${def.nameAr === '' ? def.code : def.symbol === def.code ? def.code : def.symbol}`
      : `${sign}${body} ${def.code}`;
  }

  toJSON(): MoneyJSON {
    return {
      amount: this.minor.toString(),
      currency: this.currency,
      formatted: this.toMajorString(),
    };
  }

  toString(): string {
    return `${this.toMajorString()} ${this.currency}`;
  }

  // ── aggregation ─────────────────────────────────────────────────────────

  /** Sum a list. An empty list needs an explicit currency to stay well-typed. */
  static sum(values: readonly Money[], currency?: CurrencyCode): Money {
    if (values.length === 0) {
      if (currency === undefined) {
        throw new InvalidAmountError('Cannot sum an empty list without a currency');
      }
      return Money.zero(currency);
    }
    const head = values[0] as Money;
    const ccy = currency ?? head.currency;
    let total = 0n;
    for (const v of values) {
      if (v.currency !== ccy) {
        throw new CurrencyMismatchError(ccy, v.currency);
      }
      total += v.minor;
    }
    return new Money(total, ccy);
  }
}
