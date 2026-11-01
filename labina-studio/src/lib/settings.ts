import { z } from "zod";

/* Settings are stored as JSON in site_settings. Each schema fills in safe
   defaults so a missing or partial row never breaks a page. */

const str = (max: number) => z.string().trim().max(max).catch("").default("");

export const contactSettingsSchema = z.object({
  phone: str(30),
  whatsapp: str(30),
  email: str(160),
  address: str(200),
  city: str(80),
  map_url: str(500),
  instagram: str(200),
  tiktok: str(200),
  snapchat: str(200),
  x: str(200),
  youtube: str(200),
  facebook: str(200),
});
export type ContactSettings = z.infer<typeof contactSettingsSchema>;

export const valueSchema = z.object({ title: z.string().max(60), text: z.string().max(240) });

export const homeSettingsSchema = z.object({
  hero_eyebrow: str(60).default("استوديو الطفولة"),
  hero_title: z.string().trim().min(1).max(120).catch("لحظات صغيرة.. ذكريات تكبر معنا").default("لحظات صغيرة.. ذكريات تكبر معنا"),
  hero_subtitle: z
    .string()
    .trim()
    .max(300)
    .catch("نصنع من تفاصيل الطفولة صوراً وذكريات تبقى معكم للأبد.")
    .default("نصنع من تفاصيل الطفولة صوراً وذكريات تبقى معكم للأبد."),
  hero_images: z.array(z.string().max(1000)).max(4).catch([]).default([]),
  about_title: str(120).default("نبني الذكريات لَبِنةً لَبِنة"),
  about_story: str(2000),
  about_image: str(1000),
  about_mission: str(500),
  about_vision: str(500),
  values: z.array(valueSchema).max(6).catch([]).default([]),
  cta_title: str(120).default("جاهزون نصنع ذكرى جديدة؟"),
  cta_text: str(300),
  seo_description: str(300),
});
export type HomeSettings = z.infer<typeof homeSettingsSchema>;

export const bookingSettingsSchema = z.object({
  timezone: z
    .string()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    })
    .catch("Asia/Riyadh")
    .default("Asia/Riyadh"),
  slot_interval_minutes: z.coerce.number().int().min(5).max(240).catch(30).default(30),
  booking_window_days: z.coerce.number().int().min(1).max(365).catch(60).default(60),
  min_notice_hours: z.coerce.number().int().min(0).max(720).catch(12).default(12),
  cancel_notice_hours: z.coerce.number().int().min(0).max(720).catch(24).default(24),
  max_children: z.coerce.number().int().min(1).max(20).catch(6).default(6),
  currency: str(12).default("ر.س"),
  send_customer_emails: z.boolean().catch(true).default(true),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

export function parseContact(value: unknown): ContactSettings {
  return contactSettingsSchema.parse(value ?? {});
}
export function parseHome(value: unknown): HomeSettings {
  return homeSettingsSchema.parse(value ?? {});
}
export function parseBooking(value: unknown): BookingSettings {
  return bookingSettingsSchema.parse(value ?? {});
}
