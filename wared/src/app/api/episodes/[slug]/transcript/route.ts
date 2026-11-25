import { getEpisodeBySlug } from '@/lib/data/public';
import { transcriptToVtt } from '@/lib/rss';

export const revalidate = 300;

/** WebVTT transcript for podcast apps (podcast:transcript). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const episode = /^[a-z0-9-]{1,100}$/.test(slug) ? await getEpisodeBySlug(slug) : null;
  if (!episode?.transcript?.segments.length) return new Response('Not found', { status: 404 });
  return new Response(transcriptToVtt(episode.transcript.segments), {
    headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
