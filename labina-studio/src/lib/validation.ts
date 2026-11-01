import { z } from "zod";

/** Converts Arabic-Indic and Persian digits to Latin digits */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalizePhone(value: string): string {
  return normalizeDigits(value).replace(/[^\d+]/g, "");
}

const phone = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+?\d{8,15}$/, "رقم الجوال غير صحيح. اكتبه بالأرقام فقط، مثل 05xxxxxxxx."));

const optionalEmail = z
  .string()
  .trim()
  .max(160, "البريد الإلكتروني طويل جداً")
  .refine((v) => v === "" || z.email().safeParse(v).success, "البريد الإلكتروني غير صحيح.")
  .optional()
  .default("");

export const bookingInputSchema = z.object({
  serviceId: z.uuid("اختر نوع الجلسة."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "اختر تاريخ الجلسة."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "اختر وقت الجلسة."),
  name: z.string().trim().min(2, "اكتب الاسم (حرفان على الأقل).").max(80, "الاسم طويل جداً."),
  phone,
  email: optionalEmail,
  children: z.coerce.number().int().min(1, "عدد الأطفال واحد على الأقل.").max(20),
  notes: z.string().trim().max(1000, "الملاحظات أطول من 1000 حرف.").optional().default(""),
  consent: z.literal(true, "يلزم الموافقة على استخدام بياناتك للتواصل بخصوص الحجز."),
  website: z.string().max(0).optional().default(""), // honeypot: real people leave it empty
});
export type BookingInput = z.input<typeof bookingInputSchema>;

export const contactInputSchema = z
  .object({
    name: z.string().trim().min(2, "اكتب الاسم (حرفان على الأقل).").max(80, "الاسم طويل جداً."),
    phone: z
      .string()
      .trim()
      .transform(normalizePhone)
      .refine((v) => v === "" || /^\+?\d{8,15}$/.test(v), "رقم الجوال غير صحيح.")
      .optional()
      .default(""),
    email: optionalEmail,
    subject: z.string().trim().max(120, "العنوان طويل جداً.").optional().default(""),
    message: z.string().trim().min(5, "اكتب رسالتك (5 أحرف على الأقل).").max(2000, "الرسالة أطول من 2000 حرف."),
    website: z.string().max(0).optional().default(""),
  })
  .refine((v) => v.phone !== "" || v.email !== "", {
    message: "أضف رقم جوال أو بريداً إلكترونياً لنتمكن من الرد عليك.",
    path: ["phone"],
  });
export type ContactInput = z.input<typeof contactInputSchema>;

/** Flattens zod issues to { field: firstMessage } */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
