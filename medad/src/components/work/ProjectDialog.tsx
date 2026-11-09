'use client';

import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, ExternalLink, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Dictionary, Project, ProjectType } from '@/content/types';
import type { Locale } from '@/lib/i18n';
import { scroller } from '@/components/motion/SmoothScroll';
import { MobileShot } from './Shots';
import { WORLDS, host } from './worlds';

export const PREFILL_EVENT = 'medad:prefill';
export type PrefillDetail = { projectType: ProjectType };

export function ProjectDialog({
  t,
  locale,
  slug,
  onNavigate,
  onClose,
}: {
  t: Dictionary['work'];
  locale: Locale;
  slug: Project['slug'] | null;
  onNavigate: (slug: Project['slug']) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const index = t.projects.findIndex((p) => p.slug === slug);
  const project = index >= 0 ? t.projects[index] : null;
  const m = t.modal;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !slug) return;
    if (!dialog.open) {
      delete dialog.dataset.closing;
      dialog.showModal();
      scroller.lock();
    }
    bodyRef.current?.scrollTo({ top: 0 });
  }, [slug]);

  useEffect(() => () => scroller.unlock(), []);

  const requestClose = (after?: () => void) => {
    const dialog = ref.current;
    if (!dialog || closing.current) return;
    closing.current = true;
    dialog.dataset.closing = 'true';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(
      () => {
        dialog.close();
        delete dialog.dataset.closing;
        closing.current = false;
        scroller.unlock();
        onClose();
        after?.();
      },
      reduced ? 0 : 380,
    );
  };

  const go = (dir: 1 | -1) => {
    const next = t.projects[(index + dir + t.projects.length) % t.projects.length];
    if (next) onNavigate(next.slug);
  };

  const startSimilar = () => {
    if (!project) return;
    const type = project.contactType;
    requestClose(() => {
      window.dispatchEvent(new CustomEvent<PrefillDetail>(PREFILL_EVENT, { detail: { projectType: type } }));
      const target = document.getElementById('contact');
      if (target) {
        scroller.to(target);
        history.replaceState(null, '', '#contact');
      }
    });
  };

  const Prev = locale === 'ar' ? ArrowRight : ArrowLeft;
  const Next = locale === 'ar' ? ArrowLeft : ArrowRight;
  const world = project ? WORLDS[project.slug] : null;

  return (
    <dialog
      ref={ref}
      aria-labelledby="project-dialog-title"
      className="project-dialog m-0 h-full max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-white"
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className="project-dialog__panel glass glass-rim mx-auto flex h-[calc(100svh-1rem)] w-[calc(100%-1rem)] max-w-7xl flex-col overflow-hidden rounded-[1.75rem] sm:mt-4 sm:h-[calc(100svh-2rem)] sm:w-[calc(100%-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-[0.75rem] font-medium">
              {t.live}
            </span>
            <span className="truncate text-sm text-cool">{project?.category}</span>
          </div>
          <button
            type="button"
            onClick={() => requestClose()}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.04] transition-colors hover:bg-white/10"
            aria-label={m.close}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div ref={bodyRef} data-lenis-prevent className="flex-1 overflow-y-auto overscroll-contain">
          <AnimatePresence mode="wait" initial={false}>
            {project && world ? (
              <motion.div
                key={project.slug}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* showcase */}
                <div className="relative overflow-hidden px-5 pt-8 pb-10 sm:px-8 sm:pt-10 lg:px-12">
                  <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: world.bg }} />
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <h2 id="project-dialog-title" className="flex items-baseline gap-4">
                      <span className="text-[clamp(2.5rem,1.5rem+4vw,5rem)] leading-[1.1] font-semibold">{project.name}</span>
                      <span className="font-latin text-sm tracking-[0.2em] text-cool">{project.nameAlt}</span>
                    </h2>
                    <p className="max-w-md text-body text-cool">{project.description}</p>
                  </div>
                  <div className="mt-10 grid items-start gap-6 md:grid-cols-[1fr_auto]">
                    <figure>
                      <div className="overflow-hidden rounded-[1.1rem] border border-white/15 bg-[#0d1220] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]">
                        <div className="flex h-8 items-center gap-1.5 border-b border-white/10 bg-white/[0.04] px-3" dir="ltr" aria-hidden="true">
                          <span className="size-2 rounded-full bg-white/25" />
                          <span className="size-2 rounded-full bg-white/25" />
                          <span className="size-2 rounded-full bg-white/25" />
                          <span className="mx-auto rounded-full bg-white/[0.07] px-4 py-0.5 font-latin text-[0.7rem] text-cool">{host(project.url)}</span>
                        </div>
                        <div
                          data-lenis-prevent
                          tabIndex={0}
                          aria-label={m.scrollHint}
                          className="aspect-[16/10] overflow-y-auto overscroll-contain"
                        >
                          <Image
                            src={`/work/${project.slug}-page.webp`}
                            alt={`${project.name} — ${m.desktop}`}
                            width={1200}
                            height={project.slug === 'mubayn' ? 2414 : 3000}
                            sizes="(min-width: 1280px) 60rem, 90vw"
                            className="block h-auto w-full"
                          />
                        </div>
                      </div>
                      <figcaption className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-mist">
                        <span>{m.desktop}</span>
                        <span>{m.scrollHint}</span>
                      </figcaption>
                    </figure>
                    <figure className="mx-auto w-44 md:w-52">
                      <MobileShot slug={project.slug} alt={`${project.name} — ${m.mobile}`} sizes="13rem" />
                      <figcaption className="mt-3 text-center text-xs text-mist">{m.mobile}</figcaption>
                    </figure>
                  </div>
                </div>

                {/* story */}
                <div className="grid gap-12 px-5 py-12 sm:px-8 lg:grid-cols-12 lg:px-12">
                  <div className="flex flex-col gap-10 lg:col-span-7">
                    <section>
                      <h3 className="text-label text-icy">{m.about}</h3>
                      <p className="mt-4 text-lead text-white">{project.about}</p>
                    </section>
                    <section>
                      <h3 className="text-label text-icy">{m.highlights}</h3>
                      <ul className="mt-4 flex flex-col">
                        {project.highlights.map((f) => (
                          <li key={f} className="flex items-center gap-3 border-b border-white/[0.08] py-3 text-[0.95rem] text-cool">
                            <span aria-hidden="true" className="size-1.5 shrink-0 rotate-45 bg-icy" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                  <div className="flex flex-col gap-10 lg:col-span-4 lg:col-start-9">
                    <section>
                      <h3 className="text-label text-icy">{m.scope}</h3>
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {project.scope.map((s) => (
                          <li key={s} className="rounded-full border border-white/10 px-3 py-1 text-[0.8rem] text-cool">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section>
                      <h3 className="text-label text-icy">{m.palette}</h3>
                      <ul className="mt-4 grid grid-cols-4 gap-2">
                        {project.palette.map((c) => (
                          <li key={c.hex}>
                            <span className="block aspect-square rounded-xl border border-white/10" style={{ background: c.hex }} />
                            <span className="mt-2 block font-latin text-[0.7rem] text-cool">{c.name}</span>
                            <span className="block font-latin text-[0.65rem] text-mist uppercase">{c.hex}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </div>

              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-cool transition-colors hover:text-white"
            >
              <Prev className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{m.prev}</span>
              <span className="sr-only sm:hidden">{m.prev}</span>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-cool transition-colors hover:text-white"
            >
              <span className="hidden sm:inline">{m.next}</span>
              <span className="sr-only sm:hidden">{m.next}</span>
              <Next className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          {project ? (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm text-white transition-colors hover:bg-white/10"
            >
              {t.visit}
              <ExternalLink className="size-3.5 text-cool" aria-hidden="true" />
              <span className="sr-only"> ({locale === 'ar' ? 'يفتح في نافذة جديدة' : 'opens in a new tab'})</span>
            </a>
          ) : null}
          <button
            type="button"
            onClick={startSimilar}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#4f74ff_0%,#2e50e8_55%,#2645d6_100%)] px-5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgb(65_105_255/0.8)]"
          >
            {m.cta}
          </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
