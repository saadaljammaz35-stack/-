import Image from "next/image";
import Link from "next/link";
import { ArrowUpLeft, Clock } from "lucide-react";
import { ServiceIcon } from "@/components/brand/ServiceIcon";
import { buttonClass } from "@/components/ui/Button";
import { COLOR_CLASSES } from "@/lib/constants";
import { formatDuration, formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Service } from "@/lib/types";

export function PriceTag({ service, currency, className }: { service: Service; currency: string; className?: string }) {
  const price = formatPrice(service.price, currency);
  return (
    <span className={cn("font-semibold text-plum", className)}>
      {price ? (
        <>
          {service.price_note && <span className="me-1 text-sm font-normal text-ink-soft">{service.price_note}</span>}
          {price}
        </>
      ) : (
        <span className="text-sm font-medium text-ink-soft">السعر عند الاستفسار</span>
      )}
    </span>
  );
}

function Visual({ service, featured }: { service: Service; featured?: boolean }) {
  const c = COLOR_CLASSES[service.color];
  return (
    <div className={cn("relative overflow-hidden rounded-[1.4rem]", c.bg, featured ? "aspect-[4/3] lg:aspect-auto lg:min-h-[22rem] lg:flex-1" : "aspect-[4/3]")}>
      {service.image_url ? (
        <Image
          src={service.image_url}
          alt={service.name}
          fill
          sizes={featured ? "(min-width: 1024px) 45vw, 92vw" : "(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 92vw"}
          className="object-cover transition-transform duration-700 ease-[var(--ease-soft)] group-hover:scale-105"
        />
      ) : (
        <>
          <div className="absolute -bottom-6 -left-6 size-28 rounded-[1.6rem] bg-paper/15" />
          <div className="absolute -top-8 right-10 size-20 rounded-[1.2rem] bg-paper/10" />
          <ServiceIcon
            name={service.icon}
            strokeWidth={1.2}
            className={cn("absolute right-1/2 top-1/2 size-16 -translate-y-1/2 translate-x-1/2 transition-transform duration-700 ease-[var(--ease-soft)] group-hover:scale-110 group-hover:-rotate-6", featured && "lg:size-28", c.onBg)}
          />
        </>
      )}
    </div>
  );
}

export function ServiceCard({ service, currency, featured = false }: { service: Service; currency: string; featured?: boolean }) {
  return (
    <article className={cn("group relative flex h-full flex-col rounded-[1.75rem] bg-paper p-3 shadow-soft transition-shadow duration-500 hover:shadow-lift", featured && "lg:p-4")}>
      <Visual service={service} featured={featured} />
      <div className={cn("flex flex-col px-2 pb-2 pt-5", !featured && "flex-1")}>
        <h3 className={cn("font-display font-semibold leading-snug text-plum", featured ? "text-2xl lg:text-3xl" : "text-xl")}>
          <Link href={`/services/${service.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {service.name}
          </Link>
        </h3>
        {service.tagline && <p className={cn("mt-2 leading-7 text-ink-soft", featured && "lg:text-lg")}>{service.tagline}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-sm">
          <span className="inline-flex items-center gap-1.5 text-ink-soft">
            <Clock className="size-4" aria-hidden />
            {formatDuration(service.duration_minutes)}
          </span>
          <PriceTag service={service} currency={currency} />
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
          <Link href={`/services/${service.slug}`} className={buttonClass("outline", "sm", "h-10")}>
            التفاصيل
          </Link>
          {service.is_bookable ? (
            <Link href={`/booking?service=${service.slug}`} className={buttonClass("primary", "sm", "h-10")}>
              احجز
              <ArrowUpLeft className="size-4" aria-hidden />
            </Link>
          ) : (
            <Link href="/contact" className={buttonClass("sun", "sm", "h-10")}>
              استفسر
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
