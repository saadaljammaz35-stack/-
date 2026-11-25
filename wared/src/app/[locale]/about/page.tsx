import Image from 'next/image';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/site/blocks';
import { Reveal } from '@/components/ui/Reveal';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import studio from '../../../../public/images/studio.jpg';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/about', title: dict.pages.about.title, description: dict.pages.about.lead });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const about = dict.pages.about;
  return (
    <>
      <PageHeader eyebrow={dict.meta.tagline} title={about.title} intro={about.lead} />
      <Reveal className="container-page">
        <Image src={studio} alt={dict.home.studioAlt} placeholder="blur" sizes="(min-width: 1312px) 1232px, 100vw" className="aspect-[4/5] w-full rounded-[28px] object-cover sm:aspect-[16/9] md:rounded-[36px]" />
      </Reveal>
      <div className="container-page mt-20 space-y-16 md:mt-28">
        {about.sections.map((section, i) => (
          <Reveal key={section.heading} className="grid gap-6 border-t border-line pt-8 md:grid-cols-[1fr_2fr] md:gap-16">
            <div className="flex items-baseline gap-4">
              <span className="text-sm tabular-nums text-accent" dir="ltr" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h2 className="display text-[clamp(1.75rem,3.5vw,2.75rem)]">{section.heading}</h2>
            </div>
            <p className="max-w-2xl text-xl leading-10 text-muted">{section.body}</p>
          </Reveal>
        ))}
      </div>
    </>
  );
}
