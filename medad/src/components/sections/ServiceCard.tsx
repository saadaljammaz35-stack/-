'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useRef, type CSSProperties } from 'react';
import type { Service } from '@/content/types';
import type { Locale } from '@/lib/i18n';
import { ServiceArt } from './ServiceArt';

export function ServiceCard({
  service,
  index,
  locale,
  more,
}: {
  service: Service;
  index: number;
  locale: Locale;
  more: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const titleId = `service-${service.slug}`;

  return (
    <article
      ref={ref}
      aria-labelledby={titleId}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}
      className="reveal group relative isolate flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-white/[0.08] bg-[linear-gradient(180deg,rgb(22_28_44/0.7),rgb(12_15_24/0.7))] p-6 transition-[border-color,transform] duration-700 ease-[var(--ease-out-expo)] hover:border-icy/25 sm:p-9"
      style={{ '--d': (index % 2) * 120 } as CSSProperties}
    >
      <div aria-hidden="true" className="spotlight pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-icy/50 to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />

      <div className="relative -mx-2 mb-8 aspect-[16/10] overflow-hidden rounded-2xl border border-white/[0.06] bg-obsidian/60 sm:mb-10">
        <div aria-hidden="true" className="hairline-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(70%_70%_at_50%_50%,#000,transparent)]" />
        <div aria-hidden="true" className="absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/20 blur-3xl transition-transform duration-700 group-hover:scale-150" />
        <ServiceArt slug={service.slug} className="relative size-full" />
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="font-latin text-xs font-semibold tracking-[0.2em] text-icy">0{index + 1}</span>
        <span className="font-latin text-[0.7rem] tracking-[0.2em] text-mist uppercase" lang={locale === 'ar' ? 'en' : 'ar'}>
          {service.titleAlt}
        </span>
      </div>
      <h3 id={titleId} className="mt-4 text-h3">
        {service.title}
      </h3>
      <p className="mt-4 text-body text-cool">{service.short}</p>
      <ul className="mt-6 flex flex-wrap gap-2">
        {service.tags.map((tag) => (
          <li key={tag} className="rounded-full border border-white/10 px-3 py-1 text-[0.8rem] text-cool">
            {tag}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <Link
          href={`/${locale}/services/${service.slug}`}
          className="inline-flex items-center gap-2 text-[0.95rem] font-medium text-white after:absolute after:inset-0 after:content-['']"
          data-cursor={locale === 'ar' ? 'اكتشف' : 'View'}
        >
          <span className="relative">
            {more}
            <span className="absolute -bottom-1 block h-px w-full scale-x-0 bg-icy transition-transform duration-500 group-hover:scale-x-100 ltr:origin-left rtl:origin-right" />
          </span>
          <span className="sr-only">: {service.title}</span>
          <ArrowUpRight aria-hidden="true" className="size-4 text-icy transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
