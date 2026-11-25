'use client';

import { useI18n } from '@/components/I18nProvider';
import { Back15Icon, Forward15Icon, MuteIcon, PauseIcon, PlayIcon, VolumeIcon } from '@/components/ui/icons';
import { PLAYBACK_RATES, usePlayerActions, usePlayerState } from './PlayerProvider';

export function PlayPauseButton({ size = 'md', onPlay }: { size?: 'sm' | 'md' | 'lg'; onPlay?: () => void }) {
  const { playing, buffering } = usePlayerState();
  const { toggle } = usePlayerActions();
  const { dict } = useI18n();
  const dims = size === 'lg' ? 'size-16' : size === 'sm' ? 'size-10' : 'size-12';
  const icon = size === 'lg' ? 28 : size === 'sm' ? 18 : 22;
  return (
    <button
      type="button"
      onClick={onPlay ?? toggle}
      aria-label={playing ? dict.player.pause : dict.player.play}
      className={`${dims} grid shrink-0 place-items-center rounded-full bg-fg text-bg transition-transform duration-200 active:scale-95 ${buffering && playing ? 'animate-pulse' : ''}`}
    >
      {playing ? <PauseIcon size={icon} /> : <PlayIcon size={icon} />}
    </button>
  );
}

export function SkipButtons({ compact = false }: { compact?: boolean }) {
  const { skip } = usePlayerActions();
  const { dict } = useI18n();
  const cls = `grid ${compact ? 'size-10' : 'size-12'} place-items-center rounded-full text-fg transition-colors hover:bg-surface`;
  return (
    <>
      <button type="button" className={cls} onClick={() => skip(-15)} aria-label={dict.player.back15}>
        <Back15Icon size={compact ? 22 : 26} />
      </button>
      <button type="button" className={cls} onClick={() => skip(15)} aria-label={dict.player.forward15}>
        <Forward15Icon size={compact ? 22 : 26} />
      </button>
    </>
  );
}

export function RateButton() {
  const { rate } = usePlayerState();
  const { setRate } = usePlayerActions();
  const { dict } = useI18n();
  const next = () => {
    const index = PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]);
    setRate(PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length] ?? 1);
  };
  return (
    <button
      type="button"
      onClick={next}
      className="h-10 min-w-14 rounded-full border border-line px-3 text-sm tabular-nums transition-colors hover:border-line-strong"
      aria-label={`${dict.player.speed}: ${rate}×`}
      dir="ltr"
    >
      {rate}×
    </button>
  );
}

export function VolumeControl() {
  const { volume, muted } = usePlayerState();
  const { setVolume, toggleMute } = usePlayerActions();
  const { dict } = useI18n();
  const level = muted ? 0 : volume;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleMute}
        className="grid size-10 place-items-center rounded-full hover:bg-surface"
        aria-label={muted ? dict.player.unmute : dict.player.mute}
        aria-pressed={muted}
      >
        {muted || volume === 0 ? <MuteIcon size={20} /> : <VolumeIcon size={20} />}
      </button>
      <input
        type="range"
        className="range w-24"
        min={0}
        max={1}
        step={0.05}
        value={level}
        aria-label={dict.player.volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        style={{ ['--progress' as string]: `${level * 100}%` }}
      />
    </div>
  );
}
