import 'server-only';
import { getFeedEpisodes, getProgramBySlug, getSiteSettings } from '@/lib/data/public';
import { absoluteUrl } from '@/lib/env';
import { buildPodcastFeed } from '@/lib/rss';

export async function renderFeed(programSlug?: string): Promise<Response | null> {
  const program = programSlug ? await getProgramBySlug(programSlug) : null;
  if (programSlug && !program) return null;
  const [settings, episodes] = await Promise.all([getSiteSettings(), getFeedEpisodes(programSlug)]);
  const xml = buildPodcastFeed({
    siteUrl: absoluteUrl('').replace(/\/$/, ''),
    feedUrl: absoluteUrl(programSlug ? `/rss/${programSlug}` : '/rss.xml'),
    program,
    settings,
    episodes,
    defaultArtworkUrl: absoluteUrl('/brand/podcast-artwork.jpg'),
  });
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
