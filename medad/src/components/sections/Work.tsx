import { SectionHead } from '@/components/ui/SectionHead';
import { BrandGrid } from '@/components/work/BrandGrid';
import { WorkGallery } from '@/components/work/WorkGallery';
import type { Dictionary } from '@/content/types';
import type { Locale } from '@/lib/i18n';

export function Work({ t, locale }: { t: Dictionary['work']; locale: Locale }) {
  return (
    <section id="work" aria-labelledby="work-title" className="relative overflow-x-clip py-24 sm:py-36">
      <div className="container-medad">
        <SectionHead
          id="work-title"
          index={t.index}
          label={t.label}
          labelEn={t.labelEn}
          heading={t.heading}
          intro={t.intro}
          align="split"
        />
        <div className="mt-14 sm:mt-20">
          <WorkGallery t={t} locale={locale} />
        </div>
        <BrandGrid t={t.brands} />
      </div>
    </section>
  );
}
