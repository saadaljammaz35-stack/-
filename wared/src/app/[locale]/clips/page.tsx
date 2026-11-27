import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/site/blocks';
import { ClipCard } from '@/components/site/ClipCard';
import { getClips } from '@/lib/data/public';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/clips', title: dict.clips.title, description: dict.clips.intro });
}

export default async function ClipsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const clips = await getClips(60);
  const vertical = clips.filter((c) => c.orientation === 'vertical');
  const horizontal = clips.filter((c) => c.orientation === 'horizontal');
  return (
    <>
      <PageHeader title={dict.clips.title} intro={dict.clips.intro} />
      <div className="container-page space-y-20">
        {clips.length === 0 && <EmptyState title={dict.clips.empty} />}
        {vertical.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {vertical.map((clip) => (
              <li key={clip.id}>
                <ClipCard clip={clip} />
              </li>
            ))}
          </ul>
        )}
        {horizontal.length > 0 && (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2">
            {horizontal.map((clip) => (
              <li key={clip.id}>
                <ClipCard clip={clip} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
