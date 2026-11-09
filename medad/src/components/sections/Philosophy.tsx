import type { CSSProperties } from 'react';
import { InkMark } from '@/components/brand/InkMark';
import { ScrubText } from '@/components/motion/ScrubText';
import { SplitWords } from '@/components/motion/SplitWords';
import { SectionLabel } from '@/components/ui/SectionHead';
import type { Dictionary } from '@/content/types';

function Operator({ symbol }: { symbol: '+' | '=' }) {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center py-2 lg:py-0"
    >
      <span className="grid size-10 place-items-center rounded-full border border-white/10 font-latin text-lg text-icy">
        {symbol}
      </span>
    </div>
  );
}

export function Philosophy({ t }: { t: Dictionary['philosophy'] }) {
  return (
    <section id="about" aria-labelledby="about-title" className="relative overflow-x-clip py-24 sm:py-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-40 h-[32rem] w-[32rem] rounded-full bg-electric/10 blur-[140px] ltr:-left-40 rtl:-right-40"
      />
      <div className="container-medad relative">
        <SectionLabel index={t.index} label={t.label} labelEn={t.labelEn} className="reveal mb-12 sm:mb-16" />

        <SplitWords
          as="h2"
          id="about-title"
          text={t.heading}
          className="block max-w-6xl text-[clamp(3rem,1.2rem+7.4vw,9.5rem)] leading-[1] font-semibold tracking-[-0.045em] [&:lang(ar)]:leading-[1.25] [&:lang(ar)]:tracking-normal"
        />

        <div className="mt-16 grid gap-12 sm:mt-24 lg:grid-cols-12 lg:gap-10">
          <figure className="reveal relative overflow-hidden rounded-[var(--radius-xl)] border border-white/[0.07] bg-midnight/50 p-8 lg:col-span-4">
            <div className="hairline-grid absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,#000,transparent)]" aria-hidden="true" />
            <InkMark className="relative h-24 w-auto" />
            <blockquote className="relative mt-10 text-lead text-white">“{t.quote}”</blockquote>
          </figure>
          <div className="lg:col-span-7 lg:col-start-6">
            <ScrubText text={t.body} className="text-[clamp(1.35rem,1rem+1.25vw,2.25rem)] leading-[1.5] font-medium [&:lang(ar)]:leading-[1.8]" />
          </div>
        </div>

        {/* strategy + design + engineering = impact */}
        <div className="mt-24 sm:mt-32">
          <span aria-hidden="true" className="ink-rule mb-10 hidden lg:block" />
          <ol className="grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1.15fr] lg:items-stretch lg:gap-5">
            {t.pillars.map((p, i) => (
              <li key={p.title} className="contents">
                <div
                  className="reveal flex flex-col gap-4 rounded-[var(--radius-xl)] border border-white/[0.07] bg-white/[0.015] p-7"
                  style={{ '--d': i * 120 } as CSSProperties}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-latin text-xs font-semibold tracking-[0.2em] text-icy">0{i + 1}</span>
                    <span className="font-latin text-[0.7rem] tracking-[0.2em] text-mist uppercase">{p.titleAlt}</span>
                  </div>
                  <h3 className="text-h3">{p.title}</h3>
                  <p className="text-body text-cool">{p.text}</p>
                </div>
                <Operator symbol={i < t.pillars.length - 1 ? '+' : '='} />
              </li>
            ))}
            <li
              className="reveal glass glass-rim relative flex flex-col gap-4 overflow-hidden rounded-[var(--radius-xl)] p-7"
              style={{ '--d': 400 } as CSSProperties}
            >
              <div aria-hidden="true" className="absolute -top-16 h-48 w-48 rounded-full bg-electric/40 blur-[70px] ltr:-right-10 rtl:-left-10" />
              <div className="relative flex items-center justify-between">
                <span className="size-2 rotate-45 bg-icy shadow-[0_0_12px_rgb(157_184_255)]" aria-hidden="true" />
                <span className="font-latin text-[0.7rem] tracking-[0.2em] text-icy uppercase">{t.result.titleAlt}</span>
              </div>
              <h3 className="relative text-h3 ink-text">{t.result.title}</h3>
              <p className="relative text-body text-cool">{t.result.text}</p>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
