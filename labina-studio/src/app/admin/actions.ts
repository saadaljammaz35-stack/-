"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { errorMessage, isKnownError } from "@/lib/errors";
import { bookingStatusEmail, sendEmail } from "@/lib/email";
import { contactSettingsSchema, homeSettingsSchema, parseBooking, parseContact } from "@/lib/settings";
import { fieldErrors } from "@/lib/validation";
import type { ActionResult, BookingPayload, BookingStatus } from "@/lib/types";

/* ───────────────────────── helpers ───────────────────────── */

const uuid = z.uuid();
const SAVED = "تم الحفظ.";

function refreshPublic() {
  revalidatePath("/", "layout");
}

function dbError(error: { message: string; code?: string }, scope: string): ActionResult<never> {
  const code = error.message?.trim();
  if (isKnownError(code)) return { ok: false, error: errorMessage(code), code };
  console.error(`[admin:${scope}]`, error);
  if (error.code === "23505") return { ok: false, error: "القيمة مستخدمة من قبل (مثل الرابط المختصر)." };
  if (error.code === "42501") return { ok: false, error: "ليست لديك صلاحية لهذا الإجراء." };
  if (error.code === "23514") return { ok: false, error: "بعض القيم غير مقبولة. راجع الحقول." };
  return { ok: false, error: "تعذر الحفظ. حاول مرة أخرى." };
}

function invalid(error: z.ZodError): ActionResult<never> {
  return { ok: false, error: "يرجى مراجعة الحقول.", fieldErrors: fieldErrors(error) };
}

/** Image URLs must point at this project's public media bucket */
function isOwnMediaUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(base) && url.startsWith(`${base}/storage/v1/object/public/media/`);
}
const mediaUrl = z.string().max(1000).refine(isOwnMediaUrl, "رابط الصورة غير صالح.");
const optionalMediaUrl = z.union([mediaUrl, z.literal(""), z.null()]).transform((v) => v || null);

async function notifyCustomer(payload: BookingPayload, kind: "confirmed" | "cancelled" | "rescheduled") {
  if (!payload.customer_email) return;
  const supabase = await getServerClient();
  const { data } = await supabase!.from("site_settings").select("key, value").in("key", ["booking", "contact"]);
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  if (!parseBooking(map.booking).send_customer_emails) return;
  const contact = parseContact(map.contact);
  await sendEmail({ to: payload.customer_email, ...bookingStatusEmail(payload, kind), replyTo: contact.email || undefined });
}

/* ───────────────────────── session ───────────────────────── */

export async function signOut() {
  const supabase = await getServerClient();
  await supabase?.auth.signOut();
  redirect("/admin/login");
}

/* ───────────────────────── bookings ───────────────────────── */

const statusSchema = z.enum(["pending", "confirmed", "completed", "cancelled"]);

export async function setBookingStatus(id: string, status: BookingStatus, note = ""): Promise<ActionResult> {
  const auth = await authorize("staff");
  if (!auth.ok) return auth.result;
  if (!uuid.safeParse(id).success || !statusSchema.safeParse(status).success) return { ok: false, error: "طلب غير صالح." };

  const { data, error } = await auth.supabase.rpc("admin_set_booking_status", {
    p_booking_id: id,
    p_status: status,
    p_note: note.slice(0, 500),
  });
  if (error) return dbError(error, "status");
  const payload = data as unknown as BookingPayload & { changed: boolean };
  if (payload.changed && (status === "confirmed" || status === "cancelled")) await notifyCustomer(payload, status);

  revalidatePath("/admin", "layout");
  return { ok: true, message: "تم تحديث حالة الحجز." };
}

export async function rescheduleBooking(id: string, date: string, time: string, note = ""): Promise<ActionResult> {
  const auth = await authorize("staff");
  if (!auth.ok) return auth.result;
  const parsed = z
    .object({ id: uuid, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) })
    .safeParse({ id, date, time });
  if (!parsed.success) return { ok: false, error: "اختر تاريخاً ووقتاً صحيحين." };

  const { data, error } = await auth.supabase.rpc("admin_reschedule_booking", {
    p_booking_id: id,
    p_date: date,
    p_start: time,
    p_note: note.slice(0, 500),
  });
  if (error) return dbError(error, "reschedule");
  await notifyCustomer(data as unknown as BookingPayload, "rescheduled");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "تم تعديل الموعد." };
}

export async function updateBookingNotes(id: string, notes: string): Promise<ActionResult> {
  const auth = await authorize("staff");
  if (!auth.ok) return auth.result;
  if (!uuid.safeParse(id).success) return { ok: false, error: "طلب غير صالح." };
  const { error } = await auth.supabase.from("bookings").update({ admin_notes: notes.trim().slice(0, 2000) || null }).eq("id", id);
  if (error) return dbError(error, "booking-notes");
  revalidatePath(`/admin/bookings/${id}`);
  return { ok: true, message: SAVED };
}

/* ───────────────────────── customers ───────────────────────── */

export async function updateCustomer(id: string, input: { full_name: string; email: string; notes: string }): Promise<ActionResult> {
  const auth = await authorize("staff");
  if (!auth.ok) return auth.result;
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, "الاسم قصير جداً").max(80),
      email: z.union([z.email("بريد غير صحيح"), z.literal("")]),
      notes: z.string().max(2000),
    })
    .safeParse(input);
  if (!parsed.success || !uuid.safeParse(id).success) return parsed.success ? { ok: false, error: "طلب غير صالح." } : invalid(parsed.error);
  const { error } = await auth.supabase
    .from("customers")
    .update({ full_name: parsed.data.full_name, email: parsed.data.email || null, notes: parsed.data.notes.trim() || null })
    .eq("id", id);
  if (error) return dbError(error, "customer");
  revalidatePath(`/admin/customers/${id}`);
  return { ok: true, message: SAVED };
}

/* ───────────────────────── services & prices ───────────────────────── */

const serviceSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "الرابط المختصر بالإنجليزية الصغيرة والأرقام والشرطة فقط، مثل newborn-session")
    .max(60),
  name: z.string().trim().min(2, "اسم الخدمة قصير جداً").max(80),
  tagline: z.string().trim().max(160),
  description: z.string().trim().max(4000),
  features: z.array(z.string().trim().min(1).max(160)).max(12),
  price: z.union([z.number().min(0).max(1_000_000), z.null()]),
  price_note: z.string().trim().max(80),
  duration_minutes: z.number().int().min(15, "المدة 15 دقيقة على الأقل").max(600, "المدة 10 ساعات كحد أقصى"),
  image_url: optionalMediaUrl,
  color: z.enum(["coral", "sun", "plum", "lavender", "teal"]),
  icon: z.string().max(40),
  is_active: z.boolean(),
  is_bookable: z.boolean(),
  sort_order: z.number().int().min(-10000).max(10000),
});
export type ServiceInput = z.input<typeof serviceSchema>;

export async function saveService(id: string | null, input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const row = { ...parsed.data, tagline: parsed.data.tagline || null, description: parsed.data.description || null, price_note: parsed.data.price_note || null };

  if (id) {
    if (!uuid.safeParse(id).success) return { ok: false, error: "طلب غير صالح." };
    const { error } = await auth.supabase.from("services").update(row).eq("id", id);
    if (error) return dbError(error, "service-update");
    refreshPublic();
    return { ok: true, message: SAVED, data: { id } };
  }
  const { data, error } = await auth.supabase.from("services").insert(row).select("id").single();
  if (error) return dbError(error, "service-insert");
  refreshPublic();
  return { ok: true, message: "تمت إضافة الخدمة.", data: { id: data.id } };
}

export async function setServiceFlag(id: string, flag: "is_active" | "is_bookable", value: boolean): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  if (!uuid.safeParse(id).success || !["is_active", "is_bookable"].includes(flag)) return { ok: false, error: "طلب غير صالح." };
  const patch = flag === "is_active" ? { is_active: value } : { is_bookable: value };
  const { error } = await auth.supabase.from("services").update(patch).eq("id", id);
  if (error) return dbError(error, "service-flag");
  refreshPublic();
  return { ok: true, message: SAVED };
}

export async function deleteService(id: string): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  if (!uuid.safeParse(id).success) return { ok: false, error: "طلب غير صالح." };
  const { error } = await auth.supabase.from("services").delete().eq("id", id);
  if (error) return dbError(error, "service-delete");
  refreshPublic();
  return { ok: true, message: "تم حذف الخدمة. الحجوزات السابقة محفوظة باسم الخدمة." };
}

const priceRowSchema = z.object({
  id: uuid,
  price: z.union([z.number().min(0).max(1_000_000), z.null()]),
  price_note: z.string().trim().max(80),
  duration_minutes: z.number().int().min(15).max(600),
});

export async function savePrices(rows: z.input<typeof priceRowSchema>[]): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  const parsed = z.array(priceRowSchema).max(100).safeParse(rows);
  if (!parsed.success) return { ok: false, error: "تحقق من الأسعار والمدد: الأسعار أرقام موجبة، والمدة بين 15 و600 دقيقة." };
  for (const r of parsed.data) {
    const { error } = await auth.supabase
      .from("services")
      .update({ price: r.price, price_note: r.price_note || null, duration_minutes: r.duration_minutes })
      .eq("id", r.id);
    if (error) return dbError(error, "prices");
  }
  refreshPublic();
  return { ok: true, message: "تم تحديث الأسعار." };
}

/* ───────────────────────── gallery ───────────────────────── */

const categorySchema = z.enum(["newborn", "kids", "family", "birthday", "events"]);
const shapeSchema = z.enum(["square", "portrait", "tall", "landscape"]);

const newGallerySchema = z.object({
  image_url: mediaUrl,
  storage_path: z.string().regex(/^gallery\/[\w\-/.]+$/).max(500),
  category: categorySchema,
  shape: shapeSchema,
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  title: z.string().trim().max(120),
});

export async function addGalleryItems(items: z.input<typeof newGallerySchema>[]): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  const parsed = z.array(newGallerySchema).min(1).max(40).safeParse(items);
  if (!parsed.success) return { ok: false, error: "بيانات الصور غير صالحة." };
  const { error } = await auth.supabase
    .from("gallery_items")
    .insert(parsed.data.map((i) => ({ ...i, title: i.title || null, alt: i.title || null })));
  if (error) return dbError(error, "gallery-add");
  refreshPublic();
  return { ok: true, message: parsed.data.length === 1 ? "تمت إضافة الصورة." : `تمت إضافة ${parsed.data.length} صور.` };
}

const galleryPatchSchema = z
  .object({
    title: z.string().trim().max(120),
    alt: z.string().trim().max(200),
    category: categorySchema,
    shape: shapeSchema,
    is_featured: z.boolean(),
    is_published: z.boolean(),
    sort_order: z.number().int().min(-10000).max(10000),
  })
  .partial();

export async function updateGalleryItem(id: string, patch: z.input<typeof galleryPatchSchema>): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  const parsed = galleryPatchSchema.safeParse(patch);
  if (!parsed.success || !uuid.safeParse(id).success) return { ok: false, error: "بيانات غير صالحة." };
  const data = { ...parsed.data };
  if (data.title !== undefined) (data as Record<string, unknown>).title = data.title || null;
  if (data.alt !== undefined) (data as Record<string, unknown>).alt = data.alt || null;
  const { error } = await auth.supabase.from("gallery_items").update(data).eq("id", id);
  if (error) return dbError(error, "gallery-update");
  refreshPublic();
  return { ok: true, message: SAVED };
}

export async function deleteGalleryItem(id: string): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  if (!uuid.safeParse(id).success) return { ok: false, error: "طلب غير صالح." };
  const { data: item, error: readError } = await auth.supabase.from("gallery_items").select("storage_path").eq("id", id).single();
  if (readError) return dbError(readError, "gallery-read");
  const { error } = await auth.supabase.from("gallery_items").delete().eq("id", id);
  if (error) return dbError(error, "gallery-delete");
  if (item?.storage_path) {
    const { error: storageError } = await auth.supabase.storage.from("media").remove([item.storage_path]);
    if (storageError) console.error("[admin:gallery-storage]", storageError);
  }
  refreshPublic();
  return { ok: true, message: "تم حذف الصورة." };
}

/* ───────────────────────── testimonials ───────────────────────── */

const testimonialSchema = z.object({
  author_name: z.string().trim().min(2, "اكتب اسم صاحب الرأي").max(80),
  author_label: z.string().trim().max(80),
  content: z.string().trim().min(5, "نص الرأي قصير جداً").max(1000),
  rating: z.number().int().min(1).max(5),
  service_id: z.union([uuid, z.literal(""), z.null()]).transform((v) => v || null),
  is_published: z.boolean(),
  sort_order: z.number().int().min(-10000).max(10000),
});
export type TestimonialInput = z.input<typeof testimonialSchema>;

export async function saveTestimonial(id: string | null, input: TestimonialInput): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const row = { ...parsed.data, author_label: parsed.data.author_label || null };
  const { error } = id
    ? await auth.supabase.from("testimonials").update(row).eq("id", id)
    : await auth.supabase.from("testimonials").insert(row);
  if (error) return dbError(error, "testimonial");
  refreshPublic();
  revalidatePath("/admin/testimonials");
  return { ok: true, message: id ? SAVED : "تمت إضافة التقييم." };
}

export async function deleteTestimonial(id: string): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  if (!uuid.safeParse(id).success) return { ok: false, error: "طلب غير صالح." };
  const { error } = await auth.supabase.from("testimonials").delete().eq("id", id);
  if (error) return dbError(error, "testimonial-delete");
  refreshPublic();
  revalidatePath("/admin/testimonials");
  return { ok: true, message: "تم حذف التقييم." };
}

/* ───────────────────────── FAQ ───────────────────────── */

const faqSchema = z.object({
  question: z.string().trim().min(5, "السؤال قصير جداً").max(200),
  answer: z.string().trim().min(2, "اكتب الإجابة").max(2000),
  is_published: z.boolean(),
  sort_order: z.number().int().min(-10000).max(10000),
});
export type FaqInput = z.input<typeof faqSchema>;

export async function saveFaq(id: string | null, input: FaqInput): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = id
    ? await auth.supabase.from("faqs").update(parsed.data).eq("id", id)
    : await auth.supabase.from("faqs").insert(parsed.data);
  if (error) return dbError(error, "faq");
  refreshPublic();
  revalidatePath("/admin/faq");
  return { ok: true, message: id ? SAVED : "تمت إضافة السؤال." };
}

export async function deleteFaq(id: string): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  if (!uuid.safeParse(id).success) return { ok: false, error: "طلب غير صالح." };
  const { error } = await auth.supabase.from("faqs").delete().eq("id", id);
  if (error) return dbError(error, "faq-delete");
  refreshPublic();
  revalidatePath("/admin/faq");
  return { ok: true, message: "تم حذف السؤال." };
}

/* ───────────────────────── hours & booking settings ───────────────────────── */

const hourRowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    is_open: z.boolean(),
    open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  })
  .refine((r) => r.close_time.slice(0, 5) > r.open_time.slice(0, 5), { message: "وقت الإغلاق يجب أن يكون بعد وقت الفتح." });

export async function saveWorkingHours(rows: z.input<typeof hourRowSchema>[]): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  const parsed = z.array(hourRowSchema).length(7).safeParse(rows);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "تحقق من الأوقات." };
  const { error } = await auth.supabase.from("working_hours").upsert(parsed.data, { onConflict: "weekday" });
  if (error) return dbError(error, "hours");
  refreshPublic();
  return { ok: true, message: "تم حفظ ساعات العمل." };
}

export async function saveBookingSettings(input: unknown): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  // Strict parse (no silent fallbacks) so the admin sees what is wrong
  const strict = z.object({
    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "منطقة زمنية غير صحيحة، مثل Asia/Riyadh"),
    slot_interval_minutes: z.number().int().min(5, "الفاصل 5 دقائق على الأقل").max(240),
    booking_window_days: z.number().int().min(1).max(365, "فترة الحجز سنة كحد أقصى"),
    min_notice_hours: z.number().int().min(0).max(720),
    cancel_notice_hours: z.number().int().min(0).max(720),
    max_children: z.number().int().min(1).max(20),
    currency: z.string().trim().min(1, "اكتب العملة").max(12),
    send_customer_emails: z.boolean(),
  });
  const parsed = strict.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await auth.supabase.from("site_settings").upsert({ key: "booking", value: parsed.data, is_public: true });
  if (error) return dbError(error, "booking-settings");
  refreshPublic();
  return { ok: true, message: "تم حفظ إعدادات الحجز." };
}

export async function addBlockedDate(day: string, reason: string): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "اختر تاريخاً." };
  const { error } = await auth.supabase.from("blocked_dates").upsert({ day, reason: reason.trim().slice(0, 120) || null });
  if (error) return dbError(error, "blocked-add");
  refreshPublic();
  revalidatePath("/admin/hours");
  return { ok: true, message: "أُغلق هذا اليوم أمام الحجز." };
}

export async function removeBlockedDate(day: string): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "طلب غير صالح." };
  const { error } = await auth.supabase.from("blocked_dates").delete().eq("day", day);
  if (error) return dbError(error, "blocked-remove");
  refreshPublic();
  revalidatePath("/admin/hours");
  return { ok: true, message: "أُعيد فتح اليوم للحجز." };
}

/* ───────────────────────── contact & home content ───────────────────────── */

export async function saveContactSettings(input: unknown): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  const urlOrEmpty = z.union([z.url("رابط غير صحيح، يجب أن يبدأ بـ https://"), z.literal("")]);
  const strict = contactSettingsSchema.extend({
    email: z.union([z.email("بريد غير صحيح"), z.literal("")]),
    map_url: urlOrEmpty,
    phone: z.string().trim().max(30).regex(/^[+\d\s-]*$/, "رقم الهاتف بالأرقام فقط"),
    whatsapp: z.string().trim().max(30).regex(/^[+\d\s-]*$/, "رقم الواتساب بالأرقام فقط مع رمز الدولة"),
  });
  const parsed = strict.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await auth.supabase.from("site_settings").upsert({ key: "contact", value: parsed.data, is_public: true });
  if (error) return dbError(error, "contact");
  refreshPublic();
  return { ok: true, message: "تم حفظ بيانات التواصل." };
}

export async function saveHomeContent(input: unknown): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return auth.result;
  const strict = homeSettingsSchema.extend({
    hero_title: z.string().trim().min(3, "اكتب العنوان الرئيسي").max(120),
    hero_subtitle: z.string().trim().max(300),
    hero_images: z.array(mediaUrl).max(4),
    about_image: z.union([mediaUrl, z.literal("")]),
    values: z.array(z.object({ title: z.string().trim().min(1, "عنوان القيمة مطلوب").max(60), text: z.string().trim().max(240) })).max(6),
  });
  const parsed = strict.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await auth.supabase.from("site_settings").upsert({ key: "home", value: parsed.data, is_public: true });
  if (error) return dbError(error, "home");
  refreshPublic();
  return { ok: true, message: "تم تحديث محتوى الموقع." };
}

/* ───────────────────────── messages ───────────────────────── */

export async function setMessageRead(id: string, read: boolean): Promise<ActionResult> {
  const auth = await authorize("staff");
  if (!auth.ok) return auth.result;
  if (!uuid.safeParse(id).success) return { ok: false, error: "طلب غير صالح." };
  const { error } = await auth.supabase.from("contact_messages").update({ is_read: read }).eq("id", id);
  if (error) return dbError(error, "message");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  const auth = await authorize("staff");
  if (!auth.ok) return auth.result;
  if (!uuid.safeParse(id).success) return { ok: false, error: "طلب غير صالح." };
  const { error } = await auth.supabase.from("contact_messages").delete().eq("id", id);
  if (error) return dbError(error, "message-delete");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "تم حذف الرسالة." };
}
