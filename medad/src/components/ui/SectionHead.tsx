import type { CSSProperties } from 'react';
import { SplitWords } from '@/components/motion/SplitWords';

/** Editorial section label: index, bilingual name and an ink rule ending in a node. */
export function SectionLabel({
  index,
  label,
  labelEn,
  className = '',
}: {
  index: string;
  label: string;
  labelEn: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 text-cool ${className}`}>
      <span className="font-latin text-xs font-semibold tracking-[0.2em] text-icy">{index}</span>
      <span className="text-label text-white">{label}</span>
      <span aria-hidden="true" className="ink-rule hidden min-w-16 flex-1 sm:block" />
      <span className="font-latin text-[0.7rem] tracking-[0.2em] text-mist uppercase" dir="auto" lang={labelEn.match(/[a-z]/i) ? 'en' : 'ar'}>
        {labelEn}
      </span>
    </div>
  );
}

export function SectionHead({
  index,
  label,
  labelEn,
  heading,
  intro,
  id,
  className = '',
  align = 'start',
}: {
  index: string;
  label: string;
  labelEn: string;
  heading: string;
  intro?: string;
  id: string;
  className?: string;
  align?: 'start' | 'split';
}) {
  return (
    <header className={className}>
      <SectionLabel index={index} label={label} labelEn={labelEn} className="reveal mb-10 sm:mb-14" />
      <div
        className={
          align === 'split'
            ? 'grid gap-8 lg:grid-cols-12 lg:items-end'
            : 'grid gap-8'
        }
      >
        <SplitWords
          as="h2"
          id={id}
          text={heading}
          className={`text-h2 text-balance-pretty ${align === 'split' ? 'lg:col-span-8' : 'max-w-5xl'}`}
        />
        {intro ? (
          <p
            className={`reveal text-lead text-cool ${align === 'split' ? 'max-w-xl lg:col-span-4 lg:pb-3' : 'max-w-2xl'}`}
            style={{ '--d': 200 } as CSSProperties}
          >
            {intro}
          </p>
        ) : null}
      </div>
    </header>
  );
}
