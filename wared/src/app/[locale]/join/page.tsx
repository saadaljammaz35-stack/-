import type { Metadata } from 'next';
import { CareersForm } from '@/components/forms/PublicForms';
import { PageHeader } from '@/components/site/blocks';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/join', title: dict.pages.join.title, description: dict.pages.join.lead });
}

export default async function JoinPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const page = dict.pages.join;
  return (
    <>
      <PageHeader title={page.title} intro={page.lead} />
      <div className="container-page grid gap-20 md:grid-cols-[1fr_1.4fr]">
        <section aria-labelledby="areas-heading" className="border-t border-line pt-8">
          <h2 id="areas-heading" className="mb-6 text-lg font-bold">
            {page.areasTitle}
          </h2>
          <ul className="space-y-3 text-2xl leading-snug">
            {page.areas.map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
          <p className="mt-10 text-muted">{page.note}</p>
        </section>
        <section aria-labelledby="form-heading" className="border-t border-line pt-8">
          <h2 id="form-heading" className="display mb-10 text-[clamp(1.75rem,3.5vw,2.75rem)]">
            {page.formTitle}
          </h2>
          <CareersForm />
        </section>
      </div>
    </>
  );
}
