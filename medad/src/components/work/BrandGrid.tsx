import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { BrandSlug, Dictionary } from '@/content/types';
import { BRAND_BG } from './worlds';

/** Bento layout: wide tiles for the landscape mark and the two hero marks. */
const LAYOUT: Record<BrandSlug, { tile: string; img: string }> = {
  mubayn: { tile: 'sm:col-span-2', img: 'object-contain' },
  labina: { tile: '', img: 'object-contain p-[9%]' },
  dunyaa: { tile: '', img: 'object-contain scale-[1.3]' },
  x: { tile: 'sm:col-span-2', img: 'object-contain p-[4%] scale-110' },
  sahm: { tile: 'sm:col-span-2', img: 'object-contain scale-[1.25]' },
};

export function BrandGrid({ t }: { t: Dictionary['work']['brands'] }) {
  return (
    <section className="mt-28 sm:mt-36" aria-labelledby="brands-title">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <p className="reveal text-label text-icy">{t.label}</p>
          <h3 id="brands-title" className="reveal mt-4 text-h2">
            {t.heading}
          </h3>
        </div>
        <p className="reveal max-w-md text-lead text-cool lg:col-span-5 lg:pb-3">{t.intro}</p>
      </div>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {t.items.map((b, i) => {
          const l = LAYOUT[b.slug];
          return (
            <li
              key={b.slug}
              className={`reveal group relative isolate aspect-[4/3] overflow-hidden rounded-[1.5rem] border border-white/10 ${l.tile} ${
                l.tile ? 'sm:aspect-auto sm:h-full sm:min-h-72' : 'sm:aspect-square'
              }`}
              style={{ background: BRAND_BG[b.slug], '--d': (i % 4) * 90 } as CSSProperties}
            >
              <div className="absolute inset-0 overflow-hidden transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.04]">
                <Image
                  src={`/work/brand/${b.slug}.webp`}
                  alt={`${b.name} — ${b.note}`}
                  fill
                  sizes="(min-width: 1024px) 50vw, (min-width: 640px) 50vw, 100vw"
                  className={l.img}
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-5 pt-16 opacity-100 transition-opacity duration-500 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <span className="text-lg font-semibold text-white">{b.name}</span>
                <span className="text-[0.8rem] text-white/75">{b.note}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
