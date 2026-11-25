'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { PlayIcon } from '@/components/ui/icons';
import { getListenerId, isUuid, readJson, writeJson } from '@/lib/client/analytics';
import { formatClock, parseTimestamp } from '@/lib/format';
import { t as format } from '@/lib/i18n';
import { PlayPauseButton, RateButton, SkipButtons, VolumeControl } from './Controls';
import { usePlayerActions, usePlayerState } from './PlayerProvider';
import type { PlayerTrack } from './PlayerProvider';
import { SeekBar } from './SeekBar';

/** Full player on an episode page. It drives the same global audio element as the mini player. */
export function EpisodePlayer({ track }: { track: PlayerTrack }) {
  const { dict } = useI18n();
  const state = usePlayerState();
  const actions = usePlayerActions();
  const isCurrent = state.track?.episodeId === track.episodeId;
  const [startAt, setStartAt] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  // Read ?t= (shared moment) and any saved position after hydration.
  useEffect(() => {
    const fromUrl = parseTimestamp(new URLSearchParams(location.search).get('t'));
    const local = actions.savedPosition(track.episodeId);
    queueMicrotask(() => {
      setStartAt(fromUrl);
      setSaved(local);
    });
    // Fall back to the position saved on the server for this browser's anonymous listener id.
    if (local === null && isUuid(track.episodeId)) {
      const listenerId = getListenerId();
      if (!listenerId) return;
      const controller = new AbortController();
      fetch(`/api/progress?listenerId=${listenerId}&episodeId=${track.episodeId}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { position: number | null; completed: boolean } | null) => {
          if (!data?.position || data.completed || data.position < 10) return;
          const map = readJson<Record<string, { t: number; d: number; at: number }>>('wared:progress', {});
          map[track.episodeId] = { t: data.position, d: track.durationSeconds ?? 0, at: Date.now() };
          writeJson('wared:progress', map);
          setSaved(data.position);
        })
        .catch(() => {});
      return () => controller.abort();
    }
  }, [actions, track.episodeId, track.durationSeconds]);

  if (!track.audioUrl) {
    return <p className="rounded-2xl border border-line p-6 text-muted">{dict.player.noAudio}</p>;
  }

  const start = (at?: number) => actions.play(track, at !== undefined ? { startAt: at } : undefined);

  return (
    <div className="rounded-[28px] border border-line p-5 sm:p-7">
      {isCurrent ? (
        <div className="flex flex-col gap-5">
          <SeekBar />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <PlayPauseButton size="lg" />
              <SkipButtons />
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <VolumeControl />
              </div>
              <RateButton />
            </div>
          </div>
          {state.error && (
            <p role="alert" className="text-sm text-accent">
              {dict.player.audioError}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => start(startAt ?? undefined)} className="btn btn-primary">
            <PlayIcon size={20} />
            {startAt !== null
              ? format(dict.player.playFrom, { time: formatClock(startAt) })
              : saved !== null
                ? format(dict.player.resumeFrom, { time: formatClock(saved) })
                : dict.common.play}
          </button>
          {(saved !== null || startAt !== null) && (
            <button type="button" onClick={() => start(0)} className="btn btn-ghost">
              {dict.player.startOver}
            </button>
          )}
          {track.durationSeconds ? (
            <span className="text-sm text-muted" dir="ltr">
              {formatClock(track.durationSeconds)}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
