import type { Locale } from "./i18n";

/** Operator identity for legal pages. Missing values are shown as missing, never invented. */
export function business(locale: Locale) {
  const missing = locale === "ar" ? "[لم يُستكمل بعد — يجب على المشغّل إضافته قبل الإطلاق]" : "[not provided yet — the operator must add this before launch]";
  return {
    name: process.env.BUSINESS_LEGAL_NAME || missing,
    cr: process.env.BUSINESS_CR_NUMBER || missing,
    address: process.env.BUSINESS_ADDRESS || missing,
    email: process.env.SUPPORT_EMAIL || missing,
    country: process.env.BUSINESS_COUNTRY || "SA",
    complete: Boolean(process.env.BUSINESS_LEGAL_NAME && process.env.BUSINESS_ADDRESS && process.env.SUPPORT_EMAIL),
  };
}

export const LEGAL_UPDATED = "2026-11-07";
