'use client';
import { useEffect, useRef, useState } from 'react';
import { BellRing, Volume2, VolumeX } from 'lucide-react';
import { LiveRefresh } from './LiveRefresh';

/** A short two-tone chime generated with WebAudio (no audio files to load). */
export function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch { /* audio blocked until the first user interaction */ }
}

export function useSoundPref(key: string): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => { try { setOn(localStorage.getItem(key) !== 'off'); } catch { /* ignore */ } }, [key]);
  return [on, (v: boolean) => { setOn(v); try { localStorage.setItem(key, v ? 'on' : 'off'); } catch { /* ignore */ } }];
}

/** Watches for orders entering a given status; chimes + shows a banner. */
export function OrderAlert({ watch, label, onLabel, offLabel, storageKey }: { watch: string; label: string; onLabel: string; offLabel: string; storageKey: string }) {
  const [sound, setSound] = useSoundPref(storageKey);
  const [flash, setFlash] = useState<number | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  return (
    <>
      <LiveRefresh everyMs={20000} onEvent={(p) => {
        if (p.new?.status === watch) {
          setFlash(Number(p.new.order_number));
          if (soundRef.current) chime();
          if ('vibrate' in navigator) navigator.vibrate?.(200);
          setTimeout(() => setFlash(null), 6000);
        }
      }} />
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setSound(!sound); if (!sound) chime(); }} aria-pressed={sound} data-testid="sound-toggle">
        {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} {sound ? onLabel : offLabel}
      </button>
      {flash !== null && (
        <div role="alert" className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md animate-pop items-center gap-3 rounded-2xl bg-terracotta-500 px-4 py-3 font-bold text-white shadow-lift">
          <BellRing className="size-5 animate-bounce" /> {label} <span className="num">#{flash}</span>
        </div>
      )}
    </>
  );
}
