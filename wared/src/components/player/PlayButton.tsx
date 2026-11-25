'use client';

import { useI18n } from '@/components/I18nProvider';
import { PauseIcon, PlayIcon } from '@/components/ui/icons';
import { usePlayerActions, usePlayerState, type PlayerTrack } from './PlayerProvider';

/** Round play/pause button for lists. Starts the episode in the persistent player. */
export function PlayButton({ track, label, size = 'md' }: { track: PlayerTrack; label: string; size?: 'md' | 'lg' }) {
  const { dict } = useI18n();
  const { track: current, playing } = usePlayerState();
  const { play, toggle } = usePlayerActions();
  const isCurrent = current?.episodeId === track.episodeId;
  const isPlaying = isCurrent && playing;
  const dims = size === 'lg' ? 'size-16' : 'size-12';
  return (
    <button
      type="button"
      onClick={() => (isCurrent ? toggle() : play(track))}
      aria-label={`${isPlaying ? dict.player.pause : dict.player.play}: ${label}`}
      className={`${dims} grid shrink-0 place-items-center rounded-full border border-line-strong transition-all duration-300 hover:border-fg hover:bg-fg hover:text-bg ${isCurrent ? 'border-fg bg-fg text-bg' : ''}`}
    >
      {isPlaying ? <PauseIcon size={size === 'lg' ? 26 : 20} /> : <PlayIcon size={size === 'lg' ? 26 : 20} />}
    </button>
  );
}
