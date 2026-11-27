import 'server-only';
import { cache } from 'react';
import { demoArticles, demoClips, demoEpisodes, demoGuests, demoProgram } from '@/content/demo';
import { publicEnv } from '@/lib/env';
import { getPublicClient } from '@/lib/supabase/public';
import type {
  Article,
  ArticleKind,
  ArticleSummary,
  Clip,
  Episode,
  EpisodeSummary,
  Guest,
  GuestSummary,
  Paged,
  Program,
  SearchKind,
  SearchResult,
  SiteSettings,
} from '@/lib/types';
import {
  ARTICLE_COLUMNS,
  ARTICLE_SUMMARY_COLUMNS,
  CLIP_COLUMNS,
  EPISODE_COLUMNS,
  EPISODE_SUMMARY_COLUMNS,
  GUEST_COLUMNS,
  GUEST_SUMMARY_COLUMNS,
  PROGRAM_COLUMNS,
  mapArticle,
  mapArticleSummary,
  mapClip,
  mapEpisode,
  mapEpisodeSummary,
  mapGuest,
  mapGuestSummary,
  mapProgram,
} from './mappers';

/*
 * Read-only queries for the public site. They run with the publishable key, so Row Level Security only ever
 * returns live content. When Supabase is not configured they return empty results (or the labelled demo
 * content when NEXT_PUBLIC_DEMO_CONTENT=1), so every page renders honest empty states instead of fake data.
 */

type Rows = Record<string, unknown>[];

function logError(scope: string, error: unknown) {
  console.error(`[data:${scope}]`, error);
}

const DEFAULT_SETTINGS: SiteSettings = {
  general: {
    site_name: 'وارد',
    site_name_en: 'Wared',
    tagline: 'كل شيء وارد.',
    tagline_en: 'Anything is possible.',
    contact_email: null,
    announcement: null,
  },
  platforms: { spotify: null, apple_podcasts: null, youtube: null, anghami: null },
  social: { x: null, instagram: null, tiktok: null, youtube: null, linkedin: null },
  brand: { display_font: 'plex' },
};

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const db = getPublicClient();
  if (!db) return DEFAULT_SETTINGS;
  const { data, error } = await db.from('site_settings').select('key, value');
  if (error) {
    logError('settings', error);
    return DEFAULT_SETTINGS;
  }
  const merged = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, Record<string, unknown>>;
  for (const row of data ?? []) {
    const key = row.key as string;
    if (key in merged) merged[key] = { ...merged[key], ...(row.value as Record<string, unknown>) };
  }
  return merged as unknown as SiteSettings;
});

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export const getPrograms = cache(async (): Promise<Program[]> => {
  if (publicEnv.demoContent) return [demoProgram];
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from('podcasts')
    .select(PROGRAM_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false });
  if (error) {
    logError('programs', error);
    return [];
  }
  return (data as Rows).map(mapProgram);
});

export const getProgramBySlug = cache(async (slug: string): Promise<Program | null> => {
  if (publicEnv.demoContent) return slug === demoProgram.slug ? demoProgram : null;
  const db = getPublicClient();
  if (!db) return null;
  const { data, error } = await db.from('podcasts').select(PROGRAM_COLUMNS).eq('slug', slug).maybeSingle();
  if (error) logError('program', error);
  return data ? mapProgram(data as Record<string, unknown>) : null;
});

// ---------------------------------------------------------------------------
// Episodes
// ---------------------------------------------------------------------------

export async function getEpisodes(options: { programSlug?: string; page?: number; pageSize?: number } = {}): Promise<Paged<EpisodeSummary>> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(48, Math.max(1, options.pageSize ?? 12));
  if (publicEnv.demoContent) {
    const items = demoEpisodes.filter((e) => !options.programSlug || e.program.slug === options.programSlug);
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
  }
  const db = getPublicClient();
  if (!db) return { items: [], total: 0, page, pageSize };
  let query = db
    .from('episodes')
    .select(EPISODE_SUMMARY_COLUMNS, { count: 'exact' })
    .order('published_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (options.programSlug) query = query.eq('program.slug', options.programSlug);
  const { data, error, count } = await query;
  if (error) {
    logError('episodes', error);
    return { items: [], total: 0, page, pageSize };
  }
  return { items: (data as Rows).map(mapEpisodeSummary), total: count ?? 0, page, pageSize };
}

export const getLatestEpisodes = cache(async (limit = 6): Promise<EpisodeSummary[]> => {
  return (await getEpisodes({ pageSize: limit })).items;
});

export const getFeaturedEpisodes = cache(async (limit = 4): Promise<EpisodeSummary[]> => {
  if (publicEnv.demoContent) return demoEpisodes.filter((e) => e.isFeatured).slice(0, limit);
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from('episodes')
    .select(EPISODE_SUMMARY_COLUMNS)
    .eq('is_featured', true)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) {
    logError('featured', error);
    return [];
  }
  return (data as Rows).map(mapEpisodeSummary);
});

export const getEpisodeBySlug = cache(async (slug: string): Promise<Episode | null> => {
  if (publicEnv.demoContent) return demoEpisodes.find((e) => e.slug === slug) ?? null;
  const db = getPublicClient();
  if (!db) return null;
  const { data, error } = await db.from('episodes').select(EPISODE_COLUMNS).eq('slug', slug).maybeSingle();
  if (error) logError('episode', error);
  return data ? mapEpisode(data as Record<string, unknown>) : null;
});

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export async function getArticles(options: { kind?: ArticleKind; page?: number; pageSize?: number; featured?: boolean } = {}): Promise<Paged<ArticleSummary>> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(48, Math.max(1, options.pageSize ?? 12));
  if (publicEnv.demoContent) {
    const items = demoArticles.filter((a) => (!options.kind || a.kind === options.kind) && (!options.featured || a.isFeatured));
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
  }
  const db = getPublicClient();
  if (!db) return { items: [], total: 0, page, pageSize };
  let query = db
    .from('articles')
    .select(ARTICLE_SUMMARY_COLUMNS, { count: 'exact' })
    .order('published_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (options.kind) query = query.eq('kind', options.kind);
  if (options.featured) query = query.eq('is_featured', true);
  const { data, error, count } = await query;
  if (error) {
    logError('articles', error);
    return { items: [], total: 0, page, pageSize };
  }
  return { items: (data as Rows).map(mapArticleSummary), total: count ?? 0, page, pageSize };
}

export const getArticleBySlug = cache(async (slug: string): Promise<Article | null> => {
  if (publicEnv.demoContent) return demoArticles.find((a) => a.slug === slug) ?? null;
  const db = getPublicClient();
  if (!db) return null;
  const { data, error } = await db.from('articles').select(ARTICLE_COLUMNS).eq('slug', slug).maybeSingle();
  if (error) logError('article', error);
  return data ? mapArticle(data as Record<string, unknown>) : null;
});

// ---------------------------------------------------------------------------
// Clips and guests
// ---------------------------------------------------------------------------

export const getClips = cache(async (limit = 24): Promise<Clip[]> => {
  if (publicEnv.demoContent) return demoClips.slice(0, limit);
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db.from('clips').select(CLIP_COLUMNS).order('published_at', { ascending: false }).limit(limit);
  if (error) {
    logError('clips', error);
    return [];
  }
  return (data as Rows).map(mapClip);
});

export const getGuests = cache(async (limit = 60): Promise<GuestSummary[]> => {
  if (publicEnv.demoContent) return demoGuests.slice(0, limit);
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db.from('guests').select(GUEST_SUMMARY_COLUMNS).order('published_at', { ascending: false }).limit(limit);
  if (error) {
    logError('guests', error);
    return [];
  }
  return (data as Rows).map((row) => mapGuestSummary(row));
});

export const getGuestBySlug = cache(async (slug: string): Promise<Guest | null> => {
  if (publicEnv.demoContent) return demoGuests.find((g) => g.slug === slug) ?? null;
  const db = getPublicClient();
  if (!db) return null;
  const { data, error } = await db.from('guests').select(GUEST_COLUMNS).eq('slug', slug).maybeSingle();
  if (error) logError('guest', error);
  if (!data) return null;
  const guestRow = data as Record<string, unknown>;
  const { data: links, error: linkError } = await db
    .from('episode_guests')
    .select(`episode:episodes!inner(${EPISODE_SUMMARY_COLUMNS})`)
    .eq('guest_id', guestRow.id as string);
  if (linkError) logError('guest-episodes', linkError);
  const episodes = ((links as Rows | null) ?? [])
    .map((l) => l.episode)
    .filter(Boolean)
    .map((e) => mapEpisodeSummary((Array.isArray(e) ? e[0] : e) as Record<string, unknown>))
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  return mapGuest(guestRow, episodes);
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchContent(q: string): Promise<SearchResult[] | null> {
  const query = q.trim().slice(0, 120);
  if (query.length < 2) return [];
  if (publicEnv.demoContent) {
    const needle = query.toLowerCase();
    const hit = (...values: (string | null)[]) => values.some((v) => v?.toLowerCase().includes(needle));
    return [
      ...demoEpisodes.filter((e) => hit(e.title, e.titleEn, e.summary)).map((e) => ({ kind: 'episode' as const, id: e.id, slug: e.slug, title: e.title, titleEn: e.titleEn, excerpt: e.summary, publishedAt: e.publishedAt })),
      ...demoArticles.filter((a) => hit(a.title, a.titleEn, a.dek)).map((a) => ({ kind: 'article' as const, id: a.id, slug: a.slug, title: a.title, titleEn: a.titleEn, excerpt: a.dek, publishedAt: a.publishedAt })),
      ...demoGuests.filter((g) => hit(g.name, g.nameEn)).map((g) => ({ kind: 'guest' as const, id: g.id, slug: g.slug, title: g.name, titleEn: g.nameEn, excerpt: g.headline, publishedAt: null })),
    ];
  }
  const db = getPublicClient();
  if (!db) return null;
  const { data, error } = await db.rpc('search_content', { q: query, max_results: 30 });
  if (error) {
    logError('search', error);
    return null;
  }
  return ((data as Rows | null) ?? [])
    .map((row) => ({
      kind: row.kind as SearchKind,
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      titleEn: (row.title_en as string | null) ?? null,
      excerpt: (row.excerpt as string | null) ?? null,
      publishedAt: (row.published_at as string | null) ?? null,
      rank: Number(row.rank ?? 0),
    }))
    .sort((a, b) => b.rank - a.rank)
    .map((result) => {
      const { rank, ...rest } = result;
      void rank;
      return rest;
    });
}

// ---------------------------------------------------------------------------
// Sitemap and feeds
// ---------------------------------------------------------------------------

export interface SitemapEntry {
  path: string;
  updatedAt: string | null;
}

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  if (publicEnv.demoContent) return [];
  const db = getPublicClient();
  if (!db) return [];
  const [episodes, articles, guests, programs] = await Promise.all([
    db.from('episodes').select('slug, updated_at').limit(5000),
    db.from('articles').select('slug, updated_at').limit(5000),
    db.from('guests').select('slug, updated_at').limit(5000),
    db.from('podcasts').select('slug, updated_at').limit(500),
  ]);
  const entries: SitemapEntry[] = [];
  const push = (prefix: string, rows: unknown) => {
    for (const row of (rows as Rows | null) ?? []) entries.push({ path: `${prefix}/${row.slug as string}`, updatedAt: (row.updated_at as string) ?? null });
  };
  push('/episodes', episodes.data);
  push('/stories', articles.data);
  push('/guests', guests.data);
  push('/programs', programs.data);
  return entries;
}

/** Episodes for the podcast RSS feed (full detail, newest first). */
export async function getFeedEpisodes(programSlug?: string, limit = 300): Promise<Episode[]> {
  if (publicEnv.demoContent) return demoEpisodes;
  const db = getPublicClient();
  if (!db) return [];
  let query = db.from('episodes').select(EPISODE_COLUMNS).order('published_at', { ascending: false }).limit(limit);
  if (programSlug) query = query.eq('program.slug', programSlug);
  const { data, error } = await query;
  if (error) {
    logError('feed', error);
    return [];
  }
  return (data as Rows).map(mapEpisode);
}
