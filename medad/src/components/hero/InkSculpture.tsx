'use client';

import type { MotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { InkMark } from '@/components/brand/InkMark';
import type { SculptureHandle } from './sculpture/scene';

/**
 * Mounts the WebGL ink sculpture. The three.js scene is code-split and only
 * loaded after hydration, so it never delays the first paint. Without WebGL,
 * the signature SVG ink mark takes its place.
 */
export function InkSculpture({
  label,
  scroll,
  className = '',
}: {
  label: string;
  scroll?: MotionValue<number>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: SculptureHandle | null = null;
    let disposed = false;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compact = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
    const intro = document.documentElement.dataset.intro === 'play';

    // createSculpture throws when WebGL is unavailable → SVG fallback.
    import('./sculpture/scene')
      .then(({ createSculpture }) => {
        if (disposed) return;
        handle = createSculpture(canvas, { reducedMotion: reduced, compact, delay: intro ? 1.25 : 0.1 });
        if (scroll) handle.setScroll(scroll.get());
        setStatus('ready');
      })
      .catch(() => setStatus('fallback'));

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      handle?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const ro = new ResizeObserver(() => handle?.resize());
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => handle?.setActive(Boolean(entry?.isIntersecting)));
    io.observe(canvas);
    const unsub = scroll?.on('change', (v) => handle?.setScroll(v));
    const onLost = (e: Event) => {
      e.preventDefault();
      setStatus('fallback');
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      disposed = true;
      window.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('webglcontextlost', onLost);
      ro.disconnect();
      io.disconnect();
      unsub?.();
      handle?.dispose();
    };
  }, [scroll]);

  return (
    <div className={`relative ${className}`} role="img" aria-label={label}>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 size-full transition-opacity duration-[1600ms] ${
          status === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {status === 'fallback' ? (
        <div className="absolute inset-0 grid place-items-center">
          <InkMark className="float-y h-[58%] w-auto" />
        </div>
      ) : null}
    </div>
  );
}
