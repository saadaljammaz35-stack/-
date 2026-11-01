import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicClient } from "@/lib/supabase/public";
import { getSiteData } from "@/lib/data/public";
import { CancelBooking } from "@/components/booking/CancelBooking";
import { ButtonLink } from "@/components/ui/Button";
import { STATUS_META } from "@/lib/constants";
import { formatDate, formatTime, whatsappHref } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { BookingPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إدارة الحجز", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  const supabase = getPublicClient();
  if (!supabase) notFound();

  const [{ data, error }, site] = await Promise.all([supabase.rpc("get_booking_by_token", { p_token: token }), getSiteData()]);
  if (error) throw new Error("تعذر تحميل الحجز");
  if (!data) notFound();
  const b = data as unknown as BookingPayload;
  const status = STATUS_META[b.status];

  return (
    <div className="container-x max-w-3xl pb-10 pt-10 md:pt-16">
      <p className="eyebrow mb-4">إدارة الحجز</p>
      <h1 className="text-4xl font-extrabold text-plum md:text-5xl">أهلاً {b.customer_name}</h1>
      <div className="mt-8 overflow-hidden rounded-[2rem] bg-paper shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5 md:px-8">
          <p className="font-display text-xl font-bold tracking-wider text-plum" dir="ltr">{b.reference}</p>
          <span className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold", status.className)}>
            <span className={cn("size-2 rounded-full", status.dot)} />
            {status.label}
          </span>
        </div>
        <dl className="grid gap-5 p-6 sm:grid-cols-2 md:p-8">
          <div><dt className="text-sm text-ink-soft">الجلسة</dt><dd className="mt-1 font-semibold">{b.service_name}</dd></div>
          <div><dt className="text-sm text-ink-soft">عدد الأطفال</dt><dd className="mt-1 font-semibold">{b.children_count}</dd></div>
          <div><dt className="text-sm text-ink-soft">التاريخ</dt><dd className="mt-1 font-semibold">{formatDate(b.booking_date)}</dd></div>
          <div><dt className="text-sm text-ink-soft">الوقت</dt><dd className="mt-1 font-semibold">{formatTime(b.start_time)} – {formatTime(b.end_time)}</dd></div>
          {b.notes && <div className="sm:col-span-2"><dt className="text-sm text-ink-soft">ملاحظاتك</dt><dd className="mt-1 whitespace-pre-line">{b.notes}</dd></div>}
        </dl>
        <div className="border-t border-line p-6 md:p-8">
          {b.status === "pending" && <p className="mb-5 leading-8 text-ink-soft">طلبك بانتظار التأكيد، وسيتواصل معك فريقنا قريباً.</p>}
          {b.status === "confirmed" && <p className="mb-5 leading-8 text-ink-soft">موعدك مؤكد. نراك قريباً!</p>}
          {b.status === "cancelled" && (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="leading-8 text-ink-soft">هذا الحجز ملغى.</p>
              <ButtonLink href="/booking">احجز موعداً جديداً</ButtonLink>
            </div>
          )}
          {b.status === "completed" && <p className="leading-8 text-ink-soft">سعدنا بزيارتكم. شكراً لأنكم اخترتم لَبِنة.</p>}
          {b.can_cancel ? (
            <CancelBooking token={token} />
          ) : (
            (b.status === "pending" || b.status === "confirmed") && (
              <p className="rounded-2xl bg-cream p-4 text-sm leading-7 text-ink-soft">
                الإلغاء الإلكتروني متاح حتى {b.cancel_notice_hours} ساعة قبل الموعد. لأي تعديل الآن تواصل معنا مباشرة
                {site.contact.whatsapp && (
                  <>
                    {" "}عبر{" "}
                    <a className="font-semibold text-teal-ink underline" href={whatsappHref(site.contact.whatsapp, `بخصوص الحجز ${b.reference}`)} target="_blank" rel="noopener noreferrer">واتساب</a>
                  </>
                )}
                .
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
