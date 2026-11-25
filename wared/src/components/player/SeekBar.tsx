'use client';

import { useId } from 'react';
import { formatClock } from '@/lib/format';
import { useI18n } from '@/components/I18nProvider';
import { usePlayerActions, usePlayerTime } from './PlayerProvider';

export function SeekBar({ className = '', showTimes = true }: { className?: string; showTimes?: boolean }) {
  const { currentTime, duration } = usePlayerTime();
  const { seek } = usePlayerActions();
  const { dict } = useI18n();
  const id = useId();
  const max = Math.max(duration, 1);
  const progress = `${Math.min(100, (currentTime / max) * 100)}%`;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showTimes && (
        <span className="w-12 shrink-0 text-end text-xs tabular-nums text-muted" dir="ltr">
          {formatClock(currentTime)}
        </span>
      )}
      <label htmlFor={id} className="sr-only">
        {dict.player.seek}
      </label>
      <input
        id={id}
        type="range"
        className="range"
        min={0}
        max={max}
        step={1}
        value={Math.min(currentTime, max)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-valuetext={`${formatClock(currentTime)} / ${formatClock(duration)}`}
        style={{ ['--progress' as string]: progress }}
      />
      {showTimes && (
        <span className="w-12 shrink-0 text-xs tabular-nums text-muted" dir="ltr">
          {formatClock(duration)}
        </span>
      )}
    </div>
  );
}
