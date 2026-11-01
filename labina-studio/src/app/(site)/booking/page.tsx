import type { Metadata } from "next";
import { getServices, getSiteData } from "@/lib/data/public";
import { PageHeader } from "@/components/site/PageHeader";
import { BookingForm } from "@/components/booking/BookingForm";
import { HoursList } from "@/components/site/HoursList";

export const metadata: Metadata = {
  title: "احجز جلستك",
  description: "احجز جلسة تصوير في استوديو لَبِنة: اختر الجلسة واليوم والوقت المتاح مباشرة.",
};

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ service?: string | string[] }> }) {
  const [{ service }, site, services] = await Promise.all([searchParams, getSiteData(), getServices()]);
  const initial = typeof service === "string" ? service : undefined;

  return (
    <>
      <PageHeader eyebrow="الحجز" title="احجز جلستك" text="ثلاث خطوات: الجلسة، ثم الموعد، ثم بياناتك. يصلك رقم الحجز فوراً، ونتواصل معك لتأكيده." />
      <div className="container-x grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <BookingForm
            services={services}
            settings={site.booking}
            hours={site.hours}
            blockedDates={site.blockedDates}
            connected={site.connected}
            contact={site.contact}
            initialServiceSlug={initial}
          />
        </div>
        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-[1.75rem] bg-plum p-6 text-cream md:p-7">
            <h2 className="mb-3 font-display text-lg font-semibold text-sun">ساعات العمل</h2>
            <HoursList hours={site.hours} light />
          </div>
          <div className="rounded-[1.75rem] bg-paper p-6 shadow-soft md:p-7">
            <h2 className="font-display text-lg font-semibold text-plum">قبل الحجز</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-ink-soft">
              <li className="flex gap-2.5"><span className="mt-2 size-2 shrink-0 rounded-[0.2rem] bg-coral" />تظهر لك الأوقات المتاحة فقط، فلا يمكن أن يتعارض موعدك مع حجز آخر.</li>
              <li className="flex gap-2.5"><span className="mt-2 size-2 shrink-0 rounded-[0.2rem] bg-sun" />يبقى الحجز بحالة «جديد» حتى يؤكده فريقنا معك.</li>
              <li className="flex gap-2.5"><span className="mt-2 size-2 shrink-0 rounded-[0.2rem] bg-teal" />يصلك رابط خاص لمتابعة الحجز أو إلغائه قبل الموعد بـ {site.booking.cancel_notice_hours} ساعة على الأقل.</li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
