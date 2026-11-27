import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Cover, EmptyState, EpisodeList, FallbackNote, PlatformLinks, SectionHeader } from '@/components/site/blocks';
import { CopyField } from '@/components/ui/CopyField';
import { RichText } from '@/components/ui/RichText';
import { getEpisodes, getProgramBySlug, getSiteSettings } from '@/lib/data/public';
import { absoluteUrl } from '@/lib/env';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { isFallback, localePath, pick } from '@/lib/i18n/config';
import { jsonLdString, pageMetadata, programJsonLd } from '@/lib/seo';

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const program = await getProgramBySlug(slug);
  if (!program) return pageMetadata({ locale, path: `/programs/${slug}`, noIndex: true });
  return pageMetadata({
    locale,
    path: `/programs/${slug}`,
    title: pick(locale, program.title, program.titleEn),
    description: pick(locale, program.tagline, program.taglineEn) ?? undefined,
    image: program.cover?.url,
  });
}

export default async function ProgramPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const dict = getDictionary(locale);
  const program = await getProgramBySlug(slug);
  if (!program) notFound();
  const [episodes, settings] = await Promise.all([getEpisodes({ programSlug: slug, pageSize: 24 }), getSiteSettings()]);
  const description = pick(locale, program.description, program.descriptionEn);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(programJsonLd(program, locale)) }} />
      <header className="container-page grid grid-cols-1 gap-10 pb-16 pt-12 md:grid-cols-[1.4fr_1fr] md:gap-16 md:pt-20">
        <div className="flex flex-col justify-end">
          <p className="eyebrow mb-5">{dict.programs.kinds[program.kind]}</p>
          <FallbackNote show={isFallback(locale, program.titleEn)} dict={dict} />
          <h1 className="display text-[clamp(2.75rem,8vw,6.5rem)]">{pick(locale, program.title, program.titleEn)}</h1>
          {program.tagline && <p className="mt-6 max-w-2xl text-xl leading-9 text-muted">{pick(locale, program.tagline, program.taglineEn)}</p>}
          {program.hosts && (
            <p className="mt-4 text-sm text-muted">
              {dict.common.hostsLabel}: {program.hosts}
            </p>
          )}
        </div>
        <Cover media={program.cover} alt="" priority sizes="(min-width: 768px) 35vw, 100vw" className="aspect-square rounded-[28px]" />
      </header>
      <div className="container-page space-y-20">
        {description && <RichText text={description} />}
        <div className="space-y-6">
          <PlatformLinks
            settings={settings}
            dict={dict}
            extra={{ spotify: program.spotifyUrl, apple_podcasts: program.appleUrl, youtube: program.youtubeUrl, anghami: program.anghamiUrl }}
          />
          <div className="max-w-xl">
            <CopyField value={absoluteUrl(`/rss/${program.slug}`)} />
          </div>
        </div>
        <section aria-labelledby="program-episodes">
          <SectionHeader id="program-episodes" title={dict.programs.episodesIn} />
          {episodes.items.length === 0 ? (
            <EmptyState title={dict.episodes.empty} />
          ) : (
            <>
              <EpisodeList episodes={episodes.items} locale={locale} dict={dict} showProgram={false} />
              {episodes.total > episodes.items.length && (
                <Link href={`${localePath(locale, '/episodes')}?program=${slug}`} className="btn btn-ghost mt-10">
                  {dict.home.viewAll}
                </Link>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
