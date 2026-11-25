'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useI18n } from '@/components/I18nProvider';
import { CloseIcon } from '@/components/ui/icons';
import { formatClock } from '@/lib/format';
import { chapterIndexAt } from '@/lib/parsers/chapters';
import { pick } from '@/lib/i18n/config';
import { PlayPauseButton, RateButton, SkipButtons, VolumeControl } from './Controls';
import { usePlayerActions, usePlayerState, usePlayerTime } from './PlayerProvider';
import { SeekBar } from './SeekBar';

/** Persistent mini player. Lives in the locale layout, so playback continues across page navigations. */
export function PlayerBar() {
  const { track, error } = usePlayerState();
  const { currentTime, duration } = usePlayerTime();
  const { close } = usePlayerActions();
  const { dict, locale } = useI18n();
  const reduce = useReducedMotion();

  const chapter = track ? track.chapters[chapterIndexAt(track.chapters, currentTime)] : undefined;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <AnimatePresence>
      {track && (
        <motion.section
          key="player"
          aria-label={dict.player.nowPlaying}
          initial={reduce ? false : { y: '100%' }}
          animate={{ y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-bg/80"
        >
          {/* Thin progress line for the compact (mobile) layout. */}
          <div className="h-0.5 w-full bg-line md:hidden" aria-hidden="true">
            <div className="h-full bg-fg" style={{ width: `${progress}%` }} />
          </div>
          <div className="container-page flex items-center gap-3 py-2.5 md:gap-6 md:py-3">
            <PlayPauseButton size="sm" />
            <div className="hidden items-center md:flex">
              <SkipButtons compact />
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/${locale}/episodes/${track.slug}`}
                className="block truncate text-sm font-medium hover:underline"
                aria-label={`${dict.player.expand}: ${track.title}`}
              >
                {track.title}
              </Link>
              <p className="truncate text-xs text-muted">
                {error ? dict.player.audioError : chapter ? pick(locale, chapter.title, chapter.titleEn) : track.programTitle}
                <span className="md:hidden" dir="ltr">
                  {' · '}
                  {formatClock(currentTime)}
                </span>
              </p>
            </div>
            <SeekBar className="hidden flex-[1.4] md:flex" />
            <div className="hidden items-center gap-2 lg:flex">
              <VolumeControl />
            </div>
            <div className="flex items-center md:hidden">
              <SkipButtons compact />
            </div>
            <div className="hidden sm:block">
              <RateButton />
            </div>
            <button
              type="button"
              onClick={close}
              className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
              aria-label={dict.player.close}
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/** Reserves space at the bottom of the page so the fixed player never covers the footer. */
export function PlayerSpacer() {
  const { track } = usePlayerState();
  return track ? <div aria-hidden="true" className="h-20 pb-[env(safe-area-inset-bottom)]" /> : null;
}
