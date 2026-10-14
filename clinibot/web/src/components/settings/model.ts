import { z } from "zod";
import { isValidPhone, normalizePhone, toLatinDigits } from "@/lib/validation";

/**
 * Form rules for the settings page. Each one matches a CHECK constraint in
 * supabase/migrations (organizations, clinic_settings), so what passes here
 * is what the database accepts.
 */

export const RETENTION = {
  messages: { min: 7, max: 1825 },
  appointments: { min: 30, max: 3650 },
} as const;

/** "" → null, otherwise the trimmed text. */
export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** maps_url: https only, at most 500 characters, and a real URL. */
export function isValidMapsUrl(value: string): boolean {
  if (value.length > 500 || !value.startsWith("https://")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Optional phone: "" stays empty, anything else is normalised (Saudi → +966…) and checked. */
const optionalPhone = (message: string) =>
  z
    .string()
    .transform((value) => (value.trim() === "" ? "" : normalizePhone(value)))
    .refine((value) => value === "" || isValidPhone(value), message);

const optionalText = (max: number) =>
  z.string().refine((value) => value.trim().length <= max, "settings.tooLong");

/** Whole days within [min, max]; accepts Arabic-Indic digits. */
export function parseDays(value: string, min: number, max: number): number | null {
  const digits = toLatinDigits(value).trim();
  if (!/^\d{1,5}$/.test(digits)) return null;
  const days = Number(digits);
  return days >= min && days <= max ? days : null;
}

export const OTHER_CITY = "__other__";

export const profileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "settings.nameRequired")
      .min(2, "settings.nameTooShort")
      .max(120, "settings.nameTooLong"),
    city: z.string(),
    cityOther: z.string().trim().max(80, "settings.cityTooLong"),
    phone: optionalPhone("settings.phoneInvalid"),
    language: z.enum(["ar", "en"]),
  })
  .transform((value) => ({
    name: value.name,
    city: emptyToNull(value.city === OTHER_CITY ? value.cityOther : value.city),
    phone: emptyToNull(value.phone),
    default_language: value.language,
  }));

export const detailsSchema = z
  .object({
    displayNameAr: optionalText(120),
    displayNameEn: optionalText(120),
    addressAr: optionalText(300),
    addressEn: optionalText(300),
    mapsUrl: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value === "" || isValidMapsUrl(value), "settings.mapsUrlInvalid"),
    receptionPhone: optionalPhone("settings.phoneInvalid"),
  })
  .transform((value) => ({
    display_name_ar: emptyToNull(value.displayNameAr),
    display_name_en: emptyToNull(value.displayNameEn),
    address_ar: emptyToNull(value.addressAr),
    address_en: emptyToNull(value.addressEn),
    maps_url: emptyToNull(value.mapsUrl),
    reception_phone: emptyToNull(value.receptionPhone),
  }));

export const privacySchema = z
  .object({
    privacyAr: optionalText(1000),
    privacyEn: optionalText(1000),
    messageDays: z
      .string()
      .refine(
        (value) => parseDays(value, RETENTION.messages.min, RETENTION.messages.max) !== null,
        "settings.retentionRange",
      ),
    appointmentDays: z
      .string()
      .refine(
        (value) =>
          parseDays(value, RETENTION.appointments.min, RETENTION.appointments.max) !== null,
        "settings.retentionRange",
      ),
  })
  .transform((value) => ({
    privacy_notice_ar: emptyToNull(value.privacyAr),
    privacy_notice_en: emptyToNull(value.privacyEn),
    message_retention_days: parseDays(
      value.messageDays,
      RETENTION.messages.min,
      RETENTION.messages.max,
    )!,
    appointment_retention_days: parseDays(
      value.appointmentDays,
      RETENTION.appointments.min,
      RETENTION.appointments.max,
    )!,
  }));

export const hoursNotesSchema = z
  .object({
    noteAr: optionalText(300),
    noteEn: optionalText(300),
  })
  .transform((value) => ({
    working_hours_note_ar: emptyToNull(value.noteAr),
    working_hours_note_en: emptyToNull(value.noteEn),
  }));

/** Absolute URL of a clinic's patient chat page (/c/<slug>). */
export function chatUrl(slug: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/c/${slug}`;
}
