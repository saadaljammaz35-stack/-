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
 * Normalises a Saudi phone number as typed by people:
 * "055 123 4567" → "+966551234567", "00966…" → "+966…", "0112345678" → "+966112345678".
 * Other international numbers keep their "+". Returns the cleaned input when
 * it cannot be normalised, so validation can reject it.
 */
export function normalizePhone(input: string): string {
  let value = toLatinDigits(input).trim().replace(/[\s\-().]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (/^0\d{8,9}$/.test(value)) value = `+966${value.slice(1)}`;
  else if (/^5\d{8}$/.test(value)) value = `+966${value}`;
  else if (/^966\d{8,9}$/.test(value)) value = `+${value}`;
  return value;
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

/**
 * Only allows same-origin relative paths as a post-login destination, so a
 * crafted ?next= cannot send people to another site.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
