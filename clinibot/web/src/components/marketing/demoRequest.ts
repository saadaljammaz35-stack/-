import { z } from "zod";
import type { Lang, MessageKey } from "@/i18n";
import { isApiError } from "@/lib/apiError";
import { describeError } from "@/lib/errors";
import { normalizePhone } from "@/lib/validation";

/**
 * The "request a free demo" form. Rules mirror the demo-request Edge Function
 * (supabase/functions/demo-request/handler.ts) so people see problems before
 * sending, and the server's own 400 field errors map back onto the fields.
 */

export const CLINIC_TYPES = [
  "dental",
  "dermatology",
  "cosmetic",
  "general",
  "physio",
  "other",
] as const;
export type ClinicType = (typeof CLINIC_TYPES)[number];

export const CLINIC_TYPE_LABELS: Record<ClinicType, MessageKey> = {
  dental: "marketing.typeDental",
  dermatology: "marketing.typeDermatology",
  cosmetic: "marketing.typeCosmetic",
  general: "marketing.typeGeneral",
  physio: "marketing.typePhysio",
  other: "marketing.typeOther",
};

/**
 * The shared phone rule (lib/validation.ts normalizePhone) with local Saudi
 * mobiles only ("05XXXXXXXX" / "5XXXXXXXX"), as the server's normalizePhone
 * (_shared/phone.ts) reads them, or an international number with "+" or "00".
 * Returns E.164 ("+9665XXXXXXXX") or null when it cannot be a number.
 */
export function normalizeDemoPhone(input: string): string | null {
  return normalizePhone(input, { landlines: false });
}

const emailFormat = z.email();

export const demoRequestSchema = z.object({
  clinic_name: z.string().trim().min(2, "marketing.errClinicName").max(120, "marketing.errTooLong"),
  contact_name: z
    .string()
    .trim()
    .min(2, "marketing.errContactName")
    .max(120, "marketing.errTooLong"),
  phone: z
    .string()
    .trim()
    .min(1, "marketing.errPhoneRequired")
    .max(40, "marketing.errPhone")
    .refine((value) => normalizeDemoPhone(value) !== null, "marketing.errPhone"),
  email: z
    .string()
    .trim()
    .max(254, "marketing.errEmail")
    .refine((value) => value === "" || emailFormat.safeParse(value).success, "marketing.errEmail"),
  city: z.string().trim().max(80, "marketing.errTooLong"),
  clinic_type: z.union([z.enum(CLINIC_TYPES), z.literal("")], { error: "marketing.errClinicType" }),
  message: z.string().trim().max(2000, "marketing.errMessageTooLong"),
  consent: z.boolean().refine((value) => value, "marketing.errConsent"),
});

export type DemoRequestValues = z.input<typeof demoRequestSchema>;
export type DemoRequestData = z.output<typeof demoRequestSchema>;
export type DemoField = Extract<keyof DemoRequestValues, string>;

export const EMPTY_DEMO_REQUEST: DemoRequestValues = {
  clinic_name: "",
  contact_name: "",
  phone: "",
  email: "",
  city: "",
  clinic_type: "",
  message: "",
  consent: false,
};

/** The JSON body for callFunction("demo-request", …). `website` is the honeypot. */
export function demoRequestPayload(
  data: DemoRequestData,
  locale: Lang,
  website: string,
): Record<string, unknown> {
  return {
    clinic_name: data.clinic_name,
    contact_name: data.contact_name,
    phone: normalizeDemoPhone(data.phone) ?? data.phone,
    email: data.email,
    city: data.city,
    clinic_type: data.clinic_type,
    message: data.message,
    locale,
    consent: data.consent,
    website,
  };
}

/** The success body: { ok: true, id } is only sent after the row is stored (201). */
export function isDemoRequestCreated(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const record = body as Record<string, unknown>;
  return record.ok === true && typeof record.id === "string" && record.id !== "";
}

/** Server field path → the message shown under that field. */
const FIELD_MESSAGES: Record<DemoField, MessageKey> = {
  clinic_name: "marketing.errClinicName",
  contact_name: "marketing.errContactName",
  phone: "marketing.errPhone",
  email: "marketing.errEmail",
  city: "marketing.errTooLong",
  clinic_type: "marketing.errClinicType",
  message: "marketing.errMessageTooLong",
  consent: "marketing.errConsent",
};

export type DemoErrorView =
  | { kind: "fields"; fields: Partial<Record<DemoField, MessageKey>> }
  | { kind: "rate_limited" }
  | { kind: "network" }
  | { kind: "other"; requestId: string | null };

/**
 * What to show when sending failed: field errors for a 400 that names known
 * fields, a wait message for 429, a retry message when the server could not
 * be reached, otherwise the standard error text (with its request id).
 */
export function demoErrorView(error: unknown): DemoErrorView {
  const info = describeError(error);
  if (info.code === "network_error" || info.code === "timeout" || info.code === "aborted") {
    return { kind: "network" };
  }
  if (info.code === "rate_limited" || info.status === 429) return { kind: "rate_limited" };
  if (isApiError(error) && error.status === 400) {
    const fields: Partial<Record<DemoField, MessageKey>> = {};
    for (const issue of error.fieldIssues) {
      const field = issue.path.split(".")[0] ?? "";
      const message = (FIELD_MESSAGES as Partial<Record<string, MessageKey>>)[field];
      if (message && !(field in fields)) fields[field as DemoField] = message;
    }
    if (Object.keys(fields).length > 0) return { kind: "fields", fields };
  }
  return { kind: "other", requestId: info.requestId };
}

/**
 * The public contact address from VITE_CONTACT_EMAIL, or null when it is not
 * set (or not an email). The site never invents one.
 */
export function readContactEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return emailFormat.safeParse(email).success ? email : null;
}

/** VITE_CONTACT_EMAIL, read when needed (null when unset). */
export function contactEmail(): string | null {
  return readContactEmail(import.meta.env.VITE_CONTACT_EMAIL);
}
