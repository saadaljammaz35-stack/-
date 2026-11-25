import type { Metadata } from 'next';
import { EmptyState, PageHeader, ProgramRow } from '@/components/site/blocks';
import { getPrograms } from '@/lib/data/public';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/programs', title: dict.programs.title, description: dict.programs.intro });
}

export default async function ProgramsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const programs = await getPrograms();
  return (
    <>
      <PageHeader title={dict.programs.title} intro={dict.programs.intro} />
      <div className="container-page">
        {programs.length === 0 ? (
          <EmptyState title={dict.programs.empty} />
        ) : (
          <div className="border-t border-line">
            {programs.map((program, i) => (
              <ProgramRow key={program.id} program={program} locale={locale} dict={dict} index={i} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
