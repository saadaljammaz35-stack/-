'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { ArrowUpRight, ExternalLink } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { Dictionary, Project } from '@/content/types';
import type { Locale } from '@/lib/i18n';
import { useMediaQuery, useReducedMotion } from '@/lib/hooks';
import { ProjectDialog } from './ProjectDialog';
import { DesktopShot, MobileShot } from './Shots';
import { WORLDS, host } from './worlds';

type WorkDict = Dictionary['work'];

function ProjectCard({
  project,
  index,
  total,
  t,
  locale,
  progress,
  stacked,
  onOpen,
}: {
  project: Project;
  index: number;
  total: number;
  t: WorkDict;
  locale: Locale;
  progress: MotionValue<number>;
  stacked: boolean;
  onOpen: (slug: Project['slug']) => void;
}) {
  const world = WORLDS[project.slug];
  const targetScale = 1 - (total - 1 - index) * 0.045;
  const scale = useTransform(progress, [index / total, 1], [1, targetScale]);
  const titleId = `project-${project.slug}`;
  const rtl = locale === 'ar';

  return (
    <div className={stacked ? 'sticky top-0 flex h-[100svh] items-center' : ''}>
      <motion.article
        aria-labelledby={titleId}
        style={stacked ? { scale, top: `calc(${index * 22}px - 2vh)` } : undefined}
        className="group relative isolate w-full origin-top overflow-hidden rounded-[2rem] border border-white/10 lg:h-[min(80svh,46rem)]"
      >
        <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: world.bg }} />
        <div
          aria-hidden="true"
          className="absolute -top-24 -z-10 h-80 w-80 rounded-full blur-[110px] transition-transform duration-1000 group-hover:scale-125 ltr:right-[20%] rtl:left-[20%]"
          style={{ background: world.glow }}
        />
        <div aria-hidden="true" className="hairline-grid absolute inset-0 -z-10 opacity-30 [mask-image:linear-gradient(to_bottom,#000,transparent_70%)]" />

        <div className="grid h-full gap-10 p-6 sm:p-10 lg:grid-cols-12 lg:gap-6 lg:p-12">
          {/* info */}
          <div className="flex flex-col lg:col-span-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-[0.75rem] font-medium text-white">
                <span className="relative flex size-2" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: world.accent }} />
                  <span className="relative inline-flex size-2 rounded-full" style={{ background: world.accent }} />
                </span>
                {t.live}
              </span>
              <span className="font-latin text-xs text-cool" dir="ltr">
                {host(project.url)}
              </span>
            </div>
            <p className="mt-8 font-latin text-xs font-semibold tracking-[0.2em] text-cool" dir="ltr">
              <span style={{ color: world.accent }}>0{index + 1}</span> / 0{total}
            </p>
            <h3 id={titleId} className="mt-3 flex items-baseline gap-4">
              <span className="text-[clamp(2.4rem,1.6rem+3vw,4.25rem)] leading-[1.1] font-semibold">{project.name}</span>
              {project.nameAlt ? (
                <span className="font-latin text-sm tracking-[0.2em] text-cool" lang={rtl ? 'en' : 'ar'}>
                  {project.nameAlt}
                </span>
              ) : null}
            </h3>
            <p className="mt-2 text-label" style={{ color: world.accent }}>
              {project.category}
            </p>
            <p className="mt-6 max-w-md text-body text-cool">{project.description}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {project.scope.map((s) => (
                <li key={s} className="rounded-full border border-white/10 px-3 py-1 text-[0.78rem] text-cool">
                  {s}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3 lg:mt-auto">
              <button
                type="button"
                onClick={() => onOpen(project.slug)}
                data-open-project={project.slug}
                aria-haspopup="dialog"
                className="group/btn inline-flex h-12 items-center gap-3 rounded-full bg-white ps-6 pe-2 text-[0.95rem] font-semibold text-obsidian transition-transform duration-500 active:scale-95"
              >
                {t.view}
                <span className="sr-only">: {project.name}</span>
                <span className="grid size-8 place-items-center rounded-full bg-obsidian text-white transition-transform duration-500 group-hover/btn:rotate-45">
                  <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                </span>
              </button>
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-[0.9rem] text-white transition-colors hover:bg-white/10"
              >
                {t.visit}
                <ExternalLink aria-hidden="true" className="size-3.5 text-cool" />
                <span className="sr-only">
                  {' '}
                  ({project.name} — {rtl ? 'يفتح في نافذة جديدة' : 'opens in a new tab'})
                </span>
              </a>
            </div>
          </div>

          {/* stage: real screenshots of the live site */}
          <div
            aria-hidden="true"
            data-cursor={rtl ? 'استكشف' : 'Explore'}
            onClick={() => onOpen(project.slug)}
            className="relative min-h-[18rem] cursor-pointer [perspective:1800px] sm:min-h-[26rem] lg:col-span-8 lg:min-h-0"
          >
            <div
              className={`absolute top-0 right-0 w-[88%] transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] [transform-style:preserve-3d] sm:top-4 lg:top-1/2 lg:w-[90%] lg:-translate-y-1/2 ${
                rtl
                  ? '[transform:rotateY(10deg)_rotateX(4deg)] group-hover:[transform:rotateY(4deg)_rotateX(1deg)_translateY(-6px)]'
                  : '[transform:rotateY(-10deg)_rotateX(4deg)] group-hover:[transform:rotateY(-4deg)_rotateX(1deg)_translateY(-6px)]'
              }`}
            >
              <DesktopShot slug={project.slug} alt="" sizes="(min-width: 1024px) 52vw, 88vw" />
            </div>
            <div className="absolute bottom-0 left-0 w-[24%] max-w-44 transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:-translate-y-3 sm:w-[22%] lg:bottom-6 lg:left-2">
              <MobileShot slug={project.slug} alt="" sizes="(min-width: 1024px) 11rem, 24vw" />
            </div>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

export function WorkGallery({ t, locale }: { t: WorkDict; locale: Locale }) {
  const ref = useRef<HTMLDivElement>(null);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const reduced = useReducedMotion();
  const stacked = desktop && !reduced;
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [open, setOpen] = useState<Project['slug'] | null>(null);
  const last = useRef<Project['slug'] | null>(null);

  const onOpen = useCallback((slug: Project['slug']) => {
    last.current = slug;
    setOpen(slug);
  }, []);

  return (
    <>
      <div ref={ref} className={stacked ? '' : 'flex flex-col gap-6'}>
        {t.projects.map((p, i) => (
          <ProjectCard
            key={p.slug}
            project={p}
            index={i}
            total={t.projects.length}
            t={t}
            locale={locale}
            progress={scrollYProgress}
            stacked={stacked}
            onOpen={onOpen}
          />
        ))}
      </div>
      <ProjectDialog
        t={t}
        locale={locale}
        slug={open}
        onNavigate={(slug) => {
          last.current = slug;
          setOpen(slug);
        }}
        onClose={() => {
          setOpen(null);
          document
            .querySelector<HTMLElement>(`[data-open-project="${last.current}"]`)
            ?.focus({ preventScroll: true });
        }}
      />
    </>
  );
}
