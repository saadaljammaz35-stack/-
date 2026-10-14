const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * The public contact address from VITE_CONTACT_EMAIL, or null when it is not
 * set or not an email address. The app never invents one.
 */
export function readContactEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return email.length <= 254 && EMAIL_FORMAT.test(email) ? email : null;
}

export function contactEmail(): string | null {
  return readContactEmail(import.meta.env.VITE_CONTACT_EMAIL);
}
