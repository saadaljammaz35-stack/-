import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpLeft, Check, Clock } from "lucide-react";
import { getServices, getSiteData } from "@/lib/data/public";
import { PageHeader } from "@/components/site/PageHeader";
import { PriceTag } from "@/components/site/ServiceCard";
import { ServiceIcon } from "@/components/brand/ServiceIcon";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Motion";
import { COLOR_CLASSES } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "خدماتنا",
  description: "جلسات تصوير المواليد والأطفال والعائلات وأعياد الميلاد والمناسبات، وتصوير منتجات الأطفال، وتصميم الألبومات، وتجارب إبداعية للصغار.",
};

export default async function ServicesPage() {
  const [services, site] = await Promise.all([getServices(), getSiteData()]);

  return (
    <>
      <PageHeader
        eyebrow="خدماتنا"
        title="جلسات مصممة حول الطفل"
        text="اختاروا الجلسة التي تناسب مرحلتكم. كل جلسة تُحضَّر بعناية لتكون مريحة للطفل وممتعة لكم."
      />
      <div className="container-x space-y-6 md:space-y-10">
        {services.length === 0 && <p className="rounded-3xl bg-paper p-8 text-center text-ink-soft">لا توجد خدمات معروضة حالياً.</p>}
        {services.map((s, i) => {
          const c = COLOR_CLASSES[s.color];
          return (
            <Reveal key={s.id}>
              <article id={s.slug} className="grid scroll-mt-28 overflow-hidden rounded-[2rem] bg-paper shadow-soft md:grid-cols-12">
                <div className={cn("relative min-h-56 md:col-span-5 md:min-h-[26rem]", c.bg, i % 2 === 1 && "md:order-2")}>
                  {s.image_url ? (
                    <Image src={s.image_url} alt={s.name} fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
                  ) : (
                    <>
                      <span className="absolute bottom-6 left-6 size-24 rounded-[1.5rem] bg-paper/15" aria-hidden />
                      <span className="absolute right-8 top-8 size-12 rounded-xl bg-paper/15" aria-hidden />
                      <ServiceIcon name={s.icon} strokeWidth={1.1} className={cn("absolute right-1/2 top-1/2 size-24 -translate-y-1/2 translate-x-1/2 md:size-32", c.onBg)} />
                    </>
                  )}
                </div>
                <div className="flex flex-col p-6 md:col-span-7 md:p-12">
                  <span className="font-display text-sm font-semibold text-coral-ink">0{i + 1}</span>
                  <h2 className="mt-2 text-3xl font-bold text-plum md:text-4xl">
                    <Link href={`/services/${s.slug}`} className="hover:underline hover:decoration-sun hover:decoration-4 hover:underline-offset-8">
                      {s.name}
                    </Link>
                  </h2>
                  {s.tagline && <p className="mt-3 text-lg text-ink">{s.tagline}</p>}
                  {s.description && <p className="mt-4 leading-8 text-ink-soft">{s.description}</p>}
                  {s.features.length > 0 && (
                    <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                      {s.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm leading-6">
                          <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md", c.bg, c.onBg)}>
                            <Check className="size-3.5" aria-hidden />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6">
                    <span className="inline-flex items-center gap-1.5 text-ink-soft">
                      <Clock className="size-4" aria-hidden />
                      {formatDuration(s.duration_minutes)}
                    </span>
                    <PriceTag service={s} currency={site.booking.currency} className="text-lg" />
                    <div className="flex w-full gap-2 sm:ms-auto sm:w-auto">
                      <ButtonLink href={`/services/${s.slug}`} variant="outline" className="flex-1 sm:flex-none">التفاصيل</ButtonLink>
                      {s.is_bookable ? (
                        <ButtonLink href={`/booking?service=${s.slug}`} className="flex-1 sm:flex-none" icon={<ArrowUpLeft className="size-4" aria-hidden />}>
                          احجز
                        </ButtonLink>
                      ) : (
                        <ButtonLink href="/contact" variant="sun" className="flex-1 sm:flex-none">استفسر</ButtonLink>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
