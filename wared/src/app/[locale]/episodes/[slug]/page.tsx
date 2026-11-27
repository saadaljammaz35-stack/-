import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chapters } from '@/components/player/Chapters';
import { AppleEmbed, SpotifyEmbed, YouTubeEmbed } from '@/components/player/Embeds';
import { EpisodePlayer } from '@/components/player/EpisodePlayer';
import { ShareMoment } from '@/components/player/ShareMoment';
import { Transcript } from '@/components/player/Transcript';
import { Cover, EpisodeList, FallbackNote, SectionHeader } from '@/components/site/blocks';
import { RichText } from '@/components/ui/RichText';
import { getEpisodeBySlug, getEpisodes } from '@/lib/data/public';
import { absoluteUrl } from '@/lib/env';
import { formatDate, formatDuration } from '@/lib/format';
import { getDictionary, resolveLocale, t } from '@/lib/i18n';
import { isFallback, localePath, pick } from '@/lib/i18n/config';
import { breadcrumbJsonLd, episodeJsonLd, jsonLdString, pageMetadata } from '@/lib/seo';
import { toTrack } from '@/lib/track';

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const episode = await getEpisodeBySlug(slug);
  if (!episode) return pageMetadata({ locale, path: `/episodes/${slug}`, noIndex: true });
  return pageMetadata({
    locale,
    path: `/episodes/${slug}`,
    title: pick(locale, episode.title, episode.titleEn),
    description: pick(locale, episode.summary, episode.summaryEn) ?? undefined,
    image: episode.cover?.url ?? episode.program.cover?.url,
    type: 'article',
    publishedTime: episode.publishedAt,
  });
}

export default async function EpisodePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const dict = getDictionary(locale);
  const episode = await getEpisodeBySlug(slug);
  if (!episode) notFound();

  const title = pick(locale, episode.title, episode.titleEn);
  const notes = pick(locale, episode.showNotes, episode.showNotesEn);
  const notesFallback = isFallback(locale, episode.showNotesEn) && Boolean(episode.showNotes);
  const track = toTrack(episode, locale);
  const more = (await getEpisodes({ programSlug: episode.program.slug, pageSize: 4 })).items.filter((e) => e.id !== episode.id).slice(0, 3);
  const pageUrl = absoluteUrl(localePath(locale, `/episodes/${episode.slug}`));
  const programHref = localePath(locale, `/programs/${episode.program.slug}`);

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            episodeJsonLd(episode, locale),
            breadcrumbJsonLd(locale, [
              { name: dict.nav.episodes, path: '/episodes' },
              { name: title, path: `/episodes/${episode.slug}` },
            ]),
          ]),
        }}
      />
      <header className="container-page grid grid-cols-1 gap-10 pb-14 pt-12 md:grid-cols-[1.25fr_1fr] md:gap-16 md:pb-20 md:pt-20">
        <div className="flex flex-col justify-end">
          <p className="mb-5 text-sm text-accent">
            <Link href={programHref} className="hover:underline">
              {pick(locale, episode.program.title, episode.program.titleEn)}
            </Link>
            {episode.season ? ` · ${t(dict.common.season, { n: episode.season })}` : ''}
            {episode.number ? ` · ${t(dict.common.episodeNumber, { n: episode.number })}` : ''}
          </p>
          <FallbackNote show={isFallback(locale, episode.titleEn)} dict={dict} />
          <h1 className="display text-[clamp(2.5rem,6.5vw,5.5rem)]" lang={isFallback(locale, episode.titleEn) ? 'ar' : undefined}>
            {title}
          </h1>
          {episode.summary && <p className="mt-6 max-w-2xl text-lg leading-8 text-muted md:text-xl md:leading-9">{pick(locale, episode.summary, episode.summaryEn)}</p>}
          <p className="mt-5 text-sm text-muted">
            {[t(dict.common.publishedOn, { date: formatDate(episode.publishedAt, locale) }), formatDuration(episode.durationSeconds, locale)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Cover media={episode.cover ?? episode.program.cover} alt="" priority sizes="(min-width: 768px) 40vw, 100vw" className="aspect-square rounded-[28px]" />
      </header>

      <div className="container-page grid grid-cols-1 gap-16 md:grid-cols-[1.25fr_1fr] md:gap-16">
        <div className="min-w-0 space-y-14">
          {track ? <EpisodePlayer track={track} /> : <p className="rounded-[28px] border border-line p-6 text-muted">{dict.player.noAudio}</p>}
          {track && (
            <div className="flex flex-wrap gap-3">
              <ShareMoment track={track} url={pageUrl} />
            </div>
          )}
          {episode.youtubeVideoId && (
            <section aria-label={dict.player.video}>
              <YouTubeEmbed videoId={episode.youtubeVideoId} title={title} />
            </section>
          )}
          {notes && (
            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="mb-5 text-lg font-bold">
                {dict.episodes.showNotes}
              </h2>
              <RichText text={notes} lang={notesFallback ? 'ar' : undefined} dir={notesFallback ? 'rtl' : undefined} />
            </section>
          )}
          {track && episode.transcript && <Transcript track={track} segments={episode.transcript.segments} lang={episode.transcript.locale} />}
          {track && !episode.transcript && <Transcript track={track} segments={[]} lang="ar" />}
        </div>
        <aside className="space-y-14">
          {track && <Chapters track={track} chapters={episode.chapters} />}
          {episode.guests.length > 0 && (
            <section aria-labelledby="guests-heading">
              <h2 id="guests-heading" className="mb-4 text-lg font-bold">
                {dict.episodes.guestsInEpisode}
              </h2>
              <ul className="divide-y divide-line border-y border-line">
                {episode.guests.map((guest) => (
                  <li key={guest.id} className="py-4">
                    <Link href={localePath(locale, `/guests/${guest.slug}`)} className="text-lg font-bold hover:text-accent">
                      {pick(locale, guest.name, guest.nameEn)}
                    </Link>
                    {guest.headline && <p className="mt-1 text-sm text-muted">{pick(locale, guest.headline, guest.headlineEn)}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(episode.spotifyEpisodeId || episode.appleEpisodeUrl) && (
            <section aria-labelledby="platforms-heading" className="space-y-4">
              <h2 id="platforms-heading" className="text-lg font-bold">
                {dict.player.platforms}
              </h2>
              {episode.spotifyEpisodeId && <SpotifyEmbed episodeId={episode.spotifyEpisodeId} title={title} />}
              {episode.appleEpisodeUrl && <AppleEmbed url={episode.appleEpisodeUrl} title={title} />}
            </section>
          )}
        </aside>
      </div>

      {more.length > 0 && (
        <section className="container-page mt-28" aria-labelledby="more-heading">
          <SectionHeader id="more-heading" title={dict.episodes.moreFromProgram} href={programHref} linkLabel={pick(locale, episode.program.title, episode.program.titleEn)} />
          <EpisodeList episodes={more} locale={locale} dict={dict} showProgram={false} />
        </section>
      )}
    </article>
  );
}
