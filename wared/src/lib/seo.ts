import type { Metadata } from 'next';
import { absoluteUrl, publicEnv } from '@/lib/env';
import { getDictionary, localePath, locales, type Locale } from '@/lib/i18n';
import type { Article, Episode, Guest, Program } from '@/lib/types';

const DEFAULT_OG = '/og/default.jpg';

interface PageMetaInput {
  locale: Locale;
  path: string; // path without the locale prefix, e.g. "/episodes"
  title?: string;
  description?: string;
  image?: string | null;
  type?: 'website' | 'article';
  publishedTime?: string | null;
  noIndex?: boolean;
}

/** Builds metadata with canonical URL, hreflang alternates, Open Graph and Twitter cards. */
export function pageMetadata(input: PageMetaInput): Metadata {
  const dict = getDictionary(input.locale);
  const title = input.title ? `${input.title} | ${dict.meta.siteName}` : `${dict.meta.siteName} | ${dict.meta.tagline}`;
  const description = input.description ?? dict.meta.description;
  const url = absoluteUrl(localePath(input.locale, input.path));
  const image = input.image ? (input.image.startsWith('http') ? input.image : absoluteUrl(input.image)) : absoluteUrl(DEFAULT_OG);
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l === 'ar' ? 'ar-SA' : 'en'] = absoluteUrl(localePath(l, input.path));
  languages['x-default'] = absoluteUrl(localePath('ar', input.path));

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: input.type ?? 'website',
      url,
      title,
      description,
      siteName: dict.meta.siteName,
      locale: input.locale === 'ar' ? 'ar_SA' : 'en_US',
      images: [{ url: image, width: 1200, height: 630, alt: input.title ?? dict.meta.siteName }],
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    robots: input.noIndex || publicEnv.demoContent ? { index: false, follow: false } : undefined,
  };
}

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: 'وارد',
    alternateName: 'Wared',
    url: absoluteUrl('/ar'),
    logo: absoluteUrl('/icons/icon-512.png'),
    slogan: 'كل شيء وارد.',
  };
}

export function websiteJsonLd(locale: Locale): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: locale === 'ar' ? 'وارد' : 'Wared',
    url: absoluteUrl(localePath(locale)),
    inLanguage: locale === 'ar' ? 'ar-SA' : 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl(localePath(locale, '/search'))}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

function isoDuration(seconds: number | null): string | undefined {
  if (!seconds) return undefined;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s ? `${s}S` : ''}` || 'PT0S';
}

export function programJsonLd(program: Program, locale: Locale): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    name: program.title,
    alternateName: program.titleEn ?? undefined,
    description: program.description ?? program.tagline ?? undefined,
    url: absoluteUrl(localePath(locale, `/programs/${program.slug}`)),
    webFeed: absoluteUrl(`/rss/${program.slug}`),
    image: program.cover?.url,
    inLanguage: program.language === 'ar' ? 'ar' : 'en',
  };
}

export function episodeJsonLd(episode: Episode, locale: Locale): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: episode.title,
    alternateName: episode.titleEn ?? undefined,
    description: episode.summary ?? undefined,
    url: absoluteUrl(localePath(locale, `/episodes/${episode.slug}`)),
    datePublished: episode.publishedAt ?? undefined,
    dateModified: episode.updatedAt || undefined,
    episodeNumber: episode.number ?? undefined,
    timeRequired: isoDuration(episode.durationSeconds),
    image: episode.cover?.url,
    inLanguage: 'ar',
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: episode.program.title,
      url: absoluteUrl(localePath(locale, `/programs/${episode.program.slug}`)),
    },
    associatedMedia: episode.audioUrl
      ? { '@type': 'MediaObject', contentUrl: episode.audioUrl.startsWith('http') ? episode.audioUrl : absoluteUrl(episode.audioUrl), encodingFormat: episode.audioMime ?? 'audio/mpeg' }
      : undefined,
    actor: episode.guests.length
      ? episode.guests.map((g) => ({ '@type': 'Person', name: g.name, url: absoluteUrl(localePath(locale, `/guests/${g.slug}`)) }))
      : undefined,
  };
}

export function articleJsonLd(article: Article, locale: Locale): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    alternativeHeadline: article.titleEn ?? undefined,
    description: article.dek ?? undefined,
    url: absoluteUrl(localePath(locale, `/stories/${article.slug}`)),
    datePublished: article.publishedAt ?? undefined,
    dateModified: article.updatedAt || undefined,
    image: article.cover?.url,
    author: article.authorName ? { '@type': 'Person', name: article.authorName } : { '@type': 'Organization', name: 'وارد' },
    publisher: { '@type': 'Organization', name: 'وارد', logo: { '@type': 'ImageObject', url: absoluteUrl('/icons/icon-512.png') } },
    inLanguage: 'ar',
  };
}

export function personJsonLd(guest: Guest, locale: Locale): JsonLd {
  const sameAs = [
    guest.websiteUrl,
    guest.xHandle ? `https://x.com/${guest.xHandle}` : null,
    guest.instagramHandle ? `https://instagram.com/${guest.instagramHandle}` : null,
    guest.linkedinUrl,
  ].filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: guest.name,
    alternateName: guest.nameEn ?? undefined,
    description: guest.headline ?? undefined,
    url: absoluteUrl(localePath(locale, `/guests/${guest.slug}`)),
    image: guest.photo?.url,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}

export function breadcrumbJsonLd(locale: Locale, items: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(localePath(locale, item.path)),
    })),
  };
}

/** Serialises JSON-LD safely for a <script> tag (no "</script>" breakout). */
export function jsonLdString(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
