// Customer-facing formatting of appointment times and confirmation messages.
// Saudi patients read Gregorian dates with Latin digits in both languages, so
// the Arabic locale pins the calendar and numbering system explicitly instead
// of relying on ar-SA's defaults (Islamic calendar, Arabic-Indic digits).

export type Language = "ar" | "en";

export const DEFAULT_TIME_ZONE = "Asia/Riyadh";

const LOCALES: Record<Language, string> = {
  ar: "ar-SA-u-ca-gregory-nu-latn",
  en: "en-GB",
};

// Keeps "+966…" reading left to right inside Arabic text.
const LRM = "‎";

function validTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Date and time in the clinic's time zone; an unknown zone falls back to Asia/Riyadh. */
export function formatAppointmentTime(
  at: Date | string,
  language: Language,
  timeZone?: string,
): { date: string; time: string } {
  const instant = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(instant.getTime())) throw new RangeError("Invalid appointment time");
  const zone = validTimeZone(timeZone);
  const locale = LOCALES[language];
  return {
    date: new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(instant),
    time: new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true })
      .format(instant),
  };
}

export interface ConfirmationInput {
  language: Language;
  clinicName: string;
  customerName: string;
  serviceName: string | null;
  date: string;
  time: string;
  address: string | null;
  receptionPhone: string | null;
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** The message sent once the clinic has confirmed an appointment. */
export function confirmationText(input: ConfirmationInput): string {
  const name = clean(input.customerName);
  const service = clean(input.serviceName);
  const address = clean(input.address);
  const phone = clean(input.receptionPhone);
  const clinic = input.clinicName.trim();

  if (input.language === "ar") {
    return [
      name ? `مرحباً ${name}،` : "مرحباً،",
      `تم تأكيد موعدك لدى ${clinic}.`,
      service ? `الخدمة: ${service}` : null,
      `التاريخ: ${input.date}`,
      `الوقت: ${input.time}`,
      address ? `العنوان: ${address}` : null,
      phone
        ? `لتعديل الموعد أو إلغائه يرجى التواصل مع الاستقبال على الرقم ${LRM}${phone}.`
        : "لتعديل الموعد أو إلغائه يرجى التواصل مع استقبال العيادة.",
    ].filter((line): line is string => line !== null).join("\n");
  }

  return [
    name ? `Hello ${name},` : "Hello,",
    `${clinic} has confirmed your appointment.`,
    service ? `Service: ${service}` : null,
    `Date: ${input.date}`,
    `Time: ${input.time}`,
    address ? `Address: ${address}` : null,
    phone
      ? `To change or cancel it, please contact reception on ${phone}.`
      : "To change or cancel it, please contact the clinic's reception.",
  ].filter((line): line is string => line !== null).join("\n");
}
