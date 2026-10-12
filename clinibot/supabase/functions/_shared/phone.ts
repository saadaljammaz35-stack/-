// Phone numbers arrive as patients type them: Arabic-Indic digits, spaces,
// a local "05…" Saudi mobile, or a full international number. Everything is
// stored in E.164 form ("+9665XXXXXXXX").

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Converts Arabic-Indic and Extended Arabic-Indic digits to ASCII digits. */
export function normalizeDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    const b = EXTENDED_ARABIC_INDIC.indexOf(ch);
    out += a >= 0 ? String(a) : b >= 0 ? String(b) : ch;
  }
  return out;
}

/**
 * Returns the number in E.164 form, or null when it cannot be a real number.
 * Local Saudi mobiles ("05XXXXXXXX", "5XXXXXXXX") are given the +966 prefix.
 */
export function normalizePhone(input: string): string | null {
  let value = normalizeDigits(input).trim().replace(/[\s\-().]/g, "");
  if (value.startsWith("+")) value = value.slice(1);
  else if (value.startsWith("00")) value = value.slice(2);
  else if (/^05\d{8}$/.test(value)) value = `966${value.slice(1)}`;
  else if (/^5\d{8}$/.test(value)) value = `966${value}`;

  if (!/^[1-9]\d{7,14}$/.test(value)) return null;
  // A Saudi number must be a full 9-digit national number after the 966 prefix.
  if (value.startsWith("966") && value.length !== 12) return null;
  return `+${value}`;
}

/** WhatsApp IDs are the international number without the "+". */
export function waIdToE164(waId: string): string | null {
  return /^\d{6,20}$/.test(waId) ? `+${waId}` : null;
}

/** E.164 to WhatsApp recipient format (digits only). */
export function e164ToWaId(phone: string): string {
  return phone.replace(/^\+/, "");
}
