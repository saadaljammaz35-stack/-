import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpLeft, Check, ChevronLeft, Clock } from "lucide-react";
import { getGallery, getServiceBySlug, getServices, getSiteData } from "@/lib/data/public";
import { ServiceIcon } from "@/components/brand/ServiceIcon";
import { ServiceCard, PriceTag } from "@/components/site/ServiceCard";
import { GalleryGrid } from "@/components/site/GalleryGrid";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Motion";
import { COLOR_CLASSES } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { GalleryCategory } from "@/lib/types";

const GALLERY_FOR: Record<string, GalleryCategory> = {
  newborn: "newborn",
  kids: "kids",
  family: "family",
  birthday: "birthday",
  events: "events",
};

export async function generateStaticParams() {
  const services = await getServices();
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getServiceBySlug(slug);
  if (!s) return { title: "الخدمة غير موجودة" };
  return { title: s.name, description: s.tagline ?? s.description ?? undefined };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [service, services, site, gallery] = await Promise.all([getServiceBySlug(slug), getServices(), getSiteData(), getGallery()]);
  if (!service) notFound();

  const c = COLOR_CLASSES[service.color];
  const category = GALLERY_FOR[service.slug];
  const related = category ? gallery.filter((g) => g.category === category).slice(0, 8) : [];
  const others = services.filter((s) => s.id !== service.id).slice(0, 3);

  return (
    <>
      <div className="container-x pt-6 md:pt-10">
        <nav aria-label="مسار التصفح" className="mb-8 flex items-center gap-1.5 text-sm text-ink-soft">
          <Link href="/" className="hover:text-plum">الرئيسية</Link>
          <ChevronLeft className="size-4" aria-hidden />
          <Link href="/services" className="hover:text-plum">خدماتنا</Link>
          <ChevronLeft className="size-4" aria-hidden />
          <span aria-current="page" className="text-plum">{service.name}</span>
        </nav>

        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
          <Reveal className="lg:col-span-6">
            <div className={cn("relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift sm:aspect-[5/4] lg:aspect-[4/5]", c.bg)}>
              {service.image_url ? (
                <Image src={service.image_url} alt={service.name} fill preload sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
              ) : (
                <>
                  <span className="absolute -bottom-10 -left-10 size-48 rounded-[2.5rem] bg-paper/15" aria-hidden />
                  <span className="absolute right-10 top-10 size-20 rounded-2xl bg-paper/15" aria-hidden />
                  <ServiceIcon name={service.icon} strokeWidth={1} className={cn("absolute right-1/2 top-1/2 size-36 -translate-y-1/2 translate-x-1/2 md:size-48", c.onBg)} />
                </>
              )}
            </div>
          </Reveal>
          <Reveal className="lg:col-span-6 lg:pt-6" delay={0.1}>
            <p className="eyebrow mb-4">خدماتنا</p>
            <h1 className="text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.12] text-plum">{service.name}</h1>
            {service.tagline && <p className="mt-4 text-xl leading-9 text-ink">{service.tagline}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 rounded-2xl bg-paper px-4 py-2.5 text-ink-soft shadow-soft">
                <Clock className="size-4" aria-hidden /> {formatDuration(service.duration_minutes)}
              </span>
              <span className="rounded-2xl bg-paper px-4 py-2.5 shadow-soft">
                <PriceTag service={service} currency={site.booking.currency} />
              </span>
            </div>
            {service.description && <p className="mt-8 text-lg leading-9 text-ink-soft">{service.description}</p>}
            {service.features.length > 0 && (
              <div className="mt-8 rounded-[1.75rem] bg-paper p-6 shadow-soft md:p-8">
                <h2 className="mb-4 font-display text-xl font-semibold text-plum">ما تتضمنه الجلسة</h2>
                <ul className="space-y-3">
                  {service.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 leading-7">
                      <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg", c.bg, c.onBg)}>
                        <Check className="size-4" aria-hidden />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {service.is_bookable ? (
                <ButtonLink href={`/booking?service=${service.slug}`} size="lg" icon={<ArrowUpLeft className="size-5" aria-hidden />}>
                  احجز هذه الجلسة
                </ButtonLink>
              ) : (
                <ButtonLink href="/contact" size="lg" variant="sun">استفسر عن الجلسة</ButtonLink>
              )}
              <ButtonLink href="/contact" size="lg" variant="outline">لديك سؤال؟</ButtonLink>
            </div>
          </Reveal>
        </div>
      </div>

      {related.length > 0 && (
        <section className="container-x py-16 md:py-28">
          <h2 className="mb-8 text-3xl font-bold text-plum md:text-4xl">من جلساتنا</h2>
          <GalleryGrid items={related} filters={false} />
        </section>
      )}

      {others.length > 0 && (
        <section className="container-x py-20 md:py-24">
          <h2 className="mb-8 text-3xl font-bold text-plum md:text-4xl">جلسات أخرى قد تعجبكم</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((s) => (
              <ServiceCard key={s.id} service={s} currency={site.booking.currency} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
