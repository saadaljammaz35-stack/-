/**
 * Log redaction.
 *
 * Structured logs are shipped off-host, indexed, and retained. Anything that
 * reaches them has effectively been copied to several systems that are not
 * covered by the database's access controls. This module is the last gate
 * before that happens.
 *
 * The list is deny-by-key plus pattern matching on values, because the field
 * that leaks a PAN is rarely called `pan` — it is called `data`, `raw`, or
 * `providerResponse`.
 */

/** Keys whose values are replaced wholesale, matched case-insensitively. */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'pin',
  'pinhash',
  'otp',
  'code',
  'secret',
  'clientsecret',
  'apikey',
  'api_key',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authorization',
  'cookie',
  'sessionid',
  'privatekey',
  'mfasecret',
  'cvv',
  'cvc',
  'pan',
  'cardnumber',
  'card_number',
  'expiry',
  'nationalid',
  'national_id',
  'iqama',
  'iban',
  'accountnumber',
  'account_number',
  'ssn',
  'dateofbirth',
  'date_of_birth',
  'signature',
]);

export const REDACTED = '[REDACTED]';

/** 13–19 digits, optionally separated — the shape of a card number. */
const PAN_RE = /\b(?:\d[ -]?){12,18}\d\b/g;
/** Two letters, two check digits, then up to 30 alphanumerics. */
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;
const EMAIL_RE = /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

/**
 * Luhn check, so a 16-digit order id is not mistaken for a card number. False
 * positives here are cheap; false negatives are a PAN in a log file.
 */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function redactString(value: string): string {
  return value
    .replace(BEARER_RE, 'Bearer [REDACTED]')
    .replace(JWT_RE, '[REDACTED_JWT]')
    .replace(PAN_RE, (match) => {
      const digits = match.replace(/[ -]/g, '');
      if (digits.length < 13 || digits.length > 19 || !passesLuhn(digits)) return match;
      return `[REDACTED_PAN_${digits.slice(-4)}]`;
    })
    .replace(IBAN_RE, (match) => `[REDACTED_IBAN_${match.slice(-4)}]`)
    .replace(EMAIL_RE, (_m, first: string, domain: string) => `${first}***${domain}`);
}

/**
 * Deep-redact an arbitrary value for logging. Cycles are handled, depth is
 * capped, and unknown object shapes are traversed rather than trusted.
 */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 8) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);

    if (Array.isArray(value)) {
      return value.slice(0, 100).map((item) => redact(item, depth + 1, seen));
    }

    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-_]/g, ''))
        ? REDACTED
        : redact(item, depth + 1, seen);
    }
    return out;
  }

  return '[UNKNOWN]';
}

/** Partially mask a phone number for display: +9665•••••67. */
export function maskPhone(phone: string): string {
  if (phone.length <= 6) return REDACTED;
  return `${phone.slice(0, 5)}${'•'.repeat(Math.max(0, phone.length - 7))}${phone.slice(-2)}`;
}

/** Show only the last four of an account number or IBAN. */
export function maskTail(value: string, visible = 4): string {
  if (value.length <= visible) return REDACTED;
  return `${'•'.repeat(value.length - visible)}${value.slice(-visible)}`;
}
