import { storagePublicUrl } from '@/lib/env';
import type {
  Article,
  ArticleKind,
  ArticleSummary,
  Chapter,
  Clip,
  Episode,
  EpisodeSummary,
  EpisodeType,
  Guest,
  GuestSummary,
  MediaRef,
  Program,
  ProgramKind,
  ProgramSummary,
  TranscriptSegment,
} from '@/lib/types';

/* Column lists shared by every query, so the mappers below always receive the fields they expect. */
export const MEDIA_COLUMNS = 'id, bucket, path, alt, alt_en, width, height, mime_type, bytes, duration_seconds';
export const PROGRAM_SUMMARY_COLUMNS = `id, slug, kind, title, title_en, tagline, tagline_en, cover:media_assets!podcasts_cover_image_id_fkey(${MEDIA_COLUMNS})`;
export const PROGRAM_COLUMNS = `${PROGRAM_SUMMARY_COLUMNS}, description, description_en, hosts, language, explicit, itunes_category, apple_podcasts_url, spotify_url, youtube_playlist_url, anghami_url, published_at, updated_at`;
export const EPISODE_SUMMARY_COLUMNS = `id, slug, number, season, episode_type, title, title_en, summary, summary_en, duration_seconds, published_at, audio_url, is_featured, cover:media_assets!episodes_cover_image_id_fkey(${MEDIA_COLUMNS}), audio:media_assets!episodes_audio_asset_id_fkey(${MEDIA_COLUMNS}), program:podcasts!inner(${PROGRAM_SUMMARY_COLUMNS})`;
export const EPISODE_COLUMNS = `${EPISODE_SUMMARY_COLUMNS}, show_notes, show_notes_en, audio_mime, audio_bytes, youtube_video_id, spotify_episode_id, apple_episode_url, explicit, updated_at, chapters:episode_chapters(start_seconds, title, title_en, position), transcripts(locale, segments), episode_guests(role, position, guest:guests(id, slug, name, name_en, headline, headline_en, photo:media_assets!guests_photo_id_fkey(${MEDIA_COLUMNS})))`;
export const GUEST_SUMMARY_COLUMNS = `id, slug, name, name_en, headline, headline_en, photo:media_assets!guests_photo_id_fkey(${MEDIA_COLUMNS})`;
export const GUEST_COLUMNS = `${GUEST_SUMMARY_COLUMNS}, bio, bio_en, website_url, x_handle, instagram_handle, linkedin_url`;
export const ARTICLE_SUMMARY_COLUMNS = `id, slug, kind, title, title_en, dek, dek_en, author_name, reading_minutes, published_at, is_featured, cover:media_assets!articles_cover_image_id_fkey(${MEDIA_COLUMNS}), category:categories(slug, name, name_en)`;
export const ARTICLE_COLUMNS = `${ARTICLE_SUMMARY_COLUMNS}, body, body_en, updated_at, related:episodes!articles_related_episode_id_fkey(${EPISODE_SUMMARY_COLUMNS})`;
export const CLIP_COLUMNS = `id, slug, title, title_en, description, orientation, duration_seconds, youtube_video_id, external_url, published_at, video:media_assets!clips_video_asset_id_fkey(${MEDIA_COLUMNS}), thumbnail:media_assets!clips_thumbnail_id_fkey(${MEDIA_COLUMNS}), episode:episodes(slug, title, title_en)`;

type Row = Record<string, unknown>;

const s = (row: Row, key: string): string => String(row[key] ?? '');
const ns = (row: Row, key: string): string | null => (row[key] == null ? null : String(row[key]));
const nn = (row: Row, key: string): number | null => (row[key] == null ? null : Number(row[key]));
/** PostgREST returns to-one embeds as an object, but some joins come back as a one-element array. */
const one = (value: unknown): Row | null => {
  if (Array.isArray(value)) return (value[0] as Row | undefined) ?? null;
  return (value as Row | null) ?? null;
};
const many = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

export function mapMedia(value: unknown): MediaRef | null {
  const row = one(value);
  if (!row) return null;
  const url = storagePublicUrl(s(row, 'bucket'), s(row, 'path'));
  if (!url) return null;
  return {
    id: s(row, 'id'),
    url,
    alt: ns(row, 'alt'),
    altEn: ns(row, 'alt_en'),
    width: nn(row, 'width'),
    height: nn(row, 'height'),
    mimeType: ns(row, 'mime_type'),
    bytes: nn(row, 'bytes'),
    durationSeconds: nn(row, 'duration_seconds'),
  };
}

export function mapProgramSummary(value: unknown): ProgramSummary {
  const row = one(value) ?? {};
  return {
    id: s(row, 'id'),
    slug: s(row, 'slug'),
    kind: (ns(row, 'kind') ?? 'podcast') as ProgramKind,
    title: s(row, 'title'),
    titleEn: ns(row, 'title_en'),
    tagline: ns(row, 'tagline'),
    taglineEn: ns(row, 'tagline_en'),
    cover: mapMedia(row.cover),
  };
}

export function mapProgram(row: Row): Program {
  return {
    ...mapProgramSummary(row),
    description: ns(row, 'description'),
    descriptionEn: ns(row, 'description_en'),
    hosts: ns(row, 'hosts'),
    language: (ns(row, 'language') ?? 'ar') as 'ar' | 'en',
    explicit: Boolean(row.explicit),
    itunesCategory: ns(row, 'itunes_category') ?? 'Society & Culture',
    appleUrl: ns(row, 'apple_podcasts_url'),
    spotifyUrl: ns(row, 'spotify_url'),
    youtubeUrl: ns(row, 'youtube_playlist_url'),
    anghamiUrl: ns(row, 'anghami_url'),
    publishedAt: ns(row, 'published_at'),
    updatedAt: s(row, 'updated_at'),
  };
}

export function mapEpisodeSummary(row: Row): EpisodeSummary {
  const audio = mapMedia(row.audio);
  return {
    id: s(row, 'id'),
    slug: s(row, 'slug'),
    number: nn(row, 'number'),
    season: nn(row, 'season'),
    episodeType: (ns(row, 'episode_type') ?? 'full') as EpisodeType,
    title: s(row, 'title'),
    titleEn: ns(row, 'title_en'),
    summary: ns(row, 'summary'),
    summaryEn: ns(row, 'summary_en'),
    cover: mapMedia(row.cover),
    durationSeconds: nn(row, 'duration_seconds') ?? audio?.durationSeconds ?? null,
    publishedAt: ns(row, 'published_at'),
    audioUrl: audio?.url ?? ns(row, 'audio_url'),
    isFeatured: Boolean(row.is_featured),
    program: mapProgramSummary(row.program),
  };
}

export function parseSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) return [];
  const segments: TranscriptSegment[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const seg = item as Record<string, unknown>;
    const start = Number(seg.start);
    const text = typeof seg.text === 'string' ? seg.text : '';
    if (!Number.isFinite(start) || !text) continue;
    segments.push({
      start,
      end: Number.isFinite(Number(seg.end)) && seg.end != null ? Number(seg.end) : undefined,
      speaker: typeof seg.speaker === 'string' && seg.speaker ? seg.speaker : undefined,
      text,
    });
  }
  return segments.sort((a, b) => a.start - b.start);
}

export function mapGuestSummary(value: unknown, role?: GuestSummary['role']): GuestSummary {
  const row = one(value) ?? {};
  return {
    id: s(row, 'id'),
    slug: s(row, 'slug'),
    name: s(row, 'name'),
    nameEn: ns(row, 'name_en'),
    headline: ns(row, 'headline'),
    headlineEn: ns(row, 'headline_en'),
    photo: mapMedia(row.photo),
    ...(role ? { role } : {}),
  };
}

export function mapEpisode(row: Row): Episode {
  const chapters: Chapter[] = many(row.chapters)
    .map((c) => ({ startSeconds: Number(c.start_seconds), title: s(c, 'title'), titleEn: ns(c, 'title_en') }))
    .sort((a, b) => a.startSeconds - b.startSeconds);
  const transcripts = many(row.transcripts);
  const transcriptRow = transcripts.find((t) => t.locale === 'ar') ?? transcripts[0];
  const guests = many(row.episode_guests)
    .filter((eg) => one(eg.guest))
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((eg) => mapGuestSummary(eg.guest, (ns(eg, 'role') ?? 'guest') as GuestSummary['role']));
  return {
    ...mapEpisodeSummary(row),
    showNotes: ns(row, 'show_notes'),
    showNotesEn: ns(row, 'show_notes_en'),
    audioMime: ns(row, 'audio_mime') ?? mapMedia(row.audio)?.mimeType ?? null,
    audioBytes: nn(row, 'audio_bytes') ?? mapMedia(row.audio)?.bytes ?? null,
    youtubeVideoId: ns(row, 'youtube_video_id'),
    spotifyEpisodeId: ns(row, 'spotify_episode_id'),
    appleEpisodeUrl: ns(row, 'apple_episode_url'),
    explicit: Boolean(row.explicit),
    chapters,
    transcript: transcriptRow
      ? { locale: (ns(transcriptRow, 'locale') ?? 'ar') as 'ar' | 'en', segments: parseSegments(transcriptRow.segments) }
      : null,
    guests,
    updatedAt: s(row, 'updated_at'),
  };
}

export function mapGuest(row: Row, episodes: EpisodeSummary[] = []): Guest {
  return {
    ...mapGuestSummary(row),
    bio: ns(row, 'bio'),
    bioEn: ns(row, 'bio_en'),
    websiteUrl: ns(row, 'website_url'),
    xHandle: ns(row, 'x_handle'),
    instagramHandle: ns(row, 'instagram_handle'),
    linkedinUrl: ns(row, 'linkedin_url'),
    episodes,
  };
}

export function mapArticleSummary(row: Row): ArticleSummary {
  const category = one(row.category);
  return {
    id: s(row, 'id'),
    slug: s(row, 'slug'),
    kind: (ns(row, 'kind') ?? 'article') as ArticleKind,
    title: s(row, 'title'),
    titleEn: ns(row, 'title_en'),
    dek: ns(row, 'dek'),
    dekEn: ns(row, 'dek_en'),
    cover: mapMedia(row.cover),
    authorName: ns(row, 'author_name'),
    readingMinutes: nn(row, 'reading_minutes'),
    publishedAt: ns(row, 'published_at'),
    isFeatured: Boolean(row.is_featured),
    category: category ? { slug: s(category, 'slug'), name: s(category, 'name'), nameEn: ns(category, 'name_en') } : null,
  };
}

export function mapArticle(row: Row): Article {
  const related = one(row.related);
  return {
    ...mapArticleSummary(row),
    body: s(row, 'body'),
    bodyEn: ns(row, 'body_en'),
    relatedEpisode: related ? mapEpisodeSummary(related) : null,
    updatedAt: s(row, 'updated_at'),
  };
}

export function mapClip(row: Row): Clip {
  const episode = one(row.episode);
  return {
    id: s(row, 'id'),
    slug: s(row, 'slug'),
    title: s(row, 'title'),
    titleEn: ns(row, 'title_en'),
    description: ns(row, 'description'),
    orientation: (ns(row, 'orientation') ?? 'vertical') as Clip['orientation'],
    durationSeconds: nn(row, 'duration_seconds'),
    youtubeVideoId: ns(row, 'youtube_video_id'),
    externalUrl: ns(row, 'external_url'),
    videoUrl: mapMedia(row.video)?.url ?? null,
    thumbnail: mapMedia(row.thumbnail),
    publishedAt: ns(row, 'published_at'),
    episode: episode ? { slug: s(episode, 'slug'), title: s(episode, 'title'), titleEn: ns(episode, 'title_en') } : null,
  };
}
