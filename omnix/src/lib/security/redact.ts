// Redaction for logs and for model output. Secret patterns are deliberately
// broad: a false positive costs a few masked characters, a false negative
// leaks a key. Card-like numbers are only masked when they pass a Luhn check,
// so legitimate long numbers in answers (2^50 = 1125899906842624) survive.

const SECRET_PATTERNS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
  [/\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s@/]+@/gi, "$1://[REDACTED]@"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]"],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/g, "[REDACTED_KEY]"],
  [/\bhf_[A-Za-z0-9]{20,}\b/g, "[REDACTED_KEY]"],
  [/\bomx_[a-z0-9]{8}_[A-Za-z0-9_-]{20,}/g, "[REDACTED_KEY]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_KEY]"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, "[REDACTED_KEY]"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, "[REDACTED_KEY]"],
  [/\benc:v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+/g, "[REDACTED_SEALED]"],
  [/\b(Bearer)\s+[A-Za-z0-9._~+/-]{16,}=*/g, "$1 [REDACTED]"],
];

function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function redactCards(text: string): string {
  return text.replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => {
    const digits = m.replace(/[ -]/g, "");
    return digits.length >= 13 && digits.length <= 19 && luhn(digits) ? "[REDACTED_CARD]" : m;
  });
}

const SENSITIVE_KEYS = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|session_?token|private|credential|dsn|database_url/i;

/** Masks secrets and card numbers. */
export function redactText(input: string): string {
  let out = input;
  for (const [re, rep] of SECRET_PATTERNS) out = out.replace(re, rep);
  return redactCards(out);
}

/** Deep redaction for structured log fields. */
export function redact<T>(value: T, depth = 0): T {
  if (depth > 6) return "[TRUNCATED]" as unknown as T;
  if (typeof value === "string") return redactText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1)) as unknown as T;
  if (value && typeof value === "object") {
    if (value instanceof Error) return { name: value.name, message: redactText(value.message) } as unknown as T;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.test(k) && v != null && v !== "" ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out as T;
  }
  return value;
}
