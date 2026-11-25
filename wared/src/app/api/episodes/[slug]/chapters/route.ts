import { NextResponse } from 'next/server';
import { getEpisodeBySlug } from '@/lib/data/public';

export const revalidate = 300;

/** Podcasting 2.0 JSON chapters (https://github.com/Podcastindex-org/podcast-namespace). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const episode = /^[a-z0-9-]{1,100}$/.test(slug) ? await getEpisodeBySlug(slug) : null;
  if (!episode) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(
    { version: '1.2.0', chapters: episode.chapters.map((c) => ({ startTime: c.startSeconds, title: c.title })) },
    { headers: { 'Content-Type': 'application/json+chapters; charset=utf-8', 'Access-Control-Allow-Origin': '*' } },
  );
}
