import { renderFeed } from '@/lib/feed';

export const revalidate = 300;

/** Network-wide podcast feed (all programs). */
export async function GET() {
  return (await renderFeed()) ?? new Response('Not found', { status: 404 });
}
