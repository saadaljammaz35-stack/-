/**
 * EMVCo QR payloads.
 *
 * This implements the EMVCo Merchant-Presented Mode QR specification — the same
 * TLV format behind mada QR and the QR standards used across the region. It is
 * written to the standard rather than invented, because a QR code is read by
 * *other people's* apps: a proprietary format would only ever work inside NABD,
 * and a merchant sticker that only one wallet can scan is worthless.
 *
 * Structure is nested tag-length-value:
 *
 *   ID (2 digits) · LENGTH (2 digits) · VALUE (LENGTH characters)
 *
 * The final field is always tag 63, a CRC-16 over everything before it —
 * including its own tag and length. Scanners are noisy: a smudged sticker or a
 * bad camera frame produces a payload that parses but is wrong. The checksum is
 * what stops a corrupted amount being paid.
 */

import { type CurrencyCode, getCurrency, Money, ValidationError } from '@nabd/shared';

// ── EMVCo field identifiers ─────────────────────────────────────────────────

export const QrTag = {
  PAYLOAD_FORMAT: '00',
  INITIATION_METHOD: '01',
  /** 26–51 are reserved for merchant account templates. */
  MERCHANT_ACCOUNT_START: 26,
  MERCHANT_ACCOUNT_END: 51,
  MERCHANT_CATEGORY_CODE: '52',
  TRANSACTION_CURRENCY: '53',
  TRANSACTION_AMOUNT: '54',
  COUNTRY_CODE: '58',
  MERCHANT_NAME: '59',
  MERCHANT_CITY: '60',
  ADDITIONAL_DATA: '62',
  /** Merchant name and city in a non-Latin script. */
  LANGUAGE_TEMPLATE: '64',
  CRC: '63',
} as const;

/** Sub-tags inside the tag-62 additional-data template. */
export const AdditionalTag = {
  BILL_NUMBER: '01',
  MOBILE_NUMBER: '02',
  STORE_LABEL: '03',
  REFERENCE_LABEL: '05',
  TERMINAL_LABEL: '07',
  PURPOSE: '08',
} as const;

/** Sub-tags inside the tag-64 language template. */
export const LanguageTag = {
  LANGUAGE_PREFERENCE: '00',
  MERCHANT_NAME_ALT: '01',
  MERCHANT_CITY_ALT: '02',
} as const;

/** Sub-tags inside a merchant-account template. */
export const AccountTag = {
  GLOBALLY_UNIQUE_IDENTIFIER: '00',
  MERCHANT_ID: '01',
  /** NABD's own handle — a wallet id or a phone number. */
  NABD_HANDLE: '02',
} as const;

/** Identifies a NABD-issued account template inside the QR. */
export const NABD_QR_IDENTIFIER = 'SA.NABD';

/**
 * A static QR is printed once and reused; a dynamic QR is generated per
 * transaction and carries an amount. The distinction matters for replay: a
 * dynamic code is expected to be used once, and the reference inside it is what
 * makes that enforceable.
 */
export const InitiationMethod = {
  STATIC: '11',
  DYNAMIC: '12',
} as const;
export type InitiationMethod = (typeof InitiationMethod)[keyof typeof InitiationMethod];

// ── CRC-16/CCITT-FALSE ──────────────────────────────────────────────────────

/**
 * Polynomial 0x1021, initial value 0xFFFF, no reflection, no final XOR —
 * exactly as the EMVCo specification requires. Any deviation produces codes
 * that other wallets silently reject.
 */
export function crc16(input: string): string {
  // Over UTF-8 BYTES, not UTF-16 code units. For pure ASCII the two are
  // identical, which is why this kind of bug survives every Latin-only test —
  // but an Arabic merchant name produces a completely different checksum, and
  // NABD is Arabic-first.
  const bytes = Buffer.from(input, 'utf8');
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// ── encoding ────────────────────────────────────────────────────────────────

function tlv(id: string, value: string): string {
  if (value.length > 99) {
    throw new ValidationError(`QR field ${id} exceeds the 99-character maximum`, {
      id,
      length: value.length,
    });
  }
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

export interface QrPayloadParams {
  /** Omit for a static (reusable) code. */
  readonly amount?: Money;
  readonly currency: CurrencyCode;
  /**
   * Latin-script name, per the specification's tag 59. Arabic and other
   * non-Latin names belong in `merchantNameAr`, which EMVCo's tag 64 exists
   * for — putting them in tag 59 breaks scanners that assume Latin there.
   */
  readonly merchantName: string;
  readonly merchantCity: string;
  readonly merchantNameAr?: string;
  readonly merchantCityAr?: string;
  readonly countryCode?: string;
  /** ISO 18245 merchant category. 0000 where not applicable. */
  readonly merchantCategoryCode?: string;
  /** The NABD wallet handle being paid — an account id or a phone number. */
  readonly nabdHandle: string;
  readonly merchantId?: string;
  /** Unique per dynamic code, so a scanned code cannot be paid twice. */
  readonly reference?: string;
  readonly billNumber?: string;
  readonly purpose?: string;
}

export function buildQrPayload(params: QrPayloadParams): string {
  if (params.merchantName.trim() === '') {
    throw new ValidationError('QR merchant name is required');
  }
  if (params.amount !== undefined && !params.amount.isPositive) {
    throw new ValidationError('QR amount must be greater than zero');
  }
  if (params.amount !== undefined && params.amount.currency !== params.currency) {
    throw new ValidationError('QR amount currency does not match the declared currency');
  }

  const dynamic = params.amount !== undefined;

  // The merchant-account template: a globally unique identifier followed by
  // the identifiers meaningful to that scheme.
  const accountTemplate =
    tlv(AccountTag.GLOBALLY_UNIQUE_IDENTIFIER, NABD_QR_IDENTIFIER) +
    (params.merchantId === undefined
      ? ''
      : tlv(AccountTag.MERCHANT_ID, params.merchantId)) +
    tlv(AccountTag.NABD_HANDLE, params.nabdHandle);

  const additional =
    (params.billNumber === undefined
      ? ''
      : tlv(AdditionalTag.BILL_NUMBER, params.billNumber)) +
    (params.reference === undefined
      ? ''
      : tlv(AdditionalTag.REFERENCE_LABEL, params.reference)) +
    (params.purpose === undefined ? '' : tlv(AdditionalTag.PURPOSE, params.purpose));

  let payload =
    tlv(QrTag.PAYLOAD_FORMAT, '01') +
    tlv(
      QrTag.INITIATION_METHOD,
      dynamic ? InitiationMethod.DYNAMIC : InitiationMethod.STATIC,
    ) +
    tlv('26', accountTemplate) +
    tlv(QrTag.MERCHANT_CATEGORY_CODE, params.merchantCategoryCode ?? '0000') +
    tlv(QrTag.TRANSACTION_CURRENCY, getCurrency(params.currency).numeric);

  if (params.amount !== undefined) {
    // The amount travels as a major-unit decimal string, per the standard.
    // It is produced from bigint minor units, so no float is involved.
    payload += tlv(QrTag.TRANSACTION_AMOUNT, params.amount.toMajorString());
  }

  payload +=
    tlv(QrTag.COUNTRY_CODE, params.countryCode ?? 'SA') +
    tlv(QrTag.MERCHANT_NAME, params.merchantName.slice(0, 25)) +
    tlv(QrTag.MERCHANT_CITY, params.merchantCity.slice(0, 15));

  if (additional !== '') {
    payload += tlv(QrTag.ADDITIONAL_DATA, additional);
  }

  if (params.merchantNameAr !== undefined) {
    payload += tlv(
      QrTag.LANGUAGE_TEMPLATE,
      tlv(LanguageTag.LANGUAGE_PREFERENCE, 'AR') +
        tlv(LanguageTag.MERCHANT_NAME_ALT, params.merchantNameAr.slice(0, 25)) +
        (params.merchantCityAr === undefined
          ? ''
          : tlv(LanguageTag.MERCHANT_CITY_ALT, params.merchantCityAr.slice(0, 15))),
    );
  }

  // The CRC covers the tag and length of the CRC field itself, so they are
  // appended before the checksum is computed.
  const withCrcHeader = `${payload}${QrTag.CRC}04`;
  return `${withCrcHeader}${crc16(withCrcHeader)}`;
}

// ── decoding ────────────────────────────────────────────────────────────────

export interface ParsedQr {
  readonly isDynamic: boolean;
  readonly amount: Money | null;
  readonly currency: CurrencyCode | null;
  readonly merchantName: string;
  readonly merchantCity: string;
  readonly countryCode: string;
  readonly merchantCategoryCode: string;
  /** Present when the code was issued by NABD. */
  readonly nabdHandle: string | null;
  readonly merchantId: string | null;
  readonly reference: string | null;
  readonly billNumber: string | null;
  readonly purpose: string | null;
  readonly merchantNameAr: string | null;
  readonly merchantCityAr: string | null;
  readonly raw: ReadonlyMap<string, string>;
}

function parseTlv(input: string): Map<string, string> {
  const fields = new Map<string, string>();
  let cursor = 0;

  while (cursor < input.length) {
    // A truncated payload must be rejected, not partially interpreted.
    if (cursor + 4 > input.length) {
      throw new ValidationError('Malformed QR payload: truncated field header');
    }
    const id = input.slice(cursor, cursor + 2);
    const lengthText = input.slice(cursor + 2, cursor + 4);

    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) {
      throw new ValidationError('Malformed QR payload: non-numeric tag or length');
    }

    const length = Number(lengthText);
    const start = cursor + 4;
    const end = start + length;
    if (end > input.length) {
      throw new ValidationError('Malformed QR payload: field length exceeds the payload');
    }

    fields.set(id, input.slice(start, end));
    cursor = end;
  }
  return fields;
}

/** Locate a merchant-account template in the 26–51 range. */
function findAccountTemplate(fields: Map<string, string>): Map<string, string> | null {
  for (let id = QrTag.MERCHANT_ACCOUNT_START; id <= QrTag.MERCHANT_ACCOUNT_END; id += 1) {
    const value = fields.get(String(id).padStart(2, '0'));
    if (value === undefined) continue;
    try {
      const template = parseTlv(value);
      if (template.get(AccountTag.GLOBALLY_UNIQUE_IDENTIFIER) === NABD_QR_IDENTIFIER) {
        return template;
      }
    } catch {
      // A template we cannot parse is simply not ours.
      continue;
    }
  }
  return null;
}

const NUMERIC_TO_CURRENCY: Record<string, CurrencyCode> = {
  '682': 'SAR',
  '840': 'USD',
  '978': 'EUR',
  '826': 'GBP',
  '392': 'JPY',
  '414': 'KWD',
  '048': 'BHD',
};

/**
 * Parse and verify a scanned payload.
 *
 * The checksum is verified before any field is trusted. A scanner reading a
 * smudged sticker or a bad camera frame can produce a payload that parses
 * perfectly and carries the wrong amount; the CRC is the only thing that
 * catches it.
 */
export function parseQrPayload(payload: string): ParsedQr {
  if (payload.length < 8) {
    throw new ValidationError('QR payload is too short to be valid');
  }

  const crcIndex = payload.lastIndexOf(`${QrTag.CRC}04`);
  if (crcIndex === -1 || crcIndex + 8 !== payload.length) {
    throw new ValidationError('QR payload has no checksum field');
  }

  const body = payload.slice(0, crcIndex + 4);
  const provided = payload.slice(crcIndex + 4).toUpperCase();
  const expected = crc16(body);

  if (provided !== expected) {
    throw new ValidationError('QR checksum does not match — the code may be damaged', {
      expected,
      provided,
    });
  }

  const fields = parseTlv(payload.slice(0, crcIndex));

  if (fields.get(QrTag.PAYLOAD_FORMAT) !== '01') {
    throw new ValidationError('Unsupported QR payload format');
  }

  const account = findAccountTemplate(fields);
  const additional =
    fields.get(QrTag.ADDITIONAL_DATA) === undefined
      ? new Map<string, string>()
      : parseTlv(fields.get(QrTag.ADDITIONAL_DATA) as string);

  const language =
    fields.get(QrTag.LANGUAGE_TEMPLATE) === undefined
      ? new Map<string, string>()
      : parseTlv(fields.get(QrTag.LANGUAGE_TEMPLATE) as string);

  const currencyNumeric = fields.get(QrTag.TRANSACTION_CURRENCY);
  const currency =
    currencyNumeric === undefined ? null : (NUMERIC_TO_CURRENCY[currencyNumeric] ?? null);

  const amountText = fields.get(QrTag.TRANSACTION_AMOUNT);
  let amount: Money | null = null;
  if (amountText !== undefined) {
    if (currency === null) {
      throw new ValidationError('QR carries an amount but no recognised currency');
    }
    amount = Money.fromMajor(amountText, currency);
  }

  return {
    isDynamic: fields.get(QrTag.INITIATION_METHOD) === InitiationMethod.DYNAMIC,
    amount,
    currency,
    merchantName: fields.get(QrTag.MERCHANT_NAME) ?? '',
    merchantCity: fields.get(QrTag.MERCHANT_CITY) ?? '',
    countryCode: fields.get(QrTag.COUNTRY_CODE) ?? '',
    merchantCategoryCode: fields.get(QrTag.MERCHANT_CATEGORY_CODE) ?? '0000',
    nabdHandle: account?.get(AccountTag.NABD_HANDLE) ?? null,
    merchantId: account?.get(AccountTag.MERCHANT_ID) ?? null,
    reference: additional.get(AdditionalTag.REFERENCE_LABEL) ?? null,
    billNumber: additional.get(AdditionalTag.BILL_NUMBER) ?? null,
    purpose: additional.get(AdditionalTag.PURPOSE) ?? null,
    merchantNameAr: language.get(LanguageTag.MERCHANT_NAME_ALT) ?? null,
    merchantCityAr: language.get(LanguageTag.MERCHANT_CITY_ALT) ?? null,
    raw: fields,
  };
}

/** Non-throwing scan, for a camera loop that sees many bad frames per second. */
export function tryParseQrPayload(payload: string): ParsedQr | null {
  try {
    return parseQrPayload(payload);
  } catch {
    return null;
  }
}

// ── payment safety ──────────────────────────────────────────────────────────

export type QrRejectionReason =
  | 'NOT_A_NABD_CODE'
  | 'AMOUNT_MISMATCH'
  | 'CURRENCY_NOT_SUPPORTED'
  | 'SELF_PAYMENT'
  | 'DYNAMIC_CODE_REUSED';

export interface QrPaymentCheck {
  readonly acceptable: boolean;
  readonly reason?: QrRejectionReason;
  /** What the customer will actually pay. */
  readonly amountToPay: Money | null;
  /** True when the payer must type the amount themselves. */
  readonly requiresAmountEntry: boolean;
}

/**
 * Decide whether a scanned code may be paid.
 *
 * The rule worth stating: **when the code carries an amount, the customer pays
 * that amount and nothing else.** Letting the app override a dynamic code's
 * amount would mean the figure the merchant displayed and the figure charged
 * could differ — which is the entire trust model of scanning a code.
 */
export function checkQrPayment(params: {
  parsed: ParsedQr;
  payerHandle: string;
  enteredAmount?: Money;
  supportedCurrencies: readonly CurrencyCode[];
  /** References of dynamic codes this payer has already paid. */
  usedReferences?: ReadonlySet<string>;
}): QrPaymentCheck {
  const { parsed } = params;

  if (parsed.nabdHandle === null) {
    return {
      acceptable: false,
      reason: 'NOT_A_NABD_CODE',
      amountToPay: null,
      requiresAmountEntry: false,
    };
  }
  if (parsed.nabdHandle === params.payerHandle) {
    return {
      acceptable: false,
      reason: 'SELF_PAYMENT',
      amountToPay: null,
      requiresAmountEntry: false,
    };
  }
  if (parsed.currency === null || !params.supportedCurrencies.includes(parsed.currency)) {
    return {
      acceptable: false,
      reason: 'CURRENCY_NOT_SUPPORTED',
      amountToPay: null,
      requiresAmountEntry: false,
    };
  }

  // A dynamic code is generated per transaction. Paying one twice is either a
  // double-tap or a replayed screenshot.
  if (
    parsed.isDynamic &&
    parsed.reference !== null &&
    params.usedReferences?.has(parsed.reference) === true
  ) {
    return {
      acceptable: false,
      reason: 'DYNAMIC_CODE_REUSED',
      amountToPay: null,
      requiresAmountEntry: false,
    };
  }

  if (parsed.amount !== null) {
    // The code fixes the amount. An entered amount that disagrees is rejected
    // rather than silently preferred either way.
    if (params.enteredAmount !== undefined && !params.enteredAmount.equals(parsed.amount)) {
      return {
        acceptable: false,
        reason: 'AMOUNT_MISMATCH',
        amountToPay: parsed.amount,
        requiresAmountEntry: false,
      };
    }
    return { acceptable: true, amountToPay: parsed.amount, requiresAmountEntry: false };
  }

  // A static code carries no amount; the payer supplies it.
  if (params.enteredAmount === undefined) {
    return { acceptable: false, amountToPay: null, requiresAmountEntry: true };
  }
  if (!params.enteredAmount.isPositive) {
    return { acceptable: false, amountToPay: null, requiresAmountEntry: true };
  }

  return {
    acceptable: true,
    amountToPay: params.enteredAmount,
    requiresAmountEntry: false,
  };
}
