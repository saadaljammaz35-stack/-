import { MARK_PATH, MARK_VIEWBOX } from '@/components/brand/paths';
import { IntroDone } from './IntroDone';

/**
 * Opening transition: the MEDAD mark is written like a stroke of ink, then
 * the curtain lifts. Pure CSS so it never blocks on hydration, shown once per
 * session and skipped entirely with reduced motion (see the inline script in
 * the root layout).
 */
export function Intro({ label }: { label: string }) {
  return (
    <div className="intro" aria-hidden="true">
      <IntroDone />
      <div className="intro__mark flex flex-col items-center gap-7">
        <svg viewBox={MARK_VIEWBOX} className="h-24 w-auto overflow-visible sm:h-28">
          <defs>
            <mask id="intro-brush" maskUnits="userSpaceOnUse">
              <path
                className="intro__brush"
                d="M52 430 L52 30 L207 228 L362 30 L362 430"
                pathLength={1}
                fill="none"
                stroke="#fff"
                strokeWidth="150"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                className="intro__brush"
                style={{ animationDelay: '0.45s' }}
                d="M207 120 L207 430"
                pathLength={1}
                fill="none"
                stroke="#fff"
                strokeWidth="160"
                strokeLinecap="round"
              />
            </mask>
            <linearGradient id="intro-ink" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#9DB8FF" />
            </linearGradient>
          </defs>
          <path d={MARK_PATH} fillRule="evenodd" fill="url(#intro-ink)" mask="url(#intro-brush)" />
          <path
            className="intro__tip ink-glow"
            d="M52 430 L52 30 L207 228 L362 30 L362 430"
            pathLength={1}
            fill="none"
            stroke="#9DB8FF"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex w-64 flex-col items-center gap-3">
          <span className="font-latin text-[0.68rem] tracking-[0.22em] whitespace-nowrap text-cool uppercase" dir="ltr" lang="en">
            {label}
          </span>
          <span className="block h-px w-full overflow-hidden bg-white/10">
            <span className="intro__bar block h-full w-full bg-gradient-to-r from-electric to-icy" />
          </span>
        </div>
      </div>
    </div>
  );
}
