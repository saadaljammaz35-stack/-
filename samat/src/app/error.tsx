'use client';
import { useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

/** Last-resort page when a server error escapes a screen (never shows internal details). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center bg-espresso-900 px-5 text-center text-cream-100">
      <div className="max-w-sm">
        <div className="mb-8 flex justify-center"><Logo variant="full" height={110} /></div>
        <h1 className="text-2xl font-bold">صار عندنا خلل بسيط</h1>
        <p className="mt-2 text-cream-200/80">جرّب بعد شوي، وإذا تكرر كلّمنا.</p>
        <p className="mt-4 text-sm text-cream-200/60" dir="ltr" lang="en">Something went wrong on our side. Please try again shortly.</p>
        <button type="button" onClick={reset} className="btn btn-lg btn-cream mt-8 inline-flex items-center gap-2">
          <RotateCw className="size-5" aria-hidden /> حاول مرة ثانية · Try again
        </button>
        {error.digest && <p className="num mt-6 text-xs text-cream-200/40" dir="ltr">ref {error.digest}</p>}
      </div>
    </main>
  );
}
