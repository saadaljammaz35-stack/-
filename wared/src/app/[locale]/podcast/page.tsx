import type { Metadata } from 'next';
import { EmptyState, EpisodeList, PageHeader, PlatformLinks, ProgramRow, SectionHeader } from '@/components/site/blocks';
import { CopyField } from '@/components/ui/CopyField';
import { getLatestEpisodes, getPrograms, getSiteSettings } from '@/lib/data/public';
import { absoluteUrl } from '@/lib/env';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { localePath } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: '/podcast', title: dict.podcast.title, description: dict.podcast.intro });
}

export default async function PodcastPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const [settings, programs, latest] = await Promise.all([getSiteSettings(), getPrograms(), getLatestEpisodes(5)]);
  const hasPlatforms = Object.values(settings.platforms).some(Boolean);

  return (
    <>
      <PageHeader eyebrow={dict.meta.siteName} title={dict.podcast.title} intro={dict.podcast.intro} />
      <div className="container-page space-y-24 md:space-y-32">
        <section aria-labelledby="subscribe-heading" className="grid gap-10 border-t border-line pt-8 md:grid-cols-2">
          <div>
            <h2 id="subscribe-heading" className="display text-[clamp(1.75rem,3.5vw,2.75rem)]">
              {dict.podcast.subscribe}
            </h2>
            {!hasPlatforms && <p className="mt-4 text-muted">{dict.podcast.noPlatforms}</p>}
          </div>
          <div className="space-y-8">
            <PlatformLinks settings={settings} dict={dict} />
            <div>
              <p className="mb-2 text-sm text-muted">{dict.podcast.rssHelp}</p>
              <CopyField value={absoluteUrl('/rss.xml')} />
            </div>
          </div>
        </section>

        <section aria-labelledby="latest-heading">
          <SectionHeader id="latest-heading" title={dict.home.latest} href={localePath(locale, '/episodes')} linkLabel={dict.home.viewAll} />
          {latest.length ? <EpisodeList episodes={latest} locale={locale} dict={dict} /> : <EmptyState title={dict.episodes.empty} />}
        </section>

        {programs.length > 0 && (
          <section aria-labelledby="programs-heading">
            <SectionHeader id="programs-heading" title={dict.programs.title} href={localePath(locale, '/programs')} linkLabel={dict.home.viewAll} />
            <div className="border-t border-line">
              {programs.map((program, i) => (
                <ProgramRow key={program.id} program={program} locale={locale} dict={dict} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
