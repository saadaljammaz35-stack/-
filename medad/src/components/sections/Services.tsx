import { SectionHead } from '@/components/ui/SectionHead';
import type { Dictionary } from '@/content/types';
import type { Locale } from '@/lib/i18n';
import { ServiceCard } from './ServiceCard';

export function Services({ t, locale }: { t: Dictionary['services']; locale: Locale }) {
  return (
    <section id="services" aria-labelledby="services-title" className="relative overflow-x-clip py-24 sm:py-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 h-[36rem] w-[36rem] rounded-full bg-electric/[0.08] blur-[150px] ltr:-right-48 rtl:-left-48"
      />
      <div className="container-medad relative">
        <SectionHead
          id="services-title"
          index={t.index}
          label={t.label}
          labelEn={t.labelEn}
          heading={t.heading}
          intro={t.intro}
          align="split"
        />
        <div className="mt-16 grid gap-5 sm:mt-24 md:grid-cols-2">
          {t.items.map((service, i) => (
            <ServiceCard key={service.slug} service={service} index={i} locale={locale} more={t.more} />
          ))}
        </div>
      </div>
    </section>
  );
}
