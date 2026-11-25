import { z } from 'zod';

/* Admin schemas, shared by the dashboard forms (React Hook Form) and the server actions. Messages are Arabic
 * because the dashboard is Arabic-first. */

const M = {
  required: 'هذا الحقل مطلوب',
  tooLong: 'النص أطول من المسموح',
  slug: 'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط، مثل: first-episode',
  url: 'رابط غير صالح (يجب أن يبدأ بـ https://)',
  uuid: 'اختيار غير صالح',
  number: 'رقم غير صالح',
  date: 'تاريخ غير صالح',
};

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
/** "@name" or "name" → "name"; empty → null. */
const handle = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/^@/, '') || null : v);

export const reqText = (max: number) => z.string().trim().min(1, M.required).max(max, M.tooLong);
export const optText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, M.tooLong).nullable().optional()).transform((v) => v ?? null);
export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, M.required)
  .max(100, M.tooLong)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, M.slug);
export const optUuid = z.preprocess(emptyToNull, z.uuid(M.uuid).nullable().optional()).transform((v) => v ?? null);
export const optHttps = (pattern?: RegExp) =>
  z
    .preprocess(emptyToNull, z.string().trim().max(500, M.tooLong).nullable().optional())
    .transform((v) => v ?? null)
    .refine((v) => v === null || (/^https:\/\//.test(v) && (!pattern || pattern.test(v))), M.url);
export const optInt = (min = 0, max = 1_000_000) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined || Number.isNaN(v) ? null : Number(v)),
    z.number(M.number).int(M.number).min(min, M.number).max(max, M.number).nullable(),
  );
export const status = z.enum(['draft', 'review', 'scheduled', 'published', 'archived']);
/** <input type="datetime-local"> value, interpreted in Riyadh time (UTC+3, no daylight saving). */
export const localDateTime = z
  .preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, M.date).nullable().optional())
  .transform((v) => v ?? null);

export function riyadhToIso(local: string | null): string | null {
  if (!local) return null;
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  const date = new Date(`${withSeconds}+03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isoToRiyadhLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(new Date(iso).getTime() + 3 * 3600_000);
  return date.toISOString().slice(0, 16);
}

export const programSchema = z.object({
  id: optUuid,
  slug,
  kind: z.enum(['podcast', 'series', 'show']),
  title: reqText(160),
  title_en: optText(160),
  tagline: optText(240),
  tagline_en: optText(240),
  description: optText(4000),
  description_en: optText(4000),
  hosts: optText(240),
  cover_image_id: optUuid,
  language: z.enum(['ar', 'en']),
  explicit: z.boolean(),
  itunes_category: reqText(120),
  apple_podcasts_url: optHttps(/^https:\/\/podcasts\.apple\.com\//),
  spotify_url: optHttps(/^https:\/\/open\.spotify\.com\//),
  youtube_playlist_url: optHttps(/^https:\/\/(www\.)?youtube\.com\//),
  anghami_url: optHttps(/^https:\/\/(play\.)?anghami\.com\//),
  sort_order: optInt(-1000, 1000),
  status,
  published_at: localDateTime,
});

export const episodeSchema = z.object({
  id: optUuid,
  podcast_id: z.uuid('اختر البرنامج'),
  slug,
  number: optInt(1, 100000),
  season: optInt(1, 1000),
  episode_type: z.enum(['full', 'trailer', 'bonus']),
  title: reqText(200),
  title_en: optText(200),
  summary: optText(600),
  summary_en: optText(600),
  show_notes: optText(20000),
  show_notes_en: optText(20000),
  cover_image_id: optUuid,
  audio_asset_id: optUuid,
  audio_url: optHttps(),
  duration_seconds: optInt(0, 86400),
  youtube_video_id: z
    .preprocess(emptyToNull, z.string().trim().regex(/^[A-Za-z0-9_-]{11}$/, 'معرّف يوتيوب من 11 خانة').nullable().optional())
    .transform((v) => v ?? null),
  spotify_episode_id: z
    .preprocess(emptyToNull, z.string().trim().regex(/^[A-Za-z0-9]{22}$/, 'معرّف سبوتيفاي من 22 خانة').nullable().optional())
    .transform((v) => v ?? null),
  apple_episode_url: optHttps(/^https:\/\/podcasts\.apple\.com\//),
  is_featured: z.boolean(),
  explicit: z.boolean(),
  status,
  published_at: localDateTime,
  chapters_text: optText(20000),
  transcript_text: optText(1_000_000),
  guest_ids: z.array(z.uuid()).max(20).default([]),
});

export const articleSchema = z.object({
  id: optUuid,
  slug,
  kind: z.enum(['story', 'article', 'essay', 'interview']),
  category_id: optUuid,
  title: reqText(200),
  title_en: optText(200),
  dek: optText(400),
  dek_en: optText(400),
  body: z.string().max(100000, M.tooLong),
  body_en: optText(100000),
  cover_image_id: optUuid,
  author_name: optText(120),
  related_episode_id: optUuid,
  is_featured: z.boolean(),
  status,
  published_at: localDateTime,
});

export const guestSchema = z.object({
  id: optUuid,
  slug,
  name: reqText(120),
  name_en: optText(120),
  headline: optText(200),
  headline_en: optText(200),
  bio: optText(4000),
  bio_en: optText(4000),
  photo_id: optUuid,
  website_url: optHttps(),
  x_handle: z
    .preprocess(handle, z.string().regex(/^[A-Za-z0-9_]{1,15}$/, 'اسم مستخدم غير صالح').nullable().optional())
    .transform((v) => v ?? null),
  instagram_handle: z
    .preprocess(handle, z.string().regex(/^[A-Za-z0-9_.]{1,30}$/, 'اسم مستخدم غير صالح').nullable().optional())
    .transform((v) => v ?? null),
  linkedin_url: optHttps(/^https:\/\/(www\.)?linkedin\.com\//),
  status,
  published_at: localDateTime,
});

export const clipSchema = z
  .object({
    id: optUuid,
    slug,
    title: reqText(200),
    title_en: optText(200),
    description: optText(1000),
    episode_id: optUuid,
    video_asset_id: optUuid,
    thumbnail_id: optUuid,
    youtube_video_id: z
      .preprocess(emptyToNull, z.string().trim().regex(/^[A-Za-z0-9_-]{11}$/, 'معرّف يوتيوب من 11 خانة').nullable().optional())
      .transform((v) => v ?? null),
    external_url: optHttps(/^https:\/\/(www\.)?(tiktok\.com|instagram\.com|x\.com|youtube\.com)\//),
    orientation: z.enum(['vertical', 'horizontal']),
    duration_seconds: optInt(0, 86400),
    status,
    published_at: localDateTime,
  })
  .refine((c) => c.video_asset_id || c.youtube_video_id || c.external_url, {
    message: 'أضف ملف فيديو أو معرّف يوتيوب أو رابطًا خارجيًا',
    path: ['video_asset_id'],
  });

export const categorySchema = z.object({
  id: optUuid,
  slug,
  name: reqText(80),
  name_en: optText(80),
  description: optText(500),
  sort_order: optInt(-1000, 1000),
});

export const inboxUpdateSchema = z.object({
  id: z.uuid(),
  status: z.string().max(20),
  internal_notes: optText(5000),
});

export const settingsSchema = z.object({
  general: z.object({
    site_name: reqText(60),
    site_name_en: reqText(60),
    tagline: reqText(120),
    tagline_en: reqText(120),
    contact_email: z.preprocess(emptyToNull, z.email('بريد غير صالح').nullable().optional()).transform((v) => v ?? null),
    announcement: optText(240),
  }),
  platforms: z.object({
    spotify: optHttps(/^https:\/\/open\.spotify\.com\//),
    apple_podcasts: optHttps(/^https:\/\/podcasts\.apple\.com\//),
    youtube: optHttps(/^https:\/\/(www\.)?youtube\.com\//),
    anghami: optHttps(/^https:\/\/(play\.)?anghami\.com\//),
  }),
  social: z.object({
    x: optHttps(/^https:\/\/(x|twitter)\.com\//),
    instagram: optHttps(/^https:\/\/(www\.)?instagram\.com\//),
    tiktok: optHttps(/^https:\/\/(www\.)?tiktok\.com\//),
    youtube: optHttps(/^https:\/\/(www\.)?youtube\.com\//),
    linkedin: optHttps(/^https:\/\/(www\.)?linkedin\.com\//),
  }),
  brand: z.object({ display_font: z.enum(['plex', 'ward']) }),
  notifications: z.object({
    inbox_email: z.preprocess(emptyToNull, z.email('بريد غير صالح').nullable().optional()).transform((v) => v ?? null),
  }),
});

export const inviteSchema = z.object({
  email: z.email('بريد غير صالح'),
  full_name: reqText(120),
  role: z.enum(['owner', 'admin', 'editor', 'writer']),
});

export const uploadRequestSchema = z.object({
  bucket: z.enum(['images', 'audio', 'video']),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100),
  size: z.number().int().positive(),
});

export const uploadFinalizeSchema = z.object({
  bucket: z.enum(['images', 'audio', 'video']),
  path: z.string().regex(/^[a-z0-9][a-z0-9/_.-]{2,250}$/),
  mimeType: z.string().max(100),
  size: z.number().int().positive(),
  originalName: z.string().max(255),
  width: z.number().int().positive().max(20000).nullable(),
  height: z.number().int().positive().max(20000).nullable(),
  durationSeconds: z.number().int().min(0).max(86400).nullable(),
  alt: optText(300),
});

export type AdminResult =
  | { ok: true; message?: string; redirectTo?: string; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Maps common Postgres/PostgREST errors to Arabic messages for editors. */
export function dbErrorMessage(error: { code?: string; message?: string } | null): string {
  if (!error) return 'حدث خطأ غير متوقع';
  if (error.code === '23505') return 'القيمة مستخدمة من قبل (غالبًا الرابط المختصر slug). اختر قيمة أخرى.';
  if (error.code === '42501') return 'ليست لديك صلاحية لهذا الإجراء.';
  if (error.code === '23503') return 'لا يمكن الحذف لأن عناصر أخرى مرتبطة بهذا العنصر.';
  if (error.code === '23514') return 'بعض القيم لا تطابق الشروط المسموحة.';
  return 'تعذّر حفظ التغييرات. حاول مرة أخرى.';
}
