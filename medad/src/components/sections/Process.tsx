'use client';

import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SectionHead } from '@/components/ui/SectionHead';
import type { Dictionary } from '@/content/types';

export function Process({ t }: { t: Dictionary['process'] }) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 62%', 'end 62%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  useEffect(() => {
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-step]');
    if (!items) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-42% 0px -52% 0px' },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const current = t.steps[active] ?? t.steps[0]!;

  return (
    <section id="process" aria-labelledby="process-title" className="relative overflow-x-clip py-24 sm:py-36">
      <div className="container-medad">
        <SectionHead
          id="process-title"
          index={t.index}
          label={t.label}
          labelEn={t.labelEn}
          heading={t.heading}
          intro={t.intro}
          align="split"
        />

        <div className="mt-16 grid gap-10 sm:mt-24 lg:grid-cols-12">
          {/* sticky stage (desktop) */}
          <div className="hidden lg:col-span-5 lg:block" aria-hidden="true">
            <div className="sticky top-[calc(var(--nav-h)+4rem)]">
              <div className="relative h-[17rem] overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={active}
                    initial={{ y: '60%', opacity: 0, filter: 'blur(10px)' }}
                    animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                    exit={{ y: '-60%', opacity: 0, filter: 'blur(10px)' }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 font-latin text-[15rem] leading-none font-semibold tracking-[-0.06em] text-transparent [-webkit-text-stroke:1.5px_rgb(157_184_255/0.55)]"
                  >
                    0{active + 1}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="mt-2 flex items-center gap-4">
                <span className="font-latin text-xs tracking-[0.22em] text-icy uppercase">{current.titleAlt}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-icy/40 to-transparent rtl:bg-gradient-to-l" />
              </div>
              <p className="mt-4 text-h3">{current.title}</p>
              <div className="mt-8 flex gap-2">
                {t.steps.map((s, i) => (
                  <span
                    key={s.title}
                    className={`size-2 rotate-45 transition-all duration-500 ${
                      i <= active ? 'bg-icy shadow-[0_0_10px_rgb(157_184_255)]' : 'bg-white/15'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* timeline */}
          <ol ref={listRef} className="relative lg:col-span-7">
            <span aria-hidden="true" className="absolute top-3 bottom-3 w-px bg-white/10 ltr:left-[11px] rtl:right-[11px]" />
            <motion.span
              aria-hidden="true"
              style={{ scaleY: fill }}
              className="absolute top-3 bottom-3 w-px origin-top bg-gradient-to-b from-electric via-icy to-electric shadow-[0_0_12px_rgb(65_105_255)] ltr:left-[11px] rtl:right-[11px]"
            />
            {t.steps.map((step, i) => {
              const on = i <= active;
              return (
                <li
                  key={step.title}
                  data-step={i}
                  className="reveal relative grid grid-cols-[auto_1fr] gap-6 pb-16 last:pb-0 sm:gap-10 sm:pb-24"
                  style={{ '--d': 80 } as CSSProperties}
                >
                  <span
                    aria-hidden="true"
                    className={`relative z-10 mt-1.5 grid size-[23px] place-items-center rounded-full border transition-all duration-700 ${
                      on ? 'border-icy bg-obsidian shadow-[0_0_0_6px_rgb(65_105_255/0.15),0_0_18px_rgb(65_105_255/0.7)]' : 'border-white/20 bg-obsidian'
                    }`}
                  >
                    <span className={`size-2 rotate-45 transition-colors duration-700 ${on ? 'bg-icy' : 'bg-white/20'}`} />
                  </span>
                  <div>
                    <div className="flex items-center gap-4">
                      <span className="font-latin text-xs font-semibold tracking-[0.2em] text-icy">0{i + 1}</span>
                      <span className="font-latin text-[0.7rem] tracking-[0.2em] text-mist uppercase">{step.titleAlt}</span>
                    </div>
                    <h3 className="mt-3 text-[clamp(1.75rem,1.2rem+2vw,3rem)] leading-[1.15] font-semibold [&:lang(ar)]:leading-[1.4]">
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-xl text-lead text-cool">{step.text}</p>
                    <div className="mt-6 flex flex-wrap items-center gap-2">
                      <span className="text-label me-2 text-[0.7rem] text-mist">{t.deliverables}</span>
                      {step.deliverables.map((d) => (
                        <span key={d} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.8rem] text-cool">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
