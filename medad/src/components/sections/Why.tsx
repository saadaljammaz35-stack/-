'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { SectionHead } from '@/components/ui/SectionHead';
import type { Dictionary } from '@/content/types';
import { WhyVisual } from './WhyVisuals';

/**
 * Principles as an editorial index rather than an icon grid: the row in
 * focus expands while its specimen drawing takes the stage beside it.
 */
export function Why({ t }: { t: Dictionary['why'] }) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const hovering = useRef(false);

  useEffect(() => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-row]');
    if (!rows) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (hovering.current) return;
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.row));
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    rows.forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, []);

  return (
    <section id="why" aria-labelledby="why-title" className="relative overflow-x-clip py-24 sm:py-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 h-[30rem] w-[30rem] rounded-full bg-electric/[0.09] blur-[140px] ltr:-left-40 rtl:-right-40"
      />
      <div className="container-medad relative">
        <SectionHead
          id="why-title"
          index={t.index}
          label={t.label}
          labelEn={t.labelEn}
          heading={t.heading}
          intro={t.intro}
          align="split"
        />

        <div className="mt-16 grid gap-10 sm:mt-24 lg:grid-cols-12">
          <ol
            ref={listRef}
            className="border-t border-white/10 lg:col-span-7"
            onPointerEnter={() => (hovering.current = true)}
            onPointerLeave={() => (hovering.current = false)}
          >
            {t.items.map((item, i) => {
              const on = active === i;
              return (
                <li
                  key={item.title}
                  data-row={i}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  tabIndex={0}
                  aria-current={on ? 'true' : undefined}
                  className="group relative border-b border-white/10 py-7 outline-none focus-visible:bg-white/[0.03] sm:py-9"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-px h-px w-full bg-gradient-to-r from-electric via-icy to-transparent transition-transform duration-700 ease-[var(--ease-out-expo)] ltr:origin-left rtl:origin-right rtl:bg-gradient-to-l ${
                      on ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                  <div className="flex items-start gap-5 sm:gap-8">
                    <span className={`mt-2 font-latin text-xs font-semibold tracking-[0.2em] transition-colors duration-500 ${on ? 'text-icy' : 'text-mist'}`}>
                      0{i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                        <h3
                          className={`text-[clamp(1.6rem,1.1rem+2vw,2.75rem)] leading-[1.2] font-semibold transition-colors duration-500 [&:lang(ar)]:leading-[1.45] ${
                            on ? 'text-white' : 'text-white/45'
                          }`}
                        >
                          {item.title}
                        </h3>
                        <span className="font-latin text-[0.7rem] tracking-[0.2em] text-mist uppercase">{item.titleAlt}</span>
                      </div>
                      {/* expands on desktop; always open on small screens */}
                      <div
                        className={`grid transition-[grid-template-rows,opacity] duration-700 ease-[var(--ease-out-expo)] max-lg:grid-rows-[1fr] max-lg:opacity-100 ${
                          on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="flex items-start gap-5 pt-4">
                            <p className="max-w-xl flex-1 text-body text-cool">{item.text}</p>
                            <WhyVisual index={i} className="size-20 shrink-0 rounded-2xl border border-white/10 bg-white/[0.02] p-1.5 lg:hidden" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="hidden lg:col-span-5 lg:block" aria-hidden="true">
            <div className="glass glass-rim sticky top-[calc(var(--nav-h)+3rem)] aspect-square overflow-hidden rounded-[2rem]">
              <div className="hairline-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(70%_70%_at_50%_50%,#000,transparent)]" />
              <div className="absolute top-1/2 left-1/2 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/15 blur-3xl" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  className="absolute inset-0 p-10"
                  initial={{ opacity: 0, scale: 0.94, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                >
                  <WhyVisual index={active} className="size-full" />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-x-8 bottom-7 flex items-center justify-between font-latin text-[0.68rem] tracking-[0.2em] text-mist uppercase">
                <span dir="auto">{t.items[active]?.titleAlt}</span>
                <span className="text-icy" dir="ltr">0{active + 1} / 0{t.items.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
