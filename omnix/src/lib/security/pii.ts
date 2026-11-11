// Detection of personal and secret data, used to keep it out of long-term
// memory and to flag dataset items before training. Detection is
// conservative and explainable: every finding names its type and position.

export type PiiType =
  | "email"
  | "phone"
  | "saudi_national_id"
  | "iban"
  | "payment_card"
  | "api_key"
  | "private_key"
  | "password";

export interface PiiFinding {
  type: PiiType;
  index: number;
  sample: string;
}

function luhn(d: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Saudi national / iqama numbers: 10 digits, start with 1 or 2, Luhn-style check. */
function validSaudiId(d: string): boolean {
  if (!/^[12]\d{9}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let n = d.charCodeAt(i) - 48;
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

const mask = (s: string) => (s.length <= 4 ? "****" : `${s.slice(0, 2)}…${s.slice(-2)}`);

export function detectPii(text: string): PiiFinding[] {
  const out: PiiFinding[] = [];
  const digitsText = text.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
  const push = (type: PiiType, m: RegExpExecArray) => out.push({ type, index: m.index, sample: mask(m[0]) });
  const scan = (re: RegExp, type: PiiType, src = text, check?: (s: string) => boolean) => {
    for (const m of src.matchAll(re)) if (!check || check(m[0])) push(type, m as RegExpExecArray);
  };

  scan(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "email");
  scan(/(?:\+?966|00966|0)5\d{8}\b/g, "phone", digitsText.replace(/[\s-]/g, ""));
  scan(/\b[12]\d{9}\b/g, "saudi_national_id", digitsText, validSaudiId);
  // Saudi IBAN: SA + 2 check digits + 20 characters (24 total), optionally grouped by 4.
  scan(/\bSA\d{2}(?:\s?[A-Z0-9]{4}){5}\b/gi, "iban");
  scan(/\b\d(?:[ -]?\d){12,18}\b/g, "payment_card", digitsText, (s) => {
    const d = s.replace(/\D/g, "");
    return d.length >= 13 && d.length <= 19 && luhn(d) && !validSaudiId(d);
  });
  scan(/\b(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|hf_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|omx_[a-z0-9]{8}_[A-Za-z0-9_-]{20,})/g, "api_key");
  scan(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "private_key");
  scan(/(?:password|passwd|pwd|كلمة\s*(?:المرور|السر)|الباسورد|الرقم\s*السري)\s*[:=：هي]+\s*\S{4,}/gi, "password");
  return out.sort((a, b) => a.index - b.index);
}

export function hasPii(text: string): boolean {
  return detectPii(text).length > 0;
}
