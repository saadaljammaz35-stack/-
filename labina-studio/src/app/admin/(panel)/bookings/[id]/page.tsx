import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Mail, MessageCircle, Phone } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { AdminPage, Card, StatusBadge } from "@/components/admin/ui";
import { BookingActions } from "@/components/admin/BookingActions";
import { STATUS_META } from "@/lib/constants";
import { formatDate, formatDateTime, formatPrice, formatTime, phoneHref, whatsappHref } from "@/lib/format";
import { parseBooking } from "@/lib/settings";
import type { BookingStatus } from "@/lib/types";

export const metadata: Metadata = { title: "تفاصيل الحجز" };

const EVENT_LABEL: Record<string, string> = {
  created: "أُنشئ الحجز",
  status_changed: "تغيّرت الحالة",
  rescheduled: "تعدّل الموعد",
  note: "ملاحظة",
  cancelled_by_customer: "ألغى العميل الحجز",
};

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = (await getServerClient())!;
  const [{ data: b }, { data: events }, { data: settingsRow }] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", id).maybeSingle(),
    supabase.from("booking_events").select("*").eq("booking_id", id).order("created_at", { ascending: false }),
    supabase.from("site_settings").select("value").eq("key", "booking").maybeSingle(),
  ]);
  if (!b) notFound();
  const settings = parseBooking(settingsRow?.value);
  const status = b.status as BookingStatus;

  return (
    <AdminPage
      title={`حجز ${b.reference}`}
      description={<Link href="/admin/bookings" className="inline-flex items-center gap-1 text-coral-ink"><ChevronRight className="size-4" /> كل الحجوزات</Link>}
      actions={<StatusBadge status={status} />}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="تفاصيل الجلسة">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div><dt className="text-sm text-ink-soft">الجلسة</dt><dd className="mt-1 font-semibold">{b.service_name}</dd></div>
              <div><dt className="text-sm text-ink-soft">السعر وقت الحجز</dt><dd className="mt-1 font-semibold">{formatPrice(b.price_snapshot === null ? null : Number(b.price_snapshot), settings.currency) ?? "غير محدد"}</dd></div>
              <div><dt className="text-sm text-ink-soft">التاريخ</dt><dd className="mt-1 font-semibold">{formatDate(b.booking_date)}</dd></div>
              <div><dt className="text-sm text-ink-soft">الوقت</dt><dd className="mt-1 font-semibold">{formatTime(b.start_time)} – {formatTime(b.end_time)}</dd></div>
              <div><dt className="text-sm text-ink-soft">عدد الأطفال</dt><dd className="mt-1 font-semibold">{b.children_count}</dd></div>
              <div><dt className="text-sm text-ink-soft">تاريخ الطلب</dt><dd className="mt-1 font-semibold">{formatDateTime(b.created_at, settings.timezone)}</dd></div>
              {b.notes && <div className="sm:col-span-2"><dt className="text-sm text-ink-soft">ملاحظات العميل</dt><dd className="mt-1 whitespace-pre-line rounded-2xl bg-cream p-4">{b.notes}</dd></div>}
              {b.cancelled_reason && <div className="sm:col-span-2"><dt className="text-sm text-ink-soft">سبب الإلغاء</dt><dd className="mt-1 whitespace-pre-line rounded-2xl bg-coral-soft/50 p-4">{b.cancelled_reason}</dd></div>}
            </dl>
          </Card>

          <BookingActions id={b.id} status={status} date={b.booking_date} time={b.start_time.slice(0, 5)} adminNotes={b.admin_notes ?? ""} />

          <Card title="سجل الحجز">
            <ol className="relative space-y-5 border-r-2 border-line pr-5">
              {(events ?? []).map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -right-[1.65rem] top-1.5 size-3 rounded-[0.2rem] bg-coral ring-4 ring-paper" />
                  <p className="font-semibold text-ink">
                    {EVENT_LABEL[e.event] ?? e.event}
                    {e.to_status && e.event !== "created" && (
                      <span className="font-normal text-ink-soft">
                        {" "}: {e.from_status ? STATUS_META[e.from_status as BookingStatus]?.label : ""} ← {STATUS_META[e.to_status as BookingStatus]?.label}
                      </span>
                    )}
                  </p>
                  {e.note && <p className="mt-1 text-sm text-ink-soft" dir="auto">{e.note}</p>}
                  <p className="mt-1 text-xs text-ink-soft">{formatDateTime(e.created_at, settings.timezone)} · {e.actor_label === "customer" ? "العميل" : e.actor_label}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="العميل">
            <p className="text-lg font-semibold text-plum">{b.customer_name}</p>
            <div className="mt-4 space-y-2">
              <a href={`tel:${phoneHref(b.customer_phone)}`} className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 font-medium hover:bg-cream-2">
                <Phone className="size-4 text-plum" /> <span dir="ltr">{b.customer_phone}</span>
              </a>
              <a href={whatsappHref(b.customer_phone, `مرحباً ${b.customer_name}، بخصوص حجزك ${b.reference} في لَبِنة`)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 font-medium hover:bg-cream-2">
                <MessageCircle className="size-4 text-teal-ink" /> واتساب
              </a>
              {b.customer_email && (
                <a href={`mailto:${b.customer_email}`} className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 font-medium hover:bg-cream-2">
                  <Mail className="size-4 text-coral-ink" /> <span className="truncate" dir="ltr">{b.customer_email}</span>
                </a>
              )}
            </div>
            <Link href={`/admin/customers/${b.customer_id}`} className="mt-4 inline-block text-sm font-semibold text-coral-ink">ملف العميل وحجوزاته السابقة</Link>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
