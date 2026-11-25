'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { formatClock } from '@/lib/format';
import { segmentIndexAt } from '@/lib/parsers/transcript';
import type { TranscriptSegment } from '@/lib/types';
import { usePlayerActions, usePlayerState, usePlayerTime, type PlayerTrack } from './PlayerProvider';

function normalize(text: string): string {
  return text
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

export function Transcript({ track, segments, lang }: { track: PlayerTrack; segments: TranscriptSegment[]; lang: 'ar' | 'en' }) {
  const { dict } = useI18n();
  const { track: current } = usePlayerState();
  const { currentTime } = usePlayerTime();
  const { play, seek } = usePlayerActions();
  const [query, setQuery] = useState('');
  const [follow, setFollow] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const listRef = useRef<HTMLOListElement>(null);
  const isCurrent = current?.episodeId === track.episodeId;
  const active = isCurrent ? segmentIndexAt(segments, currentTime) : -1;

  const visible = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    return segments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => !q || normalize(`${segment.speaker ?? ''} ${segment.text}`).includes(q));
  }, [segments, deferredQuery]);

  useEffect(() => {
    if (!follow || active < 0 || query) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [active, follow, query]);

  if (segments.length === 0) {
    return (
      <section aria-labelledby="transcript-heading">
        <h2 id="transcript-heading" className="mb-3 text-lg font-bold">
          {dict.player.transcript}
        </h2>
        <p className="text-muted">{dict.player.transcriptEmpty}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="transcript-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="transcript-heading" className="text-lg font-bold">
          {dict.player.transcript}
        </h2>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="size-4 accent-current" />
          {dict.player.transcriptFollow}
        </label>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={dict.player.transcriptSearch}
        aria-label={dict.player.transcriptSearch}
        className="field mb-2"
      />
      <ol ref={listRef} lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className="max-h-[32rem] overflow-y-auto overscroll-contain pe-2">
        {visible.map(({ segment, index }) => (
          <li key={`${segment.start}-${index}`} data-index={index}>
            <button
              type="button"
              onClick={() => (isCurrent ? seek(segment.start) : play(track, { startAt: segment.start }))}
              aria-current={index === active ? 'true' : undefined}
              className={`group flex w-full gap-4 rounded-xl px-3 py-3 text-start transition-colors hover:bg-surface ${index === active ? 'bg-surface' : ''}`}
            >
              <span className="w-14 shrink-0 pt-1 text-xs tabular-nums text-muted" dir="ltr">
                {formatClock(segment.start)}
              </span>
              <span className="flex-1 font-serif text-[1.0625rem] leading-8">
                {segment.speaker && <span className="me-2 font-sans text-sm font-bold">{segment.speaker}</span>}
                {segment.text}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
