import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PlayButton } from '@/components/player/PlayButton';
import { ArrowIcon } from '@/components/ui/icons';
import { formatDate, formatDuration } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { isFallback, localePath, pick, type Locale } from '@/lib/i18n/config';
import { toTrack } from '@/lib/track';
import type { ArticleSummary, EpisodeSummary, GuestSummary, MediaRef, Program, SiteSettings } from '@/lib/types';
import { Logo } from './Logo';

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="container-page pb-12 pt-14 md:pb-20 md:pt-24">
      {eyebrow && <p className="eyebrow mb-5">{eyebrow}</p>}
      <h1 className="display max-w-5xl text-[clamp(2.75rem,8vw,6.5rem)]">{title}</h1>
      {intro && <p className="mt-6 max-w-2xl text-lg leading-8 text-muted md:text-xl md:leading-9">{intro}</p>}
      {children}
    </header>
  );
}

export function SectionHeader({ index, title, href, linkLabel, id }: { index?: string; title: string; href?: string; linkLabel?: string; id?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-t border-line pt-5 md:mb-12">
      <div className="flex items-baseline gap-4">
        {index && (
          <span className="text-sm tabular-nums text-accent" aria-hidden="true" dir="ltr">
            {index}
          </span>
        )}
        <h2 id={id} className="display text-[clamp(1.75rem,4vw,3rem)]">
          {title}
        </h2>
      </div>
      {href && linkLabel && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-2 pb-1.5 text-sm text-muted hover:text-fg">
          {linkLabel}
          <ArrowIcon size={16} className="transition-transform group-hover:-translate-x-1 ltr:rotate-180 ltr:group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="border-y border-line py-16 md:py-24">
      <p className="display max-w-3xl text-[clamp(1.75rem,4vw,3rem)]">{title}</p>
      {body && <p className="mt-4 max-w-xl text-lg leading-8 text-muted">{body}</p>}
      {children && <div className="mt-8">{children}</div>}
    </div>
  );
}

export function FallbackNote({ show, dict }: { show: boolean; dict: Dictionary }) {
  if (!show) return null;
  return <p className="mb-6 text-sm text-muted">{dict.common.translationMissing}</p>;
}

export function Cover({ media, alt, sizes, className = '', priority = false }: { media: MediaRef | null; alt: string; sizes: string; className?: string; priority?: boolean }) {
  if (!media) {
    return (
      <div className={`relative grid place-items-center overflow-hidden bg-ink text-ivory ${className}`} aria-hidden="true">
        <Logo className="w-1/3 max-w-40 opacity-90" title="" />
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-surface ${className}`}>
      <Image src={media.url} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

function episodeMeta(episode: EpisodeSummary, locale: Locale, dict: Dictionary): string {
  const parts = [
    episode.episodeType === 'trailer' ? dict.common.trailer : episode.episodeType === 'bonus' ? dict.common.bonus : null,
    formatDate(episode.publishedAt, locale),
    formatDuration(episode.durationSeconds, locale),
  ];
  return parts.filter(Boolean).join(' · ');
}

/** Editorial list row for an episode (used instead of repeated cards). */
export function EpisodeRow({ episode, locale, dict, showProgram = true }: { episode: EpisodeSummary; locale: Locale; dict: Dictionary; showProgram?: boolean }) {
  const title = pick(locale, episode.title, episode.titleEn);
  const fallback = isFallback(locale, episode.titleEn);
  const track = toTrack(episode, locale);
  const href = localePath(locale, `/episodes/${episode.slug}`);
  return (
    <article className="group relative grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-2 border-b border-line py-7 md:grid-cols-[5rem_1fr_auto] md:items-center md:gap-x-8">
      <span className="display row-span-2 w-12 text-3xl tabular-nums text-muted transition-colors group-hover:text-accent md:row-span-1 md:w-auto md:text-5xl" dir="ltr" aria-hidden="true">
        {episode.number ? String(episode.number).padStart(2, '0') : '—'}
      </span>
      <div className="min-w-0">
        {showProgram && <p className="mb-1.5 text-sm text-accent">{pick(locale, episode.program.title, episode.program.titleEn)}</p>}
        <h3 className="text-xl font-bold leading-snug md:text-2xl" lang={fallback ? 'ar' : undefined} dir={fallback ? 'rtl' : undefined}>
          <Link href={href} className="after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        <p className="mt-2 text-sm text-muted">{episodeMeta(episode, locale, dict)}</p>
      </div>
      <div className="relative z-10 col-start-2 md:col-start-auto">{track && <PlayButton track={track} label={title} />}</div>
    </article>
  );
}

export function EpisodeList({ episodes, locale, dict, showProgram }: { episodes: EpisodeSummary[]; locale: Locale; dict: Dictionary; showProgram?: boolean }) {
  return (
    <div className="border-t border-line">
      {episodes.map((episode) => (
        <EpisodeRow key={episode.id} episode={episode} locale={locale} dict={dict} showProgram={showProgram} />
      ))}
    </div>
  );
}

export function ArticleRow({ article, locale, dict, large = false }: { article: ArticleSummary; locale: Locale; dict: Dictionary; large?: boolean }) {
  const title = pick(locale, article.title, article.titleEn);
  const dek = pick(locale, article.dek, article.dekEn);
  const fallback = isFallback(locale, article.titleEn);
  const href = localePath(locale, `/stories/${article.slug}`);
  return (
    <article className={`group relative ${large ? 'grid gap-8 md:grid-cols-2 md:items-end' : ''}`}>
      {large && article.cover && <Cover media={article.cover} alt="" sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] rounded-[20px]" />}
      <div>
        <p className="mb-3 text-sm text-accent">
          {dict.stories.kinds[article.kind]}
          {article.category ? ` · ${pick(locale, article.category.name, article.category.nameEn)}` : ''}
        </p>
        <h3
          className={`${large ? 'display text-[clamp(2rem,4.5vw,3.5rem)]' : 'text-2xl font-bold leading-snug'} transition-colors group-hover:text-accent`}
          lang={fallback ? 'ar' : undefined}
          dir={fallback ? 'rtl' : undefined}
        >
          <Link href={href} className="after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        {dek && <p className={`mt-3 text-muted ${large ? 'text-lg leading-8' : 'leading-7'}`}>{dek}</p>}
        <p className="mt-4 text-sm text-muted">
          {[article.authorName ? t(dict.common.by, { name: article.authorName }) : null, formatDate(article.publishedAt, locale), article.readingMinutes ? t(dict.common.readingTime, { n: article.readingMinutes }) : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </article>
  );
}

export function ProgramRow({ program, locale, dict, index }: { program: Program; locale: Locale; dict: Dictionary; index: number }) {
  const title = pick(locale, program.title, program.titleEn);
  const tagline = pick(locale, program.tagline, program.taglineEn);
  return (
    <article className="group relative grid gap-6 border-b border-line py-10 md:grid-cols-[1fr_2fr] md:gap-12">
      <div className="flex items-baseline gap-4">
        <span className="text-sm tabular-nums text-accent" dir="ltr" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="text-sm text-muted">{dict.programs.kinds[program.kind]}</span>
      </div>
      <div>
        <h3 className="display text-[clamp(2rem,5vw,4rem)] transition-colors group-hover:text-accent">
          <Link href={localePath(locale, `/programs/${program.slug}`)} className="after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        {tagline && <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">{tagline}</p>}
      </div>
    </article>
  );
}

export function GuestTile({ guest, locale }: { guest: GuestSummary; locale: Locale }) {
  const name = pick(locale, guest.name, guest.nameEn);
  const headline = pick(locale, guest.headline, guest.headlineEn);
  return (
    <article className="group relative">
      <Cover
        media={guest.photo}
        alt=""
        sizes="(min-width: 1024px) 25vw, 50vw"
        className="aspect-[4/5] rounded-[20px] grayscale transition-[filter] duration-500 group-hover:grayscale-0"
      />
      <h3 className="mt-4 text-xl font-bold">
        <Link href={localePath(locale, `/guests/${guest.slug}`)} className="after:absolute after:inset-0">
          {name}
        </Link>
      </h3>
      {headline && <p className="mt-1 text-sm leading-6 text-muted">{headline}</p>}
    </article>
  );
}

export function Pagination({ page, total, pageSize, basePath, dict }: { page: number; total: number; pageSize: number; basePath: string; dict: Dictionary }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? basePath : `${basePath}${basePath.includes('?') ? '&' : '?'}page=${n}`);
  return (
    <nav className="mt-12 flex items-center justify-between gap-4 text-sm" aria-label={t(dict.common.page, { n: page, total: pages })}>
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn btn-ghost" rel="prev">
          {dict.common.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">{t(dict.common.page, { n: page, total: pages })}</span>
      {page < pages ? (
        <Link href={href(page + 1)} className="btn btn-ghost" rel="next">
          {dict.common.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function PlatformLinks({ settings, dict, extra }: { settings: SiteSettings; dict: Dictionary; extra?: Partial<Record<'spotify' | 'apple_podcasts' | 'youtube' | 'anghami', string | null>> }) {
  const platforms = { ...settings.platforms, ...Object.fromEntries(Object.entries(extra ?? {}).filter(([, v]) => v)) };
  const items = [
    { key: 'spotify', label: dict.player.spotify, url: platforms.spotify },
    { key: 'apple_podcasts', label: dict.player.applePodcasts, url: platforms.apple_podcasts },
    { key: 'youtube', label: dict.player.youtube, url: platforms.youtube },
    { key: 'anghami', label: dict.player.anghami, url: platforms.anghami },
  ].filter((i): i is { key: string; label: string; url: string } => Boolean(i.url && /^https:\/\//.test(i.url)));
  return (
    <ul className="flex flex-wrap gap-3">
      {items.map((item) => (
        <li key={item.key}>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            {item.label}
          </a>
        </li>
      ))}
      <li>
        <a href="/rss.xml" className="btn btn-ghost">
          {dict.player.rss}
        </a>
      </li>
    </ul>
  );
}

export function DemoBanner({ dict }: { dict: Dictionary }) {
  return (
    <div role="note" className="bg-sand px-4 py-2.5 text-center text-sm font-medium text-ink">
      {dict.common.demoBanner}
    </div>
  );
}
