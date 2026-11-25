import type { Metadata } from 'next';
import { SponsorshipForm } from '@/components/forms/PublicForms';
import { PageHeader } from '@/components/site/blocks';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/sponsorship', title: dict.pages.sponsorship.title, description: dict.pages.sponsorship.lead });
}

export default async function SponsorshipPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const page = dict.pages.sponsorship;
  return (
    <>
      <PageHeader title={page.title} intro={page.lead} />
      <div className="container-page space-y-24">
        <div className="grid gap-10 border-t border-line pt-10 md:grid-cols-3">
          {page.principles.map((p, i) => (
            <section key={p.heading}>
              <span className="text-sm tabular-nums text-accent" dir="ltr" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h2 className="display mt-3 text-3xl">{p.heading}</h2>
              <p className="mt-3 text-lg leading-8 text-muted">{p.body}</p>
            </section>
          ))}
        </div>
        <div className="grid gap-20 md:grid-cols-[1fr_1.4fr]">
          <section aria-labelledby="formats-heading" className="border-t border-line pt-8">
            <h2 id="formats-heading" className="mb-6 text-lg font-bold">
              {page.formatsTitle}
            </h2>
            <ul className="space-y-3 text-2xl leading-snug">
              {page.formats.map((format) => (
                <li key={format}>{format}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="sponsor-form" className="border-t border-line pt-8">
            <h2 id="sponsor-form" className="display mb-10 text-[clamp(1.75rem,3.5vw,2.75rem)]">
              {page.formTitle}
            </h2>
            <SponsorshipForm />
          </section>
        </div>
      </div>
    </>
  );
}
