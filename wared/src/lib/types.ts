export type ContentStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'archived';
export type ProgramKind = 'podcast' | 'series' | 'show';
export type ArticleKind = 'story' | 'article' | 'essay' | 'interview';
export type EpisodeType = 'full' | 'trailer' | 'bonus';

export interface MediaRef {
  id?: string;
  url: string;
  alt: string | null;
  altEn: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  bytes: number | null;
  durationSeconds: number | null;
}

export interface ProgramSummary {
  id: string;
  slug: string;
  kind: ProgramKind;
  title: string;
  titleEn: string | null;
  tagline: string | null;
  taglineEn: string | null;
  cover: MediaRef | null;
}

export interface Program extends ProgramSummary {
  description: string | null;
  descriptionEn: string | null;
  hosts: string | null;
  language: 'ar' | 'en';
  explicit: boolean;
  itunesCategory: string;
  appleUrl: string | null;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
  anghamiUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface Chapter {
  startSeconds: number;
  title: string;
  titleEn: string | null;
}

export interface TranscriptSegment {
  start: number;
  end?: number;
  speaker?: string;
  text: string;
}

export interface GuestSummary {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  headline: string | null;
  headlineEn: string | null;
  photo: MediaRef | null;
  role?: 'guest' | 'host' | 'co_host';
}

export interface EpisodeSummary {
  id: string;
  slug: string;
  number: number | null;
  season: number | null;
  episodeType: EpisodeType;
  title: string;
  titleEn: string | null;
  summary: string | null;
  summaryEn: string | null;
  cover: MediaRef | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  audioUrl: string | null;
  isFeatured: boolean;
  program: ProgramSummary;
}

export interface Episode extends EpisodeSummary {
  showNotes: string | null;
  showNotesEn: string | null;
  audioMime: string | null;
  audioBytes: number | null;
  youtubeVideoId: string | null;
  spotifyEpisodeId: string | null;
  appleEpisodeUrl: string | null;
  explicit: boolean;
  chapters: Chapter[];
  transcript: { locale: 'ar' | 'en'; segments: TranscriptSegment[] } | null;
  guests: GuestSummary[];
  updatedAt: string;
}

export interface CategoryRef {
  slug: string;
  name: string;
  nameEn: string | null;
}

export interface ArticleSummary {
  id: string;
  slug: string;
  kind: ArticleKind;
  title: string;
  titleEn: string | null;
  dek: string | null;
  dekEn: string | null;
  cover: MediaRef | null;
  authorName: string | null;
  readingMinutes: number | null;
  publishedAt: string | null;
  isFeatured: boolean;
  category: CategoryRef | null;
}

export interface Article extends ArticleSummary {
  body: string;
  bodyEn: string | null;
  relatedEpisode: EpisodeSummary | null;
  updatedAt: string;
}

export interface Clip {
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  orientation: 'vertical' | 'horizontal';
  durationSeconds: number | null;
  youtubeVideoId: string | null;
  externalUrl: string | null;
  videoUrl: string | null;
  thumbnail: MediaRef | null;
  publishedAt: string | null;
  episode: { slug: string; title: string; titleEn: string | null } | null;
}

export interface Guest extends GuestSummary {
  bio: string | null;
  bioEn: string | null;
  websiteUrl: string | null;
  xHandle: string | null;
  instagramHandle: string | null;
  linkedinUrl: string | null;
  episodes: EpisodeSummary[];
}

export interface SiteSettings {
  general: {
    site_name: string;
    site_name_en: string;
    tagline: string;
    tagline_en: string;
    contact_email: string | null;
    announcement: string | null;
  };
  platforms: {
    spotify: string | null;
    apple_podcasts: string | null;
    youtube: string | null;
    anghami: string | null;
  };
  social: {
    x: string | null;
    instagram: string | null;
    tiktok: string | null;
    youtube: string | null;
    linkedin: string | null;
  };
  brand: { display_font: 'plex' | 'ward' };
}

export type SearchKind = 'episode' | 'article' | 'guest' | 'program' | 'clip';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  excerpt: string | null;
  publishedAt: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
