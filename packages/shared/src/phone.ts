/**
 * Phone number handling.
 *
 * In a wallet product the phone number is the primary way people find each
 * other — you send money to a number, not to an IBAN. That makes normalisation
 * a correctness concern, not a formatting nicety: if `0512345678` and
 * `+966512345678` normalise differently, the same person becomes two
 * unreachable identities and a transfer silently goes nowhere.
 *
 * Everything is stored in E.164 (`+966512345678`). Every lookup normalises
 * first. The database `CHECK` constraint on `users.phone` enforces the same
 * shape, so a malformed number cannot be written even by raw SQL.
 */

import { ValidationError } from './errors.js';

export interface CountryPhoneRules {
  readonly iso: string;
  /** Country calling code, without the plus. */
  readonly dialCode: string;
  /** Length of the subscriber number, after the country code. */
  readonly nationalLength: number;
  /** Leading digits a valid mobile number must start with. */
  readonly mobilePrefixes: readonly string[];
  /** Trunk prefix stripped when a number is written nationally (KSA: "0"). */
  readonly trunkPrefix: string;
}

/**
 * Saudi Arabia first, since that is the launch market. The registry shape
 * supports adding markets without touching the parsing logic.
 */
export const COUNTRY_RULES: Record<string, CountryPhoneRules> = {
  SA: {
    iso: 'SA',
    dialCode: '966',
    nationalLength: 9,
    // All Saudi mobile numbers begin with 5.
    mobilePrefixes: ['5'],
    trunkPrefix: '0',
  },
  AE: {
    iso: 'AE',
    dialCode: '971',
    nationalLength: 9,
    mobilePrefixes: ['5'],
    trunkPrefix: '0',
  },
  BH: {
    iso: 'BH',
    dialCode: '973',
    nationalLength: 8,
    mobilePrefixes: ['3'],
    trunkPrefix: '',
  },
  KW: {
    iso: 'KW',
    dialCode: '965',
    nationalLength: 8,
    mobilePrefixes: ['5', '6', '9'],
    trunkPrefix: '',
  },
  EG: {
    iso: 'EG',
    dialCode: '20',
    nationalLength: 10,
    mobilePrefixes: ['1'],
    trunkPrefix: '0',
  },
};

export const DEFAULT_COUNTRY = 'SA';

/**
 * Map Arabic-Indic and Eastern Arabic-Indic digits to ASCII.
 *
 * An Arabic-first keyboard produces ٠١٢٣ rather than 0123. Without this, a
 * customer typing their own number on an Arabic keypad would fail validation
 * on a number that is perfectly correct.
 */
const DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

export function toAsciiDigits(input: string): string {
  let out = '';
  for (const char of input) {
    out += DIGIT_MAP[char] ?? char;
  }
  return out;
}

export interface ParsedPhone {
  /** Canonical storage form: +966512345678 */
  readonly e164: string;
  readonly countryIso: string;
  readonly dialCode: string;
  readonly nationalNumber: string;
  readonly isMobile: boolean;
}

/**
 * Normalise any of the forms a person might type into E.164.
 *
 * Accepted for Saudi Arabia:
 *   +966512345678 · 00966512345678 · 966512345678 · 0512345678 · 512345678
 *   with spaces, dashes, parentheses, or Arabic-Indic digits anywhere.
 */
export function parsePhone(input: string, defaultCountry = DEFAULT_COUNTRY): ParsedPhone {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new ValidationError('Phone number is required');
  }

  const rules = COUNTRY_RULES[defaultCountry];
  if (rules === undefined) {
    throw new ValidationError(`Unsupported country: ${defaultCountry}`);
  }

  // Normalise digits, then strip every separator a human might use.
  let digits = toAsciiDigits(input.trim()).replace(/[\s\-().]/g, '');

  const hadPlus = digits.startsWith('+');
  if (hadPlus) digits = digits.slice(1);
  // International access prefix, e.g. 00966…
  else if (digits.startsWith('00')) digits = digits.slice(2);

  if (!/^\d+$/.test(digits)) {
    throw new ValidationError('Phone number contains invalid characters', {
      // The input itself is not echoed — a phone number is personal data and
      // this message may reach a log.
      length: input.length,
    });
  }

  let country = rules;
  let national: string;

  if (digits.startsWith(rules.dialCode) && digits.length > rules.nationalLength) {
    // Written with the country code.
    national = digits.slice(rules.dialCode.length);
  } else {
    // Written nationally. Try every known country code before falling back, so
    // a number from another supported market is not mangled into a local one.
    const match = Object.values(COUNTRY_RULES).find(
      (c) =>
        digits.startsWith(c.dialCode) &&
        digits.length === c.dialCode.length + c.nationalLength,
    );
    if (match !== undefined) {
      country = match;
      national = digits.slice(match.dialCode.length);
    } else {
      national = digits;
    }
  }

  // Strip the trunk prefix: 0512345678 → 512345678.
  if (country.trunkPrefix !== '' && national.startsWith(country.trunkPrefix)) {
    national = national.slice(country.trunkPrefix.length);
  }

  if (national.length !== country.nationalLength) {
    throw new ValidationError(
      `Phone number must be ${country.nationalLength} digits after the country code`,
      { expected: country.nationalLength, received: national.length },
    );
  }

  const isMobile = country.mobilePrefixes.some((p) => national.startsWith(p));

  return {
    e164: `+${country.dialCode}${national}`,
    countryIso: country.iso,
    dialCode: country.dialCode,
    nationalNumber: national,
    isMobile,
  };
}

/** Normalise, or throw. Use before every write and every lookup. */
export function normalisePhone(input: string, defaultCountry = DEFAULT_COUNTRY): string {
  return parsePhone(input, defaultCountry).e164;
}

/** Non-throwing variant for optimistic client-side validation. */
export function tryNormalisePhone(
  input: string,
  defaultCountry = DEFAULT_COUNTRY,
): string | null {
  try {
    return normalisePhone(input, defaultCountry);
  } catch {
    return null;
  }
}

export function isValidMobile(input: string, defaultCountry = DEFAULT_COUNTRY): boolean {
  try {
    return parsePhone(input, defaultCountry).isMobile;
  } catch {
    return false;
  }
}

/**
 * Display form, grouped for readability: +966 51 234 5678.
 * Presentation only — never feed this back into a lookup.
 */
export function formatPhone(e164: string): string {
  const parsed = parsePhone(e164);
  const n = parsed.nationalNumber;
  const groups =
    n.length === 9
      ? [n.slice(0, 2), n.slice(2, 5), n.slice(5)]
      : [n.slice(0, 3), n.slice(3, 6), n.slice(6)];
  return `+${parsed.dialCode} ${groups.filter(Boolean).join(' ')}`;
}

/**
 * Masked form for display to a *sender* confirming a recipient.
 *
 * Shows enough to confirm the right person without turning the app into a
 * directory that maps numbers to names for anyone who guesses.
 */
export function maskPhoneForConfirmation(e164: string): string {
  const parsed = parsePhone(e164);
  const n = parsed.nationalNumber;
  return `+${parsed.dialCode} ${n.slice(0, 2)}••••${n.slice(-2)}`;
}
