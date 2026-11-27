import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { EpisodePlayer } from '@/components/player/EpisodePlayer';
import { ArticleRow, Cover, EpisodeList, GuestTile, PlatformLinks, ProgramRow, SectionHeader } from '@/components/site/blocks';
import { ClipCard } from '@/components/site/ClipCard';
import { NewsletterForm } from '@/components/forms/PublicForms';
import { Reveal, WordReveal } from '@/components/ui/Reveal';
import { getArticles, getClips, getFeaturedEpisodes, getGuests, getLatestEpisodes, getPrograms, getSiteSettings } from '@/lib/data/public';
import { formatDate, formatDuration } from '@/lib/format';
import { getDictionary, isLocale, t, type Locale } from '@/lib/i18n';
import { isFallback, localePath, pick } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import { toTrack } from '@/lib/track';
import studio from '../../../public/images/studio.jpg';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ locale: (isLocale(locale) ? locale : 'ar') as Locale, path: '/' });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : 'ar') as Locale;
  const dict = getDictionary(locale);
  const p = (path: string) => localePath(locale, path);

  const [latest, featured, articles, clips, programs, guests, settings] = await Promise.all([
    getLatestEpisodes(1),
    getFeaturedEpisodes(4),
    getArticles({ pageSize: 4 }),
    getClips(6),
    getPrograms(),
    getGuests(8),
    getSiteSettings(),
  ]);
  const latestEpisode = latest[0];
  const latestTrack = latestEpisode ? toTrack(latestEpisode, locale) : null;
  const featuredList = featured.filter((e) => e.id !== latestEpisode?.id);
  const [leadArticle, ...moreArticles] = articles.items;
  let section = 0;
  const nextIndex = () => String(++section).padStart(2, '0');

  return (
    <>
      {/* Hero */}
      <section className="container-page pb-14 pt-16 md:pb-24 md:pt-28" aria-labelledby="hero-title">
        <h1 id="hero-title" className="display text-[clamp(3.5rem,13vw,10.5rem)]">
          <WordReveal text={dict.home.heroLine} />
        </h1>
        <Reveal delay={0.6} className="mt-8 grid gap-8 md:mt-12 md:grid-cols-[1.2fr_1fr] md:items-end">
          <p className="max-w-xl text-lg leading-8 text-muted md:text-xl md:leading-9">{dict.home.heroIntro}</p>
          <div className="flex flex-wrap gap-3 md:justify-end">
            {latestEpisode && (
              <Link href={p(`/episodes/${latestEpisode.slug}`)} className="btn btn-primary">
                {dict.home.heroCtaListen}
              </Link>
            )}
            <a href="#newsletter" className="btn btn-ghost">
              {dict.home.heroCtaSubscribe}
            </a>
          </div>
        </Reveal>
      </section>

      {/* Cinematic studio */}
      <Reveal className="container-page">
        <div className="relative overflow-hidden rounded-[28px] md:rounded-[36px]">
          <Image
            src={studio}
            alt={dict.home.studioAlt}
            priority
            placeholder="blur"
            sizes="(min-width: 1312px) 1232px, 100vw"
            className="aspect-[4/5] w-full object-cover object-[50%_60%] sm:aspect-[16/9] md:aspect-[21/9]"
          />
        </div>
      </Reveal>

      {/* Latest episode, or the launch note while nothing is published */}
      <section className="container-page mt-24 md:mt-36" aria-labelledby="latest-title">
        <SectionHeader index={nextIndex()} id="latest-title" title={dict.home.latest} href={latestEpisode ? p('/episodes') : undefined} linkLabel={dict.home.viewAll} />
        {latestEpisode && latestTrack ? (
          <Reveal className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.15fr] md:gap-16">
            <Cover media={latestEpisode.cover ?? latestEpisode.program.cover} alt="" sizes="(min-width: 768px) 45vw, 100vw" className="aspect-square rounded-[24px]" />
            <div className="flex flex-col justify-between gap-10">
              <div>
                <p className="mb-4 text-sm text-accent">
                  {pick(locale, latestEpisode.program.title, latestEpisode.program.titleEn)}
                  {latestEpisode.number ? ` · ${t(dict.common.episodeNumber, { n: latestEpisode.number })}` : ''}
                </p>
                <h3 className="display text-[clamp(2.25rem,5vw,4.25rem)]" lang={isFallback(locale, latestEpisode.titleEn) ? 'ar' : undefined}>
                  <Link href={p(`/episodes/${latestEpisode.slug}`)} className="hover:text-accent">
                    {pick(locale, latestEpisode.title, latestEpisode.titleEn)}
                  </Link>
                </h3>
                {latestEpisode.summary && <p className="mt-5 max-w-xl text-lg leading-8 text-muted">{pick(locale, latestEpisode.summary, latestEpisode.summaryEn)}</p>}
                <p className="mt-4 text-sm text-muted">
                  {[formatDate(latestEpisode.publishedAt, locale), formatDuration(latestEpisode.durationSeconds, locale)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <EpisodePlayer track={latestTrack} />
            </div>
          </Reveal>
        ) : (
          <Reveal className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-20">
            <div className="space-y-2">
              {dict.home.teaser.map((line) => (
                <p key={line} className="display text-[clamp(1.75rem,4vw,3rem)] text-muted">
                  {line}
                </p>
              ))}
            </div>
            <div>
              <p className="display text-[clamp(1.75rem,3.5vw,2.75rem)]">{dict.home.launchTitle}</p>
              <p className="mt-4 text-lg leading-8 text-muted">{dict.home.launchBody}</p>
            </div>
          </Reveal>
        )}
      </section>

      {featuredList.length > 0 && (
        <section className="container-page mt-24 md:mt-36" aria-labelledby="featured-title">
          <SectionHeader index={nextIndex()} id="featured-title" title={dict.home.featured} href={p('/episodes')} linkLabel={dict.home.viewAll} />
          <EpisodeList episodes={featuredList} locale={locale} dict={dict} />
        </section>
      )}

      {leadArticle && (
        <section className="container-page mt-24 md:mt-36" aria-labelledby="stories-title">
          <SectionHeader index={nextIndex()} id="stories-title" title={dict.home.stories} href={p('/stories')} linkLabel={dict.home.viewAll} />
          <Reveal>
            <ArticleRow article={leadArticle} locale={locale} dict={dict} large />
          </Reveal>
          {moreArticles.length > 0 && (
            <div className="mt-16 grid gap-12 border-t border-line pt-12 md:grid-cols-3 md:gap-10">
              {moreArticles.map((article) => (
                <ArticleRow key={article.id} article={article} locale={locale} dict={dict} />
              ))}
            </div>
          )}
        </section>
      )}

      {clips.length > 0 && (
        <section className="mt-24 md:mt-36" aria-labelledby="clips-title">
          <div className="container-page">
            <SectionHeader index={nextIndex()} id="clips-title" title={dict.home.clips} href={p('/clips')} linkLabel={dict.home.viewAll} />
          </div>
          <div className="container-page">
            <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
              {clips.slice(0, 5).map((clip) => (
                <li key={clip.id} className="w-[62vw] shrink-0 snap-start sm:w-auto">
                  <ClipCard clip={clip} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {programs.length > 0 && (
        <section className="container-page mt-24 md:mt-36" aria-labelledby="programs-title">
          <SectionHeader index={nextIndex()} id="programs-title" title={dict.home.programs} href={p('/programs')} linkLabel={dict.home.viewAll} />
          <div className="border-t border-line">
            {programs.slice(0, 4).map((program, i) => (
              <ProgramRow key={program.id} program={program} locale={locale} dict={dict} index={i} />
            ))}
          </div>
        </section>
      )}

      {guests.length > 0 && (
        <section className="container-page mt-24 md:mt-36" aria-labelledby="guests-title">
          <SectionHeader index={nextIndex()} id="guests-title" title={dict.home.guests} href={p('/guests')} linkLabel={dict.home.viewAll} />
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4 md:gap-x-8">
            {guests.slice(0, 4).map((guest) => (
              <GuestTile key={guest.id} guest={guest} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section id="newsletter" className="container-page mt-24 scroll-mt-24 md:mt-36" aria-labelledby="newsletter-title">
        <div className="grid grid-cols-1 gap-10 rounded-[28px] bg-inverse-bg p-8 text-inverse-fg sm:p-12 md:grid-cols-2 md:gap-16 md:rounded-[36px] md:p-16">
          <div>
            <h2 id="newsletter-title" className="display text-[clamp(2.25rem,5vw,4rem)]">
              {dict.newsletter.title}
            </h2>
            <p className="mt-5 max-w-md text-lg leading-8 opacity-75">{dict.newsletter.body}</p>
          </div>
          <div className="[--bg:var(--inverse-bg)] [--fg:var(--inverse-fg)] [--muted:color-mix(in_srgb,var(--inverse-fg)_68%,transparent)] [--line-strong:color-mix(in_srgb,var(--inverse-fg)_35%,transparent)] [--focus:var(--sand)] md:self-end">
            <NewsletterForm source="home" />
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="container-page mt-24 md:mt-32" aria-labelledby="platforms-title">
        <div className="flex flex-col gap-6 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
          <h2 id="platforms-title" className="text-2xl font-bold">
            {dict.home.listenOn}
          </h2>
          <PlatformLinks settings={settings} dict={dict} />
        </div>
      </section>
    </>
  );
}
