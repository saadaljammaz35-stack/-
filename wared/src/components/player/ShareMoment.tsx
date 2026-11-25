'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { ShareIcon } from '@/components/ui/icons';
import { sendEvent } from '@/lib/client/analytics';
import { formatClock } from '@/lib/format';
import { t as format } from '@/lib/i18n';
import { usePlayerState, usePlayerTime, type PlayerTrack } from './PlayerProvider';

/** Shares a link that opens the episode at the current moment (?t=seconds). */
export function ShareMoment({ track, url }: { track: PlayerTrack; url: string }) {
  const { dict, locale } = useI18n();
  const { track: current } = usePlayerState();
  const { currentTime } = usePlayerTime();
  const [status, setStatus] = useState<'idle' | 'copied'>('idle');
  const at = current?.episodeId === track.episodeId ? Math.floor(currentTime) : 0;

  const share = async () => {
    const link = at > 0 ? `${url}?t=${at}` : url;
    sendEvent({ type: 'share', episodeId: track.episodeId, value: at, locale });
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: track.title, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 2400);
    } catch {
      // The user dismissed the share sheet or clipboard access was denied.
    }
  };

  return (
    <button type="button" onClick={share} className="btn btn-ghost">
      <ShareIcon size={18} />
      <span aria-live="polite">
        {status === 'copied' ? dict.common.copied : at > 0 ? format(dict.player.shareFrom, { time: formatClock(at) }) : dict.player.shareMoment}
      </span>
    </button>
  );
}
