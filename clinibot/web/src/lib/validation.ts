/**
 * Small, dependency-free helpers shared by forms. Zod schemas live next to
 * the form that uses them; these helpers keep the rules identical to the
 * database CHECK constraints in supabase/migrations.
 */

/** organizations.slug: ^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$ (3–48 chars). */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 48;

/** Phone columns: ^\+?[1-9][0-9]{7,14}$ */
export const PHONE_PATTERN = /^\+?[1-9][0-9]{7,14}$/;

export const PASSWORD_MIN = 10;
/** bcrypt (Supabase Auth) only uses the first 72 bytes. */
export const PASSWORD_MAX = 72;

/** Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits to Latin digits. */
export function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (char) => {
    const code = char.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/**
 * Suggests a clinic link from a name written in Latin letters:
 * "Smile Dental Clinic" → "smile-dental-clinic". Returns "" when the name has
 * no Latin letters or digits (e.g. an Arabic-only name).
 */
export function slugify(name: string): string {
  const slug = toLatinDigits(name)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  return slug.length >= SLUG_MIN ? slug : "";
}

/** Keeps only characters allowed in a slug while the user types. */
export function sanitizeSlugInput(value: string): string {
  return toLatinDigits(value)
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, SLUG_MAX);
}

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

/**
 * A phone number as people type it → E.164, or null when it can't be dialled.
 * The one rule behind every client copy (clinic numbers here, patient numbers
 * in appointments/model.ts, the demo form); whatever it returns also passes the
 * server's rule (supabase/functions/_shared/phone.ts) and the database CHECK:
 * - Arabic-Indic digits become Latin; spaces, dashes, dots and brackets go.
 * - "+…" and "00…" are international.
 * - Local Saudi forms get +966: "05XXXXXXXX" and "5XXXXXXXX" mobiles, and with
 *   `landlines` (the default, for clinic numbers) also "01XXXXXXXX" landlines.
 *   A bare "966…" is kept; any other number without "+" or "00" is refused.
 * - A trunk 0 typed after 966 ("+966 055…") is dropped.
 * - A Saudi number must have exactly 9 national digits.
 */
export function normalizePhone(
  input: string,
  { landlines = true }: { landlines?: boolean } = {},
): string | null {
  let value = toLatinDigits(input)
    .trim()
    .replace(/[\s\-().]/g, "");
  if (value.startsWith("+")) value = value.slice(1);
  else if (value.startsWith("00")) value = value.slice(2);
  else if (landlines ? /^0\d{9}$/.test(value) : /^05\d{8}$/.test(value)) {
    value = `966${value.slice(1)}`;
  } else if (/^5\d{8}$/.test(value)) value = `966${value}`;
  else if (!/^966\d+$/.test(value)) return null;
  if (value.startsWith("9660")) value = `966${value.slice(4)}`;
  if (!/^[1-9]\d{7,14}$/.test(value)) return null;
  if (value.startsWith("966") && value.length !== 12) return null;
  return `+${value}`;
}

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value);
}

export type PasswordStrength = 0 | 1 | 2 | 3;

/**
 * A simple, honest hint (not a guarantee): 0 weak … 3 strong. Length matters
 * most; character variety adds a little. Anything under the minimum is weak.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN) return 0;
  let score = 0;
  if (password.length >= 14) score += 1;
  if (password.length >= 18) score += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes >= 3) score += 1;
  if (/^(.)\1+$/.test(password) || /^(?:0123456789|1234567890|password|qwerty)/i.test(password)) {
    return 0;
  }
  return Math.min(3, Math.max(1, score)) as PasswordStrength;
}

/** Control characters (which URL parsing strips) or a backslash (which it reads as "/"). */
function hasUnsafeUrlChars(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f || char === "\\") return true;
  }
  return false;
}

/**
 * Only allows same-origin relative paths as a post-login destination, so a
 * crafted ?next= cannot send people to another site. Returns `next` itself
 * (never a normalised form) when it is safe.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || hasUnsafeUrlChars(next)) {
    return fallback;
  }
  // A fixed placeholder base, so the check does not depend on `window`.
  const BASE = "http://next.invalid";
  try {
    const url = new URL(next, BASE);
    // "/.//evil.com" resolves to the path "//evil.com", which browsers treat as another host.
    if (url.origin !== BASE || url.pathname.startsWith("//")) return fallback;
  } catch {
    return fallback;
  }
  return next;
}
