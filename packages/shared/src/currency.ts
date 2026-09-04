/**
 * ISO-4217 currency registry.
 *
 * The `exponent` is the number of decimal digits in the currency's minor unit.
 * SAR has exponent 2, so 1 SAR = 100 halalas. JPY has exponent 0. KWD has 3.
 * Every amount in NABD is stored as an integer count of minor units, so the
 * exponent is the only thing that turns storage into presentation.
 */

export interface CurrencyDefinition {
  /** ISO-4217 alphabetic code. */
  readonly code: string;
  /** ISO-4217 numeric code. */
  readonly numeric: string;
  /** Digits after the decimal separator. */
  readonly exponent: number;
  /** English display name. */
  readonly name: string;
  /** Arabic display name. */
  readonly nameAr: string;
  /** Symbol used in the UI. */
  readonly symbol: string;
  /**
   * Whether this currency is switched on for product use. Currencies that are
   * defined but not enabled exist so the ledger and formatting code are proven
   * against non-2-exponent currencies before we ever launch one.
   */
  readonly enabled: boolean;
}

const DEFINITIONS = {
  SAR: {
    code: 'SAR',
    numeric: '682',
    exponent: 2,
    name: 'Saudi Riyal',
    nameAr: 'ريال سعودي',
    symbol: 'SAR',
    enabled: true,
  },
  USD: {
    code: 'USD',
    numeric: '840',
    exponent: 2,
    name: 'US Dollar',
    nameAr: 'دولار أمريكي',
    symbol: '$',
    enabled: true,
  },
  EUR: {
    code: 'EUR',
    numeric: '978',
    exponent: 2,
    name: 'Euro',
    nameAr: 'يورو',
    symbol: '€',
    enabled: true,
  },
  GBP: {
    code: 'GBP',
    numeric: '826',
    exponent: 2,
    name: 'British Pound',
    nameAr: 'جنيه إسترليني',
    symbol: '£',
    enabled: true,
  },
  // Defined but not enabled — these exist to keep exponent handling honest.
  JPY: {
    code: 'JPY',
    numeric: '392',
    exponent: 0,
    name: 'Japanese Yen',
    nameAr: 'ين ياباني',
    symbol: '¥',
    enabled: false,
  },
  KWD: {
    code: 'KWD',
    numeric: '414',
    exponent: 3,
    name: 'Kuwaiti Dinar',
    nameAr: 'دينار كويتي',
    symbol: 'KWD',
    enabled: false,
  },
  BHD: {
    code: 'BHD',
    numeric: '048',
    exponent: 3,
    name: 'Bahraini Dinar',
    nameAr: 'دينار بحريني',
    symbol: 'BHD',
    enabled: false,
  },
} as const satisfies Record<string, CurrencyDefinition>;

export type CurrencyCode = keyof typeof DEFINITIONS;

/** Currencies that are live for product use. */
export const ENABLED_CURRENCIES = (Object.keys(DEFINITIONS) as CurrencyCode[]).filter(
  (code) => DEFINITIONS[code].enabled,
);

/** Every currency the registry knows about, enabled or not. */
export const KNOWN_CURRENCIES = Object.keys(DEFINITIONS) as CurrencyCode[];

/** The platform's base currency for reporting. */
export const BASE_CURRENCY: CurrencyCode = 'SAR';

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && Object.hasOwn(DEFINITIONS, value);
}

export function isEnabledCurrency(value: unknown): value is CurrencyCode {
  return isCurrencyCode(value) && DEFINITIONS[value].enabled;
}

export function getCurrency(code: CurrencyCode): CurrencyDefinition {
  return DEFINITIONS[code];
}

export function currencyExponent(code: CurrencyCode): number {
  return DEFINITIONS[code].exponent;
}

/** 10 ** exponent, as a bigint — the number of minor units in one major unit. */
export function minorUnitsPerMajor(code: CurrencyCode): bigint {
  return 10n ** BigInt(DEFINITIONS[code].exponent);
}
