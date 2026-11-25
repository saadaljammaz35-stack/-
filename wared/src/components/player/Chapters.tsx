'use client';

import { useI18n } from '@/components/I18nProvider';
import { formatClock } from '@/lib/format';
import { pick } from '@/lib/i18n/config';
import { chapterIndexAt } from '@/lib/parsers/chapters';
import type { Chapter } from '@/lib/types';
import { usePlayerActions, usePlayerState, usePlayerTime, type PlayerTrack } from './PlayerProvider';

export function Chapters({ track, chapters }: { track: PlayerTrack; chapters: Chapter[] }) {
  const { dict, locale } = useI18n();
  const { track: current } = usePlayerState();
  const { currentTime } = usePlayerTime();
  const { play, seek } = usePlayerActions();
  const isCurrent = current?.episodeId === track.episodeId;
  const active = isCurrent ? chapterIndexAt(chapters, currentTime) : -1;

  if (chapters.length === 0) return null;
  return (
    <section aria-labelledby="chapters-heading">
      <h2 id="chapters-heading" className="mb-4 text-lg font-bold">
        {dict.player.chapters}
      </h2>
      <ol className="divide-y divide-line border-y border-line">
        {chapters.map((chapter, index) => (
          <li key={chapter.startSeconds}>
            <button
              type="button"
              onClick={() => (isCurrent ? seek(chapter.startSeconds) : play(track, { startAt: chapter.startSeconds }))}
              aria-current={index === active ? 'true' : undefined}
              className={`flex w-full items-baseline gap-4 py-3.5 text-start transition-colors hover:text-fg ${index === active ? 'text-fg' : 'text-muted'}`}
            >
              <span className="w-16 shrink-0 text-sm tabular-nums" dir="ltr">
                {formatClock(chapter.startSeconds)}
              </span>
              <span className={`flex-1 ${index === active ? 'font-medium' : ''}`}>{pick(locale, chapter.title, chapter.titleEn)}</span>
              {index === active && <span className="size-2 shrink-0 self-center rounded-full bg-sand" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
