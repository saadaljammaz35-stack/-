import type { CSSProperties } from 'react';
import { InkMark } from '@/components/brand/InkMark';
import { Magnetic } from '@/components/motion/Magnetic';
import { SplitWords } from '@/components/motion/SplitWords';
import { ButtonLink } from '@/components/ui/Button';
import type { Dictionary } from '@/content/types';

export function FinalCta({ t }: { t: Dictionary['cta'] }) {
  return (
    <section id="start" aria-labelledby="start-title" className="relative isolate overflow-hidden py-32 sm:py-48">
      {/* atmosphere */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(65_105_255/0.32),rgb(65_105_255/0.06)_60%,transparent)]" />
        <div className="hairline-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(50%_50%_at_50%_50%,#000,transparent)]" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-icy/25 to-transparent" />
      </div>

      <div className="container-medad flex flex-col items-center text-center">
        {/* the signature ink mark inside a liquid-glass lens */}
        <div className="reveal relative mb-14 grid size-56 place-items-center sm:size-72" aria-hidden="true">
          <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-icy/20" />
          <div className="glass glass-rim absolute inset-6 rounded-full" />
          <div className="absolute inset-12 rounded-full bg-electric/25 blur-2xl" />
          <InkMark className="float-y relative h-[46%] w-auto" />
        </div>

        <p className="reveal text-label mb-6 text-icy">{t.label}</p>
        <SplitWords
          as="h2"
          id="start-title"
          text={t.headline}
          className="block max-w-5xl text-balance-pretty text-[clamp(2.75rem,1.2rem+6vw,7.5rem)] leading-[1.02] font-semibold tracking-[-0.045em] [&:lang(ar)]:leading-[1.3] [&:lang(ar)]:tracking-normal"
        />
        <p className="reveal mt-8 max-w-xl text-lead text-cool" style={{ '--d': 200 } as CSSProperties}>
          {t.supporting}
        </p>
        <div className="reveal mt-12" style={{ '--d': 320 } as CSSProperties}>
          <Magnetic strength={0.35}>
            <ButtonLink href="#contact" size="lg">
              {t.button}
            </ButtonLink>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
