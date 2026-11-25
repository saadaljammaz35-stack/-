import { renderFeed } from '@/lib/feed';

export const revalidate = 300;

/** Per-program podcast feed, e.g. /rss/my-show — submit this URL to Apple Podcasts and Spotify. */
export async function GET(_request: Request, { params }: { params: Promise<{ program: string }> }) {
  const { program } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(program)) return new Response('Not found', { status: 404 });
  return (await renderFeed(program)) ?? new Response('Not found', { status: 404 });
}
