import type { Metadata } from 'next';
import ClothingRailHeroDemo from '@/components/product-rail-gallery-demo';

export const metadata: Metadata = {
  title: 'Clothing Rail',
  description:
    'A clothing rail you can brush, slide and lift pieces from, right on the page.',
};

/**
 * The demo lives in its own client module because a page may only export the
 * default component and Next's route config; `RAIL_DEMO_ITEMS` would break the
 * build if it were exported from here.
 */
export default function Page(): React.JSX.Element {
  return (
    <main className="w-full">
      <ClothingRailHeroDemo />
    </main>
  );
}
