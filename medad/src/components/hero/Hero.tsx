import type { CSSProperties } from 'react';
import { Wordmark } from '@/components/brand/Logo';
import { SplitWords } from '@/components/motion/SplitWords';
import { Magnetic } from '@/components/motion/Magnetic';
import { ButtonLink } from '@/components/ui/Button';
import type { Dictionary } from '@/content/types';
import type { Locale } from '@/lib/i18n';
import { HeroScene } from './HeroScene';

function Backdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-20">
      {/* deep atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#101522_0%,#080a0f_60%)]" />
      <div className="absolute top-1/2 left-1/2 h-[min(90vw,62rem)] w-[min(120vw,80rem)] -translate-x-1/2 -translate-y-[55%] rounded-full bg-[radial-gradient(closest-side,rgb(65_105_255/0.24),rgb(65_105_255/0.06)_55%,transparent)]" />
      <div className="absolute top-[18%] left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(157_184_255/0.14),transparent)] blur-2xl" />
      {/* canvas grid, fading out from the centre */}
      <div className="hairline-grid absolute inset-0 [mask-image:radial-gradient(60%_55%_at_50%_45%,#000_10%,transparent_75%)] opacity-60" />
      {/* light beams */}
      <div className="absolute -top-1/3 left-[12%] h-[140%] w-40 rotate-[18deg] bg-gradient-to-b from-icy/[0.07] via-icy/[0.02] to-transparent blur-2xl" />
      <div className="absolute -top-1/3 right-[14%] h-[140%] w-56 -rotate-[22deg] bg-gradient-to-b from-electric/[0.08] via-electric/[0.02] to-transparent blur-2xl" />
      {/* horizon */}
      <div className="absolute inset-x-0 top-[68%] h-px bg-gradient-to-r from-transparent via-icy/30 to-transparent" />
      <div className="absolute inset-x-[20%] top-[68%] h-24 -translate-y-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,rgb(65_105_255/0.18),transparent)]" />
      {/* bottom fade into the page */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-obsidian to-transparent" />
    </div>
  );
}

export function Hero({ locale, t }: { locale: Locale; t: Dictionary }) {
  const h = t.hero;
  return (
    <HeroScene
      sculptureLabel={t.a11y.sculpture}
      backdrop={<Backdrop />}
      wordmark={
        <div className="absolute inset-x-0 top-[30%] flex justify-center px-[var(--gutter)] sm:top-[27%] lg:top-[24%]">
          <Wordmark
            locale={locale}
            className={`hero-fade h-auto text-white/[0.075] [mask-image:linear-gradient(to_bottom,#000_35%,rgb(0_0_0/0.25))] ${
              locale === 'ar' ? 'w-[min(92vw,72rem)]' : 'w-[min(94vw,82rem)]'
            }`}
          />
        </div>
      }
    >
      <div className="container-medad flex flex-1 flex-col pt-[calc(var(--nav-h)+1.75rem)] pb-8 sm:pt-[calc(var(--nav-h)+2.5rem)] sm:pb-10">
        {/* editorial meta row */}
        <div
          className="hero-in flex items-start justify-between gap-6 text-cool"
          style={{ '--d': 100 } as CSSProperties}
        >
          <p className="flex items-center gap-3">
            <span className="size-1.5 rotate-45 bg-icy shadow-[0_0_10px_rgb(157_184_255)]" aria-hidden="true" />
            <span className="text-label text-white">{h.eyebrow}</span>
            {locale === 'ar' ? (
              <span className="hidden font-latin text-[0.7rem] tracking-[0.2em] text-mist uppercase sm:inline" lang="en">
                — The Digital Canvas
              </span>
            ) : (
              <span className="hidden text-[0.8rem] text-mist sm:inline" lang="ar" dir="rtl">
                — عالم مِداد الرقمي
              </span>
            )}
          </p>
          <p className="hidden font-latin text-[0.7rem] tracking-[0.2em] text-mist uppercase md:block" lang="en" dir="ltr">
            {h.metaEnd}
          </p>
        </div>

        <div className="flex-1" />

        {/* headline + actions */}
        <div className="grid items-end gap-8 lg:grid-cols-12 lg:gap-10">
          <h1 id="hero-title" className="text-h1 text-balance-pretty lg:col-span-7">
            <span className="sr-only">{h.wordmark} — </span>
            <SplitWords text={h.headline} hero className="block" delay={250} />
          </h1>
          <div className="flex flex-col gap-7 lg:col-span-5 lg:pb-2 xl:col-span-4 xl:col-start-9">
            <p className="hero-in max-w-md text-lead text-cool" style={{ '--d': 650 } as CSSProperties}>
              {h.supporting}
            </p>
            <div className="hero-in flex flex-wrap items-center gap-3" style={{ '--d': 800 } as CSSProperties}>
              <Magnetic>
                <ButtonLink href="#contact" size="md">
                  {h.ctaPrimary}
                </ButtonLink>
              </Magnetic>
              <Magnetic strength={0.2}>
                <ButtonLink href="#work" variant="glass" size="md" arrow={false}>
                  {h.ctaSecondary}
                </ButtonLink>
              </Magnetic>
            </div>
          </div>
        </div>

        {/* scroll indicator */}
        <a
          href="#about"
          className="hero-fade group mx-auto mt-10 hidden flex-col items-center gap-3 text-mist transition-colors hover:text-white sm:flex"
          style={{ '--d': 1200 } as CSSProperties}
        >
          <span className="text-label text-[0.7rem]">{h.scroll}</span>
          <span className="relative block h-12 w-px overflow-hidden bg-white/10">
            <span className="scroll-dot absolute inset-x-0 top-0 block h-1/3 bg-gradient-to-b from-transparent to-icy" />
          </span>
        </a>
      </div>
    </HeroScene>
  );
}
