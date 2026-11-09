import { useId } from 'react';
import { MARK_PATH, MARK_VIEWBOX } from './paths';

/**
 * The signature 2D "digital ink" mark: the MEDAD M as translucent glass,
 * its contours traced by illuminated ink that keeps flowing along the logo.
 * Animation is CSS-only; `drawn` toggles the contour drawing.
 */
export function InkMark({
  className = '',
  drawn = true,
  flow = true,
}: {
  className?: string;
  drawn?: boolean;
  flow?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true" focusable="false" overflow="visible">
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#9DB8FF" stopOpacity="0.18" />
          <stop offset="1" stopColor="#4169FF" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`${id}-ink`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#9DB8FF" />
          <stop offset="1" stopColor="#4169FF" />
        </linearGradient>
        <linearGradient id={`${id}-sweep`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9DB8FF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#9DB8FF" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={MARK_PATH} fillRule="evenodd" />
        </clipPath>
      </defs>

      {/* glass body */}
      <path d={MARK_PATH} fillRule="evenodd" fill={`url(#${id}-glass)`} />

      {/* light sweeping through the glass */}
      <g clipPath={`url(#${id}-clip)`}>
        <rect
          x="-200"
          y="-20"
          width="160"
          height="460"
          fill={`url(#${id}-sweep)`}
          className={flow ? 'ink-sweep' : 'hidden'}
        />
      </g>

      {/* ink contour drawing itself */}
      <path
        d={MARK_PATH}
        fill="none"
        stroke={`url(#${id}-ink)`}
        strokeWidth="1.4"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={drawn ? 0 : 1}
        style={{ transition: 'stroke-dashoffset 2.6s cubic-bezier(0.65,0,0.35,1)' }}
        opacity="0.9"
      />

      {/* illuminated ink flowing along the contours */}
      {flow && (
        <path
          d={MARK_PATH}
          fill="none"
          stroke="#cfdcff"
          strokeWidth="2.2"
          strokeLinecap="round"
          pathLength={1}
          className="dash-flow ink-glow"
          opacity={drawn ? 1 : 0}
          style={{ transition: 'opacity 1s ease 1.8s' }}
        />
      )}
    </svg>
  );
}
