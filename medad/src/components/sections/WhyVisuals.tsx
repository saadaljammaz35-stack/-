import { useId } from 'react';

/**
 * Specimen drawings for the "Why MEDAD" principles — line art in MEDAD ink.
 * Each is a small diagram of the idea rather than a decorative icon.
 */

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.2,
  vectorEffect: 'non-scaling-stroke' as const,
};

function Purpose() {
  return (
    <>
      <g className="origin-center animate-spin-slow [transform-box:fill-box]">
        <circle cx="200" cy="200" r="150" {...line} className="text-white/10" strokeDasharray="2 8" />
      </g>
      <circle cx="200" cy="200" r="110" {...line} className="text-white/15" />
      <circle cx="200" cy="200" r="70" {...line} className="text-icy/40" />
      <circle cx="200" cy="200" r="30" {...line} className="text-icy" />
      <circle cx="200" cy="200" r="7" className="fill-electric" />
      <path d="M40 330 C 120 330, 110 230, 196 204" {...line} strokeWidth={1.8} className="dash-flow text-electric" pathLength={1} />
      <path d="M40 330 C 120 330, 110 230, 196 204" {...line} className="text-electric/40" />
      <path d="M360 90 C 290 90, 300 170, 206 196" {...line} className="text-icy/30" strokeDasharray="3 6" />
      <line x1="200" y1="30" x2="200" y2="370" {...line} className="text-white/[0.07]" />
      <line x1="30" y1="200" x2="370" y2="200" {...line} className="text-white/[0.07]" />
    </>
  );
}

function Responsive() {
  return (
    <>
      <rect x="40" y="80" width="320" height="210" rx="14" {...line} className="text-white/20" />
      <line x1="40" y1="106" x2="360" y2="106" {...line} className="text-white/10" />
      <rect x="120" y="120" width="160" height="210" rx="14" className="fill-obsidian" stroke="currentColor" strokeWidth="1.2" />
      <rect x="160" y="150" width="80" height="170" rx="14" className="fill-midnight text-icy" stroke="currentColor" strokeWidth="1.4" />
      <rect x="174" y="172" width="52" height="8" rx="4" className="fill-white/70" />
      <rect x="174" y="186" width="36" height="8" rx="4" className="fill-white/30" />
      <rect x="174" y="206" width="52" height="60" rx="8" className="fill-electric/40" />
      <rect x="174" y="276" width="52" height="14" rx="7" className="fill-electric" />
      <g className="text-icy/60">
        <path d="M100 350 h200" {...line} strokeDasharray="2 5" />
        <path d="M100 344 v12 M300 344 v12" {...line} />
      </g>
    </>
  );
}

function Detail() {
  return (
    <>
      {Array.from({ length: 11 }, (_, i) => (
        <line key={i} x1="30" x2="370" y1={70 + i * 26} y2={70 + i * 26} {...line} className="text-white/[0.06]" />
      ))}
      <text x="200" y="262" textAnchor="middle" className="fill-white font-arabic text-[190px] font-semibold">
        م
      </text>
      <line x1="30" x2="370" y1="252" y2="252" {...line} className="text-electric" />
      <line x1="30" x2="370" y1="148" y2="148" {...line} className="text-icy/50" strokeDasharray="3 5" />
      <circle cx="268" cy="156" r="54" className="fill-electric/10 text-icy" stroke="currentColor" strokeWidth="1.4" />
      <line x1="306" y1="194" x2="346" y2="234" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className="text-icy" />
      <g className="font-latin text-[10px] tracking-[0.2em]">
        <text x="34" y="244" className="fill-electric">BASELINE</text>
        <text x="34" y="140" className="fill-icy/60">X-HEIGHT</text>
      </g>
    </>
  );
}

function Performance() {
  const id = `why-gauge-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <>
      <path d="M80 270 A 120 120 0 0 1 320 270" {...line} strokeWidth={10} strokeLinecap="round" className="text-white/[0.07]" />
      <path
        d="M80 270 A 120 120 0 0 1 320 270"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="10"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="0.92 1"
      />
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="#4169FF" />
          <stop offset="1" stopColor="#9DB8FF" />
        </linearGradient>
      </defs>
      <g style={{ transformOrigin: '200px 270px' }} className="rotate-[70deg]">
        <line x1="200" y1="270" x2="200" y2="176" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <circle cx="200" cy="270" r="9" className="fill-white" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={110 + i * 40} y={320 - (i + 1) * 6} width="22" height={(i + 1) * 6} rx="3" className={i === 4 ? 'fill-icy' : 'fill-white/20'} />
      ))}
      <circle cx="200" cy="90" r="22" {...line} className="text-icy/60" />
      <circle cx="200" cy="80" r="4" className="fill-icy" />
      <path d="M186 92 h28 M200 92 v14 M192 116 l8 -10 l8 10" {...line} className="text-icy" />
    </>
  );
}

function Strategy() {
  const nodes: [number, number][] = [
    [90, 110],
    [310, 90],
    [330, 290],
    [80, 300],
    [200, 60],
  ];
  return (
    <>
      {nodes.map(([x, y], i) => (
        <line key={i} x1="200" y1="200" x2={x} y2={y} {...line} className="text-icy/35" strokeDasharray={i % 2 ? '3 5' : undefined} />
      ))}
      <path d="M90 110 L200 60 L310 90 L330 290 L80 300 Z" {...line} className="text-white/10" />
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="14" className="fill-obsidian text-icy/60" stroke="currentColor" strokeWidth="1.2" />
          <circle cx={x} cy={y} r="4" className="fill-icy" />
        </g>
      ))}
      <circle cx="200" cy="200" r="34" className="fill-electric/20 text-electric" stroke="currentColor" strokeWidth="1.5" />
      <path d="M200 182 l18 18 l-18 18 l-18 -18 Z" className="fill-electric" />
      <path d="M200 200 L310 90" {...line} strokeWidth={2} className="dash-flow text-white" pathLength={1} />
    </>
  );
}

function Scale() {
  const layer = (y: number, cls: string) => (
    <path d={`M200 ${y} L320 ${y + 50} L200 ${y + 100} L80 ${y + 50} Z`} className={cls} stroke="currentColor" strokeWidth="1.2" />
  );
  return (
    <>
      {layer(230, 'fill-obsidian text-white/20')}
      {layer(180, 'fill-midnight text-icy/30')}
      {layer(130, 'fill-midnight text-icy/50')}
      <g className="float-y">{layer(70, 'fill-electric/25 text-icy')}</g>
      <path d="M80 280 v-150 M320 280 v-150" {...line} className="text-white/10" strokeDasharray="3 6" />
      <path d="M200 40 v-14 M192 34 l8 -8 l8 8" {...line} className="text-icy" />
    </>
  );
}

export const WHY_VISUALS = [Purpose, Responsive, Detail, Performance, Strategy, Scale];

export function WhyVisual({ index, className = '' }: { index: number; className?: string }) {
  const V = WHY_VISUALS[index] ?? Purpose;
  return (
    <svg viewBox="0 0 400 400" className={`text-icy ${className}`} aria-hidden="true" focusable="false">
      <V />
    </svg>
  );
}
