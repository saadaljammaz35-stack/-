/* Line illustrations used inside color blocks when no photo is set.
   Drawn on a 100 × 160 canvas, stroked in the paper color. */

const stroke = {
  fill: "none",
  stroke: "var(--color-paper)",
  strokeWidth: 2.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function NightArt() {
  return (
    <svg viewBox="0 0 100 160" className="h-full w-full" aria-hidden>
      <path {...stroke} d="M62 38a22 22 0 1 1-24-22 17 17 0 0 0 24 22z" />
      <path {...stroke} d="M74 70l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      <path {...stroke} d="M24 64l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" />
      <circle cx="80" cy="30" r="1.8" fill="var(--color-paper)" />
      <circle cx="18" cy="40" r="1.5" fill="var(--color-paper)" />
      <path {...stroke} d="M20 128c0-10 8-18 18-18 4-8 16-10 22-3 9-1 16 6 16 15 6 1 10 5 10 11H20z" opacity=".9" />
    </svg>
  );
}

export function BalloonArt() {
  return (
    <svg viewBox="0 0 100 160" className="h-full w-full" aria-hidden>
      <ellipse {...stroke} cx="40" cy="44" rx="18" ry="22" />
      <path {...stroke} d="M37 66l3 5 3-5M40 71c-6 14 6 22 0 36s5 20 2 34" />
      <ellipse {...stroke} cx="68" cy="64" rx="14" ry="17" />
      <path {...stroke} d="M66 81l2 4 2-4M68 85c4 10-4 18 1 28s-3 18-1 28" />
      <circle cx="22" cy="96" r="2.4" fill="var(--color-paper)" />
      <rect x="76" y="104" width="5" height="5" rx="1.2" fill="var(--color-paper)" transform="rotate(20 78 106)" />
      <circle cx="60" cy="24" r="2" fill="var(--color-paper)" />
      <rect x="18" y="20" width="4" height="4" rx="1" fill="var(--color-paper)" transform="rotate(-15 20 22)" />
    </svg>
  );
}

export function CameraArt() {
  return (
    <svg viewBox="0 0 100 160" className="h-full w-full" aria-hidden>
      <rect {...stroke} x="18" y="58" width="64" height="46" rx="10" />
      <path {...stroke} d="M36 58l5-9h18l5 9" />
      <circle {...stroke} cx="50" cy="81" r="14" />
      <circle {...stroke} cx="50" cy="81" r="6" />
      <circle cx="72" cy="67" r="2.2" fill="var(--color-paper)" />
      <path {...stroke} d="M26 36l4-6M50 30v-8M74 36l-4-6" opacity=".85" />
      <path {...stroke} d="M30 128h40" opacity=".7" />
    </svg>
  );
}

export function FamilyArt() {
  return (
    <svg viewBox="0 0 100 160" className="h-full w-full" aria-hidden>
      <circle {...stroke} cx="32" cy="52" r="9" />
      <path {...stroke} d="M16 96c0-14 7-24 16-24s16 10 16 24" />
      <circle {...stroke} cx="68" cy="50" r="10" />
      <path {...stroke} d="M51 96c0-15 7-26 17-26s17 11 17 26" />
      <circle {...stroke} cx="50" cy="84" r="6.5" />
      <path {...stroke} d="M39 112c0-10 5-17 11-17s11 7 11 17" />
      <path {...stroke} d="M14 120h72" opacity=".7" />
    </svg>
  );
}

export function SparkleArt() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <path {...stroke} d="M50 26l5 15 15 5-15 5-5 15-5-15-15-5 15-5z" />
    </svg>
  );
}

export function HeartArt() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <path {...stroke} d="M50 70S28 57 28 42a11 11 0 0 1 22-3 11 11 0 0 1 22 3c0 15-22 28-22 28z" />
    </svg>
  );
}

export function SmileArt() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <circle {...stroke} cx="50" cy="50" r="20" />
      <circle cx="43" cy="46" r="2.2" fill="var(--color-paper)" />
      <circle cx="57" cy="46" r="2.2" fill="var(--color-paper)" />
      <path {...stroke} d="M42 56c4 5 12 5 16 0" />
    </svg>
  );
}

export function ShutterArt() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <circle {...stroke} cx="50" cy="50" r="20" />
      <path {...stroke} d="M50 30l8 17M70 50l-17 8M50 70l-8-17M30 50l17-8" />
    </svg>
  );
}
