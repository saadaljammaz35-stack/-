// One app-wide audio player: Quran recitation (with verse tracking, verse/range repeat for
// memorisation and speed control), live radio, and short dhikr clips. Keeps playing in the
// background with lock-screen controls.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { getSurahs } from '@/data/content';
import { getChapterAudio, RECITERS, type ChapterAudio } from '@/data/remote';
import { useSettings } from '@/store/settings';
import { mediaNeedsCors } from '@/features/web-isolation';
import { wordAt } from '@/lib/recitation';

import { isDownloaded, surahFile } from './downloads';

export type RepeatMode =
  | { kind: 'off' }
  | { kind: 'ayah'; times: number }
  | { kind: 'range'; from: number; to: number; times: number };

export type NowPlaying =
  | { kind: 'quran'; surah: number; surahName: string; reciterId: number; reciterName: string; ayah: number | null; offline: boolean }
  | { kind: 'stream'; title: string; subtitle: string; url: string }
  | { kind: 'clip'; title: string; url: string };

type PlayerState = {
  now: NowPlaying | null;
  playing: boolean;
  buffering: boolean;
  error: string | null;
  repeat: RepeatMode;
};

type PlayerProgress = {
  position: number;
  duration: number;
  /** Position (in the verse) of the word being recited, when the recording has word timings. */
  word: number | null;
};

/**
 * Playback progress changes several times a second, so it lives outside the player context:
 * only the screens that show it (the player, the word highlight) re-render on each tick.
 */
const useProgress = create<PlayerProgress>(() => ({ position: 0, duration: 0, word: null }));
export const usePlayerProgress = () => useProgress(useShallow((s) => ({ position: s.position, duration: s.duration })));
export const usePlayerWord = () => useProgress((s) => s.word);

type PlayerApi = PlayerState & {
  playSurah: (surah: number, startAyah?: number) => Promise<void>;
  playStream: (url: string, title: string, subtitle: string) => void;
  playClip: (url: string, title: string) => void;
  toggle: () => void;
  stop: () => void;
  stepAyah: (delta: number) => void;
  seekAyah: (ayah: number) => void;
  setRepeat: (r: RepeatMode) => void;
  setRate: (rate: number) => void;
};

const PlayerContext = createContext<PlayerApi | null>(null);

export function ayahAt(timings: ChapterAudio['timings'], ms: number): number | null {
  for (const t of timings) if (ms >= t.from && ms < t.to) return t.ayah;
  return null;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const audioRef = useRef<ChapterAudio | null>(null);
  const repeatRef = useRef<RepeatMode>({ kind: 'off' });
  const repeatCountRef = useRef(0);
  const nowRef = useRef<NowPlaying | null>(null);
  const [state, setState] = useState<PlayerState>({
    now: null,
    playing: false,
    buffering: false,
    error: null,
    repeat: { kind: 'off' },
  });
  const rate = useSettings((s) => s.playbackRate);

  const getPlayer = useCallback(() => {
    if (!playerRef.current) {
      // Frequent enough for the word-by-word highlight to keep up with the reciter.
      const p = createAudioPlayer(null, { updateInterval: 120, ...(mediaNeedsCors() ? { crossOrigin: 'anonymous' as const } : {}) });
      p.addListener('playbackStatusUpdate', (status: AudioStatus) => onStatus(status));
      playerRef.current = p;
      setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => undefined);
    }
    return playerRef.current;
  }, []);

  function onStatus(status: AudioStatus) {
    const player = playerRef.current;
    if (!player) return;
    const ms = status.currentTime * 1000;
    const audio = audioRef.current;
    const now = nowRef.current;
    let word: number | null = null;
    if (now?.kind === 'quran' && audio) {
      const ayah = ayahAt(audio.timings, ms);
      const r = repeatRef.current;
      // Verse repeat: jump back to the start of the verse (or range) until done.
      if (r.kind === 'ayah' && now.ayah != null) {
        const t = audio.timings.find((x) => x.ayah === now.ayah);
        if (t && ms >= t.to - 120) {
          if (repeatCountRef.current + 1 < r.times) {
            repeatCountRef.current += 1;
            player.seekTo(t.from / 1000);
            return;
          }
          repeatCountRef.current = 0;
        }
      } else if (r.kind === 'range') {
        const end = audio.timings.find((x) => x.ayah === r.to);
        const start = audio.timings.find((x) => x.ayah === r.from);
        if (end && start && ms >= end.to - 120) {
          if (repeatCountRef.current + 1 < r.times) {
            repeatCountRef.current += 1;
            player.seekTo(start.from / 1000);
          } else {
            repeatCountRef.current = 0;
            player.pause();
          }
          return;
        }
      }
      if (ayah != null && ayah !== now.ayah) {
        nowRef.current = { ...now, ayah };
        player.updateLockScreenMetadata({ title: `سورة ${now.surahName} — آية ${ayah}`, artist: now.reciterName, albumTitle: 'مع الله' });
      }
      word = wordAt(audio.timings, ayah, ms);
    }
    useProgress.setState({ position: status.currentTime, duration: status.duration, word });
    const error = status.error ?? null;
    // Keep the same state object when nothing the context carries has changed.
    setState((s) =>
      s.now === nowRef.current && s.playing === status.playing && s.buffering === status.isBuffering && s.error === error
        ? s
        : { ...s, now: nowRef.current, playing: status.playing, buffering: status.isBuffering, error },
    );
  }

  useEffect(() => {
    playerRef.current?.setPlaybackRate(rate);
  }, [rate]);

  useEffect(
    () => () => {
      playerRef.current?.remove();
      playerRef.current = null;
    },
    [],
  );

  const start = useCallback(
    (source: string, now: NowPlaying, startSeconds = 0) => {
      const player = getPlayer();
      nowRef.current = now;
      player.replace({ uri: source });
      if (startSeconds > 0) player.seekTo(startSeconds);
      player.setPlaybackRate(now.kind === 'quran' ? useSettings.getState().playbackRate : 1);
      const title = now.kind === 'quran' ? `سورة ${now.surahName}` : now.title;
      const artist = now.kind === 'quran' ? now.reciterName : now.kind === 'stream' ? now.subtitle : 'مع الله';
      player.setActiveForLockScreen(true, { title, artist, albumTitle: 'مع الله' });
      player.play();
      setState((s) => ({ ...s, now, error: null, playing: true }));
    },
    [getPlayer],
  );

  const playSurah = useCallback(
    async (surah: number, startAyah?: number) => {
      const reciterId = useSettings.getState().reciterId;
      const reciter = RECITERS.find((r) => r.id === reciterId) ?? RECITERS[0];
      const surahName = (await getSurahs())[surah - 1].name;
      try {
        const audio = await getChapterAudio(reciter.id, surah);
        audioRef.current = audio;
        repeatCountRef.current = 0;
        const offline = isDownloaded(reciter.id, surah);
        const source = offline ? surahFile(reciter.id, surah).uri : audio.url;
        const t = startAyah ? audio.timings.find((x) => x.ayah === startAyah) : null;
        start(
          source,
          { kind: 'quran', surah, surahName, reciterId: reciter.id, reciterName: reciter.name, ayah: startAyah ?? 1, offline },
          t ? t.from / 1000 : 0,
        );
      } catch (err) {
        setState((s) => ({ ...s, error: (err as Error).message === 'offline' ? 'offline' : 'load-failed' }));
      }
    },
    [start],
  );

  const api = useMemo<PlayerApi>(
    () => ({
      ...state,
      playSurah,
      playStream: (url, title, subtitle) => {
        audioRef.current = null;
        start(url, { kind: 'stream', title, subtitle, url });
      },
      playClip: (url, title) => {
        audioRef.current = null;
        start(url, { kind: 'clip', title, url });
      },
      toggle: () => {
        const p = playerRef.current;
        if (!p) return;
        if (p.playing) p.pause();
        else p.play();
      },
      stop: () => {
        const p = playerRef.current;
        if (!p) return;
        p.pause();
        p.setActiveForLockScreen(false);
        nowRef.current = null;
        audioRef.current = null;
        setState((s) => ({ ...s, now: null, playing: false }));
      },
      stepAyah: (delta) => {
        const audio = audioRef.current;
        const now = nowRef.current;
        if (!audio || now?.kind !== 'quran' || now.ayah == null) return;
        const target = audio.timings.find((x) => x.ayah === now.ayah! + delta);
        if (target) {
          repeatCountRef.current = 0;
          playerRef.current?.seekTo(target.from / 1000);
        }
      },
      seekAyah: (ayah) => {
        const target = audioRef.current?.timings.find((x) => x.ayah === ayah);
        if (target) {
          repeatCountRef.current = 0;
          playerRef.current?.seekTo(target.from / 1000);
          playerRef.current?.play();
        }
      },
      setRepeat: (r) => {
        repeatRef.current = r;
        repeatCountRef.current = 0;
        setState((s) => ({ ...s, repeat: r }));
      },
      setRate: (r) => useSettings.getState().set({ playbackRate: r }),
    }),
    [state, playSurah, start],
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
