'use client';

import '@fontsource/changa/700.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import * as React from 'react';
import ClothingRailHero from '@/components/ui/product-rail-gallery';
import type { RailGarment } from '@/components/ui/product-rail-gallery';

/**
 * Sahm's two cups on the rail instead of garments: the kraft paper cup in its
 * three sizes, and the white tumbler. Each is drawn for this page from the
 * owner's photos and the real logo vectors, on a transparent 200 x 310 canvas
 * with its own J-hook and wire ring at the top, which is why `hanger` is
 * "none". The rims line up on one hook height, so the sizes read from where
 * the bottoms fall. With no `backImage` the same face shows on both sides.
 *
 * The photos double as the rail's shadow and shading masks, so they are served
 * from this app (public/cups) and need no CORS or CSP exception.
 * NEXT_PUBLIC_BASE_PATH is set only by the static export for GitHub Pages,
 * which serves the app under a sub-path; plain <img> URLs are not prefixed by
 * Next on their own.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const photo = (name: string): string => `${BASE}/cups/${name}.webp`;

export const CUP_ITEMS: RailGarment[] = [
  {
    id: 'paper-s',
    name: 'كوب ورق صغير',
    tag: 'صغير',
    description: 'كرافت بجدارين، والشعار مطبوع بالبني.',
    details: ['كرافت بجدارين', 'الشعار بالبني', 'صغير'],
    image: photo('paper-s'),
  },
  {
    id: 'paper-m',
    name: 'كوب ورق وسط',
    tag: 'وسط',
    description: 'نفس الكوب بالمقاس الوسط.',
    details: ['كرافت بجدارين', 'الشعار بالبني', 'وسط'],
    image: photo('paper-m'),
  },
  {
    id: 'paper-l',
    name: 'كوب ورق كبير',
    tag: 'كبير',
    description: 'نفس الكوب بالمقاس الكبير.',
    details: ['كرافت بجدارين', 'الشعار بالبني', 'كبير'],
    image: photo('paper-l'),
  },
  {
    id: 'tumbler',
    name: 'كوب سهم الحراري',
    description: 'أبيض مطفي بغطا شفاف، والشعار بالأسود. تستخدمه كل يوم.',
    details: ['أبيض مطفي', 'غطا شفاف', 'الشعار بالأسود'],
    image: photo('tumbler'),
  },
];

const LABELS = { front: 'قدّام', back: 'ورا', close: 'سكّر', show: 'اعرض' };

export default function SahmCupRailDemo({
  autoplay = true,
}: {
  autoplay?: boolean;
}): React.JSX.Element {
  // The detail view is portalled into <body>, outside this tree, so the page's
  // direction and language go on <html> while it is shown.
  React.useEffect(() => {
    const root = document.documentElement;
    const before = { dir: root.dir, lang: root.lang };
    root.dir = 'rtl';
    root.lang = 'ar';
    return () => {
      root.dir = before.dir;
      root.lang = before.lang;
    };
  }, []);

  return (
    <div
      data-sahm
      className="flex min-h-svh w-full items-center justify-center bg-background text-foreground"
    >
      <ClothingRailHero
        items={CUP_ITEMS}
        hanger="none"
        labels={LABELS}
        eyebrow="أكواب سهم · الورق بثلاث مقاسات، والحراري"
        heading="اختار كوبك من الشماعة."
        caption="مرّر على الشماعة، اسحب الكوب، واضغط عليه تشوف ظهره."
        autoplay={autoplay}
        action={
          <a
            href="https://saadaljammaz35-stack.github.io/-/sahm/#list"
            className="rounded-full bg-ring px-5 py-2.5 text-sm font-medium text-foreground shadow-sm outline-none transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
          >
            خلّنا نبلغك
          </a>
        }
      />
    </div>
  );
}
