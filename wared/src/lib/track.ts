import type { PlayerTrack } from '@/components/player/PlayerProvider';
import { pick, type Locale } from '@/lib/i18n/config';
import type { Episode, EpisodeSummary } from '@/lib/types';

export function toTrack(episode: Episode | EpisodeSummary, locale: Locale): PlayerTrack | null {
  if (!episode.audioUrl) return null;
  return {
    episodeId: episode.id,
    slug: episode.slug,
    title: pick(locale, episode.title, episode.titleEn),
    programTitle: pick(locale, episode.program.title, episode.program.titleEn),
    audioUrl: episode.audioUrl,
    artworkUrl: episode.cover?.url ?? episode.program.cover?.url ?? null,
    durationSeconds: episode.durationSeconds,
    chapters: 'chapters' in episode ? episode.chapters : [],
    locale,
  };
}
