// Plays single verses cut out of a surah recording by the Quran.com timings — for comparing
// reciters and for the listening review. It has its own player, so it never fights the main one.
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { getChapterAudio } from '@/data/remote';

import { isDownloaded, surahFile } from './downloads';

export type ClipEnd = 'ended' | 'stopped';

type Pending = { from: number; to: number; done: (r: ClipEnd) => void };

function waitLoaded(player: AudioPlayer, timeoutMs = 15000): Promise<void> {
  if (player.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(finish, timeoutMs);
    const sub = player.addListener('playbackStatusUpdate', (s: AudioStatus) => {
      if (s.isLoaded) finish();
    });
    function finish() {
      clearTimeout(timer);
      sub.remove();
      resolve();
    }
  });
}

export function useVerseClip() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const uriRef = useRef<string | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const tokenRef = useRef(0);

  useEffect(
    () => () => {
      pendingRef.current?.done('stopped');
      pendingRef.current = null;
      playerRef.current?.remove();
      playerRef.current = null;
      uriRef.current = null;
    },
    [],
  );

  const stop = useCallback(() => {
    tokenRef.current += 1;
    playerRef.current?.pause();
    const p = pendingRef.current;
    pendingRef.current = null;
    p?.done('stopped');
  }, []);

  /** Plays one verse and resolves when it ends, or when it is stopped or replaced. */
  const play = useCallback(
    async (reciterId: number, surah: number, ayah: number, opts: { volume?: number; onStart?: () => void } = {}): Promise<ClipEnd> => {
      stop();
      const token = tokenRef.current;
      const audio = await getChapterAudio(reciterId, surah);
      const timing = audio.timings.find((x) => x.ayah === ayah);
      if (!timing) throw new Error('no timing for this verse');
      if (token !== tokenRef.current) return 'stopped';
      if (!playerRef.current) {
        const p = createAudioPlayer(null, { updateInterval: 100 });
        p.addListener('playbackStatusUpdate', (s: AudioStatus) => {
          const e = pendingRef.current;
          if (!e) return;
          const ms = s.currentTime * 1000;
          // A status from before the seek can still arrive; only a time inside this verse counts.
          if (s.didJustFinish || (ms >= e.to - 60 && ms >= e.from && ms <= e.to + 2000)) {
            p.pause();
            pendingRef.current = null;
            e.done('ended');
          }
        });
        playerRef.current = p;
      }
      const player = playerRef.current;
      const uri = isDownloaded(reciterId, surah) ? surahFile(reciterId, surah).uri : audio.url;
      if (uriRef.current !== uri) {
        player.replace({ uri });
        uriRef.current = uri;
        await waitLoaded(player);
      }
      await player.seekTo(timing.from / 1000);
      if (token !== tokenRef.current) return 'stopped';
      player.volume = opts.volume ?? 1;
      return new Promise<ClipEnd>((resolve) => {
        pendingRef.current = { from: timing.from, to: timing.to, done: resolve };
        player.play();
        opts.onStart?.();
      });
    },
    [stop],
  );

  return useMemo(() => ({ play, stop }), [play, stop]);
}

/** How long a verse lasts in a reciter's recording, in milliseconds. */
export async function verseDuration(reciterId: number, surah: number, ayah: number): Promise<number> {
  const audio = await getChapterAudio(reciterId, surah);
  const t = audio.timings.find((x) => x.ayah === ayah);
  return t ? Math.max(0, t.to - t.from) : 0;
}
