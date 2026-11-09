import type { ServiceSlug } from '@/content/types';

/**
 * Line-art illustrations for each service, drawn in MEDAD ink. Hover motion
 * is pure CSS (driven by the card's `group`), so the artwork stays light.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.2,
  vectorEffect: 'non-scaling-stroke' as const,
};

const T = 'transition-transform duration-[900ms] ease-[var(--ease-out-expo)] [transform-box:fill-box]';

function Web() {
  return (
    <>
      {/* back window */}
      <g className={`${T} origin-center group-hover:-translate-x-3 group-hover:-translate-y-2`}>
        <rect x="70" y="40" width="250" height="160" rx="12" {...stroke} className="text-white/15" />
      </g>
      {/* main window */}
      <g className={`${T} origin-center group-hover:translate-x-2 group-hover:translate-y-1`}>
        <rect x="90" y="58" width="250" height="160" rx="12" fill="#0d1220" stroke="currentColor" strokeWidth="1.2" className="text-icy/50" />
        <line x1="90" y1="82" x2="340" y2="82" {...stroke} className="text-white/15" />
        <circle cx="106" cy="70" r="3.2" className="fill-white/25" />
        <circle cx="118" cy="70" r="3.2" className="fill-white/25" />
        <circle cx="130" cy="70" r="3.2" className="fill-electric" />
        <rect x="108" y="100" width="120" height="10" rx="5" className="fill-white/70" />
        <rect x="108" y="118" width="86" height="10" rx="5" className="fill-white/30" />
        <rect x="108" y="142" width="54" height="16" rx="8" className="fill-electric" />
        <g className={`${T} origin-center group-hover:scale-[1.06]`}>
          <rect x="250" y="98" width="72" height="100" rx="8" className="fill-electric/15" stroke="currentColor" strokeWidth="1" />
          <path d="M258 186 L282 150 L296 168 L306 156 L316 186 Z" className="fill-icy/40" />
          <circle cx="300" cy="120" r="7" className="fill-icy/70" />
        </g>
        <rect x="108" y="176" width="40" height="22" rx="5" className="fill-white/[0.07]" />
        <rect x="154" y="176" width="40" height="22" rx="5" className="fill-white/[0.07]" />
        <rect x="200" y="176" width="40" height="22" rx="5" className="fill-white/[0.07]" />
      </g>
      {/* phone */}
      <g className={`${T} origin-center translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100`} style={{ transitionProperty: 'transform, opacity' }}>
        <rect x="318" y="118" width="58" height="104" rx="10" fill="#0b0f1a" stroke="currentColor" strokeWidth="1.2" className="text-icy" />
        <rect x="328" y="134" width="38" height="6" rx="3" className="fill-white/60" />
        <rect x="328" y="146" width="26" height="6" rx="3" className="fill-white/25" />
        <rect x="328" y="162" width="38" height="40" rx="5" className="fill-electric/30" />
      </g>
      {/* ink cursor path */}
      <path d="M40 220 C 90 230, 120 200, 170 205 S 250 236, 300 226" {...stroke} strokeWidth={1.4} pathLength={1} strokeDasharray="1" className="text-electric [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-[1400ms] ease-[var(--ease-out-expo)] group-hover:[stroke-dashoffset:0]" />
    </>
  );
}

function Commerce() {
  return (
    <>
      <g className={`${T} origin-center group-hover:-translate-y-2`}>
        <rect x="120" y="36" width="150" height="190" rx="16" fill="#0d1220" stroke="currentColor" strokeWidth="1.2" className="text-icy/45" />
        <rect x="134" y="50" width="122" height="104" rx="10" className="fill-electric/[0.12]" />
        {/* product: glass bottle */}
        <g className={`${T} origin-bottom group-hover:-translate-y-2 group-hover:rotate-[-4deg]`}>
          <rect x="182" y="64" width="26" height="12" rx="3" className="fill-icy/60" />
          <path d="M176 78 h38 a8 8 0 0 1 8 8 v52 a8 8 0 0 1 -8 8 h-38 a8 8 0 0 1 -8 -8 v-52 a8 8 0 0 1 8 -8 Z" className="fill-icy/20" stroke="currentColor" strokeWidth="1.2" />
          <path d="M178 90 v40" stroke="white" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
        </g>
        <rect x="134" y="166" width="84" height="8" rx="4" className="fill-white/70" />
        <rect x="134" y="182" width="48" height="8" rx="4" className="fill-white/30" />
        <rect x="134" y="200" width="122" height="16" rx="8" className="fill-electric" />
      </g>
      {/* checkout flow */}
      <path d="M270 120 C 310 120, 312 70, 346 70" {...stroke} className="text-white/20" strokeDasharray="3 5" />
      <path d="M270 160 C 318 160, 320 196, 350 196" {...stroke} className="text-white/20" strokeDasharray="3 5" />
      <g className={`${T} origin-center group-hover:scale-110`}>
        <circle cx="356" cy="70" r="16" className="fill-midnight" stroke="currentColor" strokeWidth="1.2" />
        <path d="M348 66 h3 l3 9 h8 l3 -7 h-12" {...stroke} className="text-icy" />
      </g>
      <g className={`${T} origin-center group-hover:scale-110`}>
        <circle cx="358" cy="196" r="16" className="fill-electric/25" stroke="currentColor" strokeWidth="1.2" />
        <path d="M351 196 l5 5 l9 -10" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" className="[stroke-dashoffset:1] transition-[stroke-dashoffset] delay-300 duration-700 group-hover:[stroke-dashoffset:0]" />
      </g>
      <g className="text-white/25">
        <circle cx="60" cy="90" r="22" {...stroke} />
        <path d="M50 92 h20 M60 82 v20" {...stroke} className="text-icy/60" />
        <path d="M82 92 C 100 92, 104 110, 120 110" {...stroke} strokeDasharray="3 5" />
      </g>
    </>
  );
}

function UiUx() {
  return (
    <>
      {/* component grid */}
      <g className="text-white/12">
        {[0, 1, 2].map((r) =>
          [0, 1, 2, 3].map((c) => (
            <rect key={`${r}-${c}`} x={40 + c * 30} y={50 + r * 30} width="22" height="22" rx="6" {...stroke} />
          )),
        )}
      </g>
      <rect x="70" y="80" width="22" height="22" rx="6" className="fill-electric/60" />
      {/* pen tool curve */}
      <path d="M150 196 C 196 70, 286 70, 360 150" {...stroke} strokeWidth={1.6} className="text-icy" />
      <g className={`${T} group-hover:rotate-[-14deg]`} style={{ transformOrigin: '150px 196px' }}>
        <line x1="150" y1="196" x2="196" y2="70" {...stroke} className="text-white/35" />
        <circle cx="196" cy="70" r="5" className="fill-obsidian" stroke="currentColor" strokeWidth="1.2" />
      </g>
      <g className={`${T} group-hover:rotate-[12deg]`} style={{ transformOrigin: '360px 150px' }}>
        <line x1="360" y1="150" x2="286" y2="70" {...stroke} className="text-white/35" />
        <circle cx="286" cy="70" r="5" className="fill-obsidian" stroke="currentColor" strokeWidth="1.2" />
      </g>
      <rect x="144" y="190" width="12" height="12" className="fill-electric" />
      <rect x="354" y="144" width="12" height="12" className="fill-white" />
      {/* cursor */}
      <g className={`${T} group-hover:translate-x-4 group-hover:-translate-y-3`}>
        <path d="M300 186 l0 26 l7 -7 l6 12 l5 -2 l-6 -12 l10 0 Z" className="fill-white" />
      </g>
      <rect x="230" y="210" width="62" height="20" rx="10" className="fill-electric/25" stroke="currentColor" strokeWidth="1" />
      <text x="261" y="224" textAnchor="middle" className="fill-icy font-latin text-[9px] tracking-widest">AUTO</text>
    </>
  );
}

function Brand() {
  return (
    <>
      <g className={`${T} origin-center group-hover:rotate-[30deg]`}>
        <circle cx="200" cy="130" r="92" {...stroke} className="text-white/10" strokeDasharray="2 6" />
      </g>
      <g className={`${T} origin-center group-hover:rotate-[-24deg]`}>
        <circle cx="200" cy="130" r="64" {...stroke} className="text-icy/30" />
        <circle cx="264" cy="130" r="4" className="fill-icy" />
      </g>
      <line x1="60" y1="130" x2="340" y2="130" {...stroke} className="text-white/10" />
      <line x1="200" y1="20" x2="200" y2="240" {...stroke} className="text-white/10" />
      <line x1="110" y1="40" x2="290" y2="220" {...stroke} className="text-white/[0.07]" />
      <line x1="290" y1="40" x2="110" y2="220" {...stroke} className="text-white/[0.07]" />
      {/* construction of the M */}
      <g className={`${T} origin-center group-hover:scale-[1.06]`}>
        <path d="M156 186 V86 L200 132 L244 86 V186" fill="none" stroke="currentColor" strokeWidth="10" strokeLinejoin="miter" className="text-white/90" />
        <path d="M200 146 l12 12 l-12 12 l-12 -12 Z" className="fill-electric" />
        <circle cx="156" cy="78" r="8" fill="none" stroke="currentColor" strokeWidth="4" className="text-icy" />
        <circle cx="244" cy="78" r="8" fill="none" stroke="currentColor" strokeWidth="4" className="text-icy" />
      </g>
      {/* swatches */}
      <g className={`${T} origin-center group-hover:-translate-y-1.5`}>
        <rect x="300" y="196" width="18" height="18" rx="4" className="fill-electric" />
        <rect x="322" y="196" width="18" height="18" rx="4" className="fill-icy" />
        <rect x="344" y="196" width="18" height="18" rx="4" className="fill-white" />
      </g>
      <text x="58" y="214" className="fill-white/50 font-latin text-[11px] tracking-[0.2em]">Aa</text>
      <text x="86" y="214" className="fill-white/50 font-arabic text-[12px]">أب</text>
    </>
  );
}

const ART: Record<ServiceSlug, () => React.JSX.Element> = {
  'web-design-development': Web,
  'e-commerce': Commerce,
  'ui-ux-design': UiUx,
  'brand-digital-experiences': Brand,
};

export function ServiceArt({ slug, className = '' }: { slug: ServiceSlug; className?: string }) {
  const Art = ART[slug];
  return (
    <svg viewBox="0 0 400 250" className={`text-icy ${className}`} aria-hidden="true" focusable="false">
      <Art />
    </svg>
  );
}
