'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getListenerId, isUuid, readJson, sendEvent, writeJson } from '@/lib/client/analytics';
import { chapterIndexAt } from '@/lib/parsers/chapters';
import type { Chapter } from '@/lib/types';

export interface PlayerTrack {
  episodeId: string;
  slug: string;
  title: string;
  programTitle: string;
  audioUrl: string;
  artworkUrl: string | null;
  durationSeconds: number | null;
  chapters: Chapter[];
  locale: 'ar' | 'en';
}

interface PlayerState {
  track: PlayerTrack | null;
  playing: boolean;
  buffering: boolean;
  error: boolean;
  rate: number;
  volume: number;
  muted: boolean;
}

interface PlayerTime {
  currentTime: number;
  duration: number;
}

interface PlayerActions {
  play: (track?: PlayerTrack, options?: { startAt?: number }) => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  skip: (delta: number) => void;
  setRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  close: () => void;
  savedPosition: (episodeId: string) => number | null;
}

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const PROGRESS_KEY = 'wared:progress';
const PLAYER_KEY = 'wared:player';
const SERVER_SYNC_MS = 15_000;

type ProgressMap = Record<string, { t: number; d: number; at: number }>;

const StateContext = createContext<PlayerState | null>(null);
const TimeContext = createContext<PlayerTime>({ currentTime: 0, duration: 0 });
const ActionsContext = createContext<PlayerActions | null>(null);

export function usePlayerState(): PlayerState {
  const value = useContext(StateContext);
  if (!value) throw new Error('usePlayerState must be used inside <PlayerProvider>');
  return value;
}

export function usePlayerTime(): PlayerTime {
  return useContext(TimeContext);
}

export function usePlayerActions(): PlayerActions {
  const value = useContext(ActionsContext);
  if (!value) throw new Error('usePlayerActions must be used inside <PlayerProvider>');
  return value;
}

function readProgress(): ProgressMap {
  return readJson<ProgressMap>(PROGRESS_KEY, {});
}

function storeProgress(episodeId: string, t: number, d: number) {
  const map = readProgress();
  map[episodeId] = { t: Math.floor(t), d: Math.floor(d), at: Date.now() };
  const entries = Object.entries(map).sort((a, b) => b[1].at - a[1].at).slice(0, 200);
  writeJson(PROGRESS_KEY, Object.fromEntries(entries));
}

/** Position worth resuming from: not the first seconds, not the last ones. */
function resumable(entry: ProgressMap[string] | undefined): number | null {
  if (!entry) return null;
  if (entry.t < 10) return null;
  if (entry.d > 0 && entry.t > entry.d - 15) return null;
  return entry.t;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<PlayerTrack | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const lastSaved = useRef(0);
  const lastSynced = useRef(0);
  const lastPositionState = useRef(0);
  const startedEpisodes = useRef(new Set<string>());
  const quartiles = useRef(new Map<string, Set<number>>());

  const [state, setState] = useState<PlayerState>({
    track: null,
    playing: false,
    buffering: false,
    error: false,
    rate: 1,
    volume: 1,
    muted: false,
  });
  const [time, setTime] = useState<PlayerTime>({ currentTime: 0, duration: 0 });

  const syncServer = useCallback((completed = false) => {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track || !isUuid(track.episodeId)) return;
    const listenerId = getListenerId();
    if (!listenerId) return;
    lastSynced.current = Date.now();
    void fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        listenerId,
        episodeId: track.episodeId,
        position: Math.floor(audio.currentTime),
        duration: Number.isFinite(audio.duration) ? Math.floor(audio.duration) : undefined,
        completed,
      }),
    }).catch(() => {});
  }, []);

  const persist = useCallback((force = false) => {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track) return;
    const now = Date.now();
    if (!force && now - lastSaved.current < 5000) return;
    lastSaved.current = now;
    storeProgress(track.episodeId, audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : track.durationSeconds ?? 0);
  }, []);

  const setMediaSession = useCallback((track: PlayerTrack) => {
    if (!('mediaSession' in navigator)) return;
    const artwork = track.artworkUrl
      ? [{ src: new URL(track.artworkUrl, location.href).href, sizes: '512x512', type: track.artworkUrl.endsWith('.png') ? 'image/png' : 'image/jpeg' }]
      : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.programTitle,
      album: track.locale === 'ar' ? 'وارد' : 'Wared',
      artwork,
    });
  }, []);

  const loadTrack = useCallback(
    (track: PlayerTrack, startAt: number | null) => {
      const audio = audioRef.current;
      if (!audio) return;
      trackRef.current = track;
      pendingSeek.current = startAt;
      audio.src = track.audioUrl;
      audio.load();
      setState((s) => ({ ...s, track, error: false, buffering: true }));
      setTime({ currentTime: startAt ?? 0, duration: track.durationSeconds ?? 0 });
      setMediaSession(track);
      writeJson(PLAYER_KEY, { track, rate: audio.playbackRate, volume: audio.volume, muted: audio.muted });
    },
    [setMediaSession],
  );

  const actions = useMemo<PlayerActions>(() => {
    const get = () => audioRef.current;
    const seek = (seconds: number) => {
      const audio = get();
      if (!audio) return;
      const max = Number.isFinite(audio.duration) ? audio.duration : seconds;
      const target = Math.min(Math.max(0, seconds), max);
      if (audio.readyState >= 1) audio.currentTime = target;
      else pendingSeek.current = target;
      setTime((t) => ({ ...t, currentTime: target }));
      persist(true);
    };
    return {
      play(track, options) {
        const audio = get();
        if (!audio) return;
        if (track && track.episodeId !== trackRef.current?.episodeId) {
          persist(true);
          const saved = resumable(readProgress()[track.episodeId]);
          loadTrack(track, options?.startAt ?? saved);
        } else if (options?.startAt !== undefined) {
          if (audio.readyState >= 1) audio.currentTime = options.startAt;
          else pendingSeek.current = options.startAt;
        }
        void audio.play().catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'NotAllowedError') return;
          setState((s) => ({ ...s, error: true, playing: false }));
        });
      },
      pause() {
        get()?.pause();
      },
      toggle() {
        const audio = get();
        if (!audio || !trackRef.current) return;
        if (audio.paused) void audio.play().catch(() => setState((s) => ({ ...s, playing: false })));
        else audio.pause();
      },
      seek,
      skip(delta) {
        const audio = get();
        if (!audio) return;
        seek(audio.currentTime + delta);
      },
      setRate(rate) {
        const audio = get();
        if (!audio) return;
        audio.playbackRate = rate;
        audio.defaultPlaybackRate = rate;
      },
      setVolume(volume) {
        const audio = get();
        if (!audio) return;
        audio.volume = Math.min(1, Math.max(0, volume));
        if (audio.volume > 0 && audio.muted) audio.muted = false;
      },
      toggleMute() {
        const audio = get();
        if (audio) audio.muted = !audio.muted;
      },
      close() {
        const audio = get();
        persist(true);
        syncServer();
        if (audio) {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        }
        trackRef.current = null;
        setState((s) => ({ ...s, track: null, playing: false, buffering: false, error: false }));
        setTime({ currentTime: 0, duration: 0 });
        writeJson(PLAYER_KEY, null);
        if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
      },
      savedPosition(episodeId) {
        return resumable(readProgress()[episodeId]);
      },
    };
  }, [loadTrack, persist, syncServer]);

  // Audio element events.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      const track = trackRef.current;
      const current = audio.currentTime;
      const duration = Number.isFinite(audio.duration) ? audio.duration : track?.durationSeconds ?? 0;
      setTime({ currentTime: current, duration });
      persist();
      if (!audio.paused && Date.now() - lastSynced.current > SERVER_SYNC_MS) syncServer();
      if ('mediaSession' in navigator && duration > 0 && Date.now() - lastPositionState.current > 1000) {
        lastPositionState.current = Date.now();
        try {
          navigator.mediaSession.setPositionState({ duration, position: Math.min(current, duration), playbackRate: audio.playbackRate });
        } catch {
          // Some browsers reject position state while metadata is loading.
        }
      }
      if (track && duration > 0) {
        const pct = (current / duration) * 100;
        const seen = quartiles.current.get(track.episodeId) ?? new Set<number>();
        for (const q of [25, 50, 75]) {
          if (pct >= q && !seen.has(q)) {
            seen.add(q);
            sendEvent({ type: 'play_progress', episodeId: track.episodeId, value: q, locale: track.locale });
          }
        }
        if (pct >= 95 && !seen.has(100)) {
          seen.add(100);
          sendEvent({ type: 'play_complete', episodeId: track.episodeId, locale: track.locale });
          syncServer(true);
        }
        quartiles.current.set(track.episodeId, seen);
      }
    };
    const onMeta = () => {
      if (pendingSeek.current !== null) {
        audio.currentTime = Math.min(pendingSeek.current, Number.isFinite(audio.duration) ? audio.duration : pendingSeek.current);
        pendingSeek.current = null;
      }
      onTime();
    };
    const onPlay = () => {
      setState((s) => ({ ...s, playing: true, error: false }));
      const track = trackRef.current;
      if (track && !startedEpisodes.current.has(track.episodeId)) {
        startedEpisodes.current.add(track.episodeId);
        sendEvent({ type: 'play_start', episodeId: track.episodeId, locale: track.locale, path: location.pathname });
      }
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    };
    const onPause = () => {
      setState((s) => ({ ...s, playing: false }));
      persist(true);
      syncServer();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    };
    const onWaiting = () => setState((s) => ({ ...s, buffering: true }));
    const onPlaying = () => setState((s) => ({ ...s, buffering: false }));
    const onCanPlay = () => setState((s) => ({ ...s, buffering: false }));
    const onError = () => {
      if (!audio.getAttribute('src')) return;
      setState((s) => ({ ...s, error: true, playing: false, buffering: false }));
    };
    const onRate = () => {
      setState((s) => ({ ...s, rate: audio.playbackRate }));
      writeJson(PLAYER_KEY, { track: trackRef.current, rate: audio.playbackRate, volume: audio.volume, muted: audio.muted });
    };
    const onVolume = () => {
      setState((s) => ({ ...s, volume: audio.volume, muted: audio.muted }));
      writeJson(PLAYER_KEY, { track: trackRef.current, rate: audio.playbackRate, volume: audio.volume, muted: audio.muted });
    };
    const onEnded = () => {
      persist(true);
      setState((s) => ({ ...s, playing: false }));
    };
    const onPageHide = () => {
      persist(true);
      syncServer();
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);
    audio.addEventListener('ratechange', onRate);
    audio.addEventListener('volumechange', onVolume);
    audio.addEventListener('ended', onEnded);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ratechange', onRate);
      audio.removeEventListener('volumechange', onVolume);
      audio.removeEventListener('ended', onEnded);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [persist, syncServer]);

  // Media Session action handlers (lock screen, headphones, car controls).
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Unsupported action in this browser.
      }
    };
    set('play', () => actions.toggle());
    set('pause', () => actions.pause());
    set('seekbackward', (d) => actions.skip(-(d.seekOffset ?? 15)));
    set('seekforward', (d) => actions.skip(d.seekOffset ?? 15));
    set('seekto', (d) => {
      if (d.seekTime !== undefined) actions.seek(d.seekTime);
    });
    set('previoustrack', () => {
      const chapters = trackRef.current?.chapters ?? [];
      if (!audio || chapters.length === 0) return actions.seek(0);
      const index = chapterIndexAt(chapters, audio.currentTime - 3);
      actions.seek(chapters[Math.max(0, index)]?.startSeconds ?? 0);
    });
    set('nexttrack', () => {
      const chapters = trackRef.current?.chapters ?? [];
      if (!audio || chapters.length === 0) return;
      const next = chapters[chapterIndexAt(chapters, audio.currentTime) + 1];
      if (next) actions.seek(next.startSeconds);
    });
    return () => {
      for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'] as MediaSessionAction[]) {
        set(action, null);
      }
    };
  }, [actions]);

  // Restore the last track (paused) after a reload.
  useEffect(() => {
    const audio = audioRef.current;
    const saved = readJson<{ track: PlayerTrack | null; rate?: number; volume?: number; muted?: boolean } | null>(PLAYER_KEY, null);
    if (!audio || !saved) return;
    if (saved.rate && PLAYBACK_RATES.includes(saved.rate as (typeof PLAYBACK_RATES)[number])) {
      audio.playbackRate = saved.rate;
      audio.defaultPlaybackRate = saved.rate;
    }
    if (typeof saved.volume === 'number') audio.volume = Math.min(1, Math.max(0, saved.volume));
    if (saved.muted) audio.muted = true;
    if (saved.track?.audioUrl) {
      const position = readProgress()[saved.track.episodeId]?.t ?? null;
      // Deferred so the restore does not cascade renders during hydration.
      queueMicrotask(() => loadTrack(saved.track!, position));
    }
  }, [loadTrack]);

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>
        <TimeContext.Provider value={time}>
          {children}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions are the on-page transcript */}
          <audio ref={audioRef} preload="metadata" className="hidden" />
        </TimeContext.Provider>
      </StateContext.Provider>
    </ActionsContext.Provider>
  );
}
