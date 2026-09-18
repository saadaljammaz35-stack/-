'use client';

import MorphGallery, { type MorphItem } from '@/components/ui/morph-gallery';

/**
 * Unsplash serves `Access-Control-Allow-Origin: *`, which is the one thing
 * MorphGallery cannot work without: an image without CORS headers cannot be
 * uploaded into a WebGL texture at all. Swapping these for a host that does
 * not send that header drops the gallery to its DOM cross-fade fallback.
 *
 * `thumb` is a much smaller render of the same photo. Leaving it out is legal
 * and makes the strip download six full-size images for six 80x50 previews.
 */
const full = (id: string): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=2000&q=75`;
const thumb = (id: string): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=160&h=100&q=50`;

const ITEMS: MorphItem[] = [
  {
    src: full('photo-1506744038136-46273834b3fb'),
    thumb: thumb('photo-1506744038136-46273834b3fb'),
    alt: 'A mountain lake at dusk',
  },
  {
    src: full('photo-1469474968028-56623f02e42e'),
    thumb: thumb('photo-1469474968028-56623f02e42e'),
    alt: 'Sunlight breaking over a mountain valley',
  },
  {
    src: full('photo-1470071459604-3b5ec3a7fe05'),
    thumb: thumb('photo-1470071459604-3b5ec3a7fe05'),
    alt: 'Mist drifting through a conifer forest',
  },
  {
    src: full('photo-1472214103451-9374bd1c798e'),
    thumb: thumb('photo-1472214103451-9374bd1c798e'),
    alt: 'Rolling green hills under open sky',
  },
  {
    src: full('photo-1447752875215-b2761acb3c5d'),
    thumb: thumb('photo-1447752875215-b2761acb3c5d'),
    alt: 'Tall trees in a sunlit forest',
  },
  {
    src: full('photo-1426604966848-d7adac402bff'),
    thumb: thumb('photo-1426604966848-d7adac402bff'),
    alt: 'A green valley between mountain ridges',
  },
];

export default function Page(): React.JSX.Element {
  // w-full is load-bearing wherever this sits inside a centring flex parent:
  // a flex item left at width:auto shrinks to fit its contents, which with a
  // child asking for 100% resolves to 0px wide.
  return (
    <main className="relative w-full">
      <MorphGallery items={ITEMS} autoplay={4500} />
    </main>
  );
}
