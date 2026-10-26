// The home screen's sky: colours, stars and the sun or moon position for any moment, keyed to
// the day's prayer times so dawn starts at Fajr and dusk ends at Isha wherever the user is.

export type SkyTimes = { fajr: number; sunrise: number; dhuhr: number; asr: number; maghrib: number; isha: number };

export type Sky = {
  top: string;
  bottom: string;
  /** 0 (daylight) to 1 (full night). */
  stars: number;
  body: { kind: 'sun' | 'moon'; progress: number };
  /** Text over the sky stays light; true when the sky is bright enough to need a stronger shadow. */
  bright: boolean;
};

type Stop = { at: number; top: string; bottom: string };

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const NIGHT = { top: '#0A1026', bottom: '#1C2652' };
const PALETTE = {
  dawn: { top: '#141C3E', bottom: '#3D3F78' },
  dawnGlow: { top: '#2B3D74', bottom: '#C88AA0' },
  sunrise: { top: '#4F86CF', bottom: '#F4BE86' },
  morning: { top: '#3F86D6', bottom: '#A6D2F4' },
  noon: { top: '#3A88DB', bottom: '#BEE1F9' },
  afternoon: { top: '#4F8FD2', bottom: '#E6D7A6' },
  golden: { top: '#6476B4', bottom: '#F0A35A' },
  sunset: { top: '#45397A', bottom: '#E36A4E' },
  dusk: { top: '#202758', bottom: '#694A7A' },
  isha: { top: '#111836', bottom: '#2A2D5E' },
};

function stops(t: SkyTimes): Stop[] {
  return [
    { at: t.fajr - 60 * MIN, ...NIGHT },
    { at: t.fajr, ...PALETTE.dawn },
    { at: (t.fajr + t.sunrise) / 2, ...PALETTE.dawnGlow },
    { at: t.sunrise, ...PALETTE.sunrise },
    { at: t.sunrise + 60 * MIN, ...PALETTE.morning },
    { at: t.dhuhr, ...PALETTE.noon },
    { at: t.asr, ...PALETTE.afternoon },
    { at: t.maghrib - 25 * MIN, ...PALETTE.golden },
    { at: t.maghrib, ...PALETTE.sunset },
    { at: t.maghrib + 30 * MIN, ...PALETTE.dusk },
    { at: t.isha, ...PALETTE.isha },
    { at: t.isha + 90 * MIN, ...NIGHT },
  ];
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixColor(a: string, b: string, f: number): string {
  const x = hex(a);
  const y = hex(b);
  const k = Math.max(0, Math.min(1, f));
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

/** Relative luminance (0–1) of a #rrggbb colour. */
export function luminance(c: string): number {
  const [r, g, b] = hex(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function skyAt(now: number, t: SkyTimes): Sky {
  const s = stops(t);
  let top = NIGHT.top;
  let bottom = NIGHT.bottom;
  if (now >= s[0].at && now <= s[s.length - 1].at) {
    const i = s.findIndex((x, k) => now >= x.at && now <= (s[k + 1]?.at ?? x.at));
    const a = s[i];
    const b = s[Math.min(i + 1, s.length - 1)];
    const f = b.at === a.at ? 0 : (now - a.at) / (b.at - a.at);
    top = mixColor(a.top, b.top, f);
    bottom = mixColor(a.bottom, b.bottom, f);
  }

  // Stars fade out between Fajr and sunrise and come back between Maghrib and Isha.
  let stars = 0;
  if (now < t.fajr || now > t.isha) stars = 1;
  else if (now < t.sunrise) stars = 1 - clamp01((now - t.fajr) / (t.sunrise - t.fajr));
  else if (now > t.maghrib) stars = clamp01((now - t.maghrib - 10 * MIN) / (t.isha - t.maghrib - 10 * MIN));

  let body: Sky['body'];
  if (now >= t.sunrise && now <= t.maghrib) {
    body = { kind: 'sun', progress: (now - t.sunrise) / (t.maghrib - t.sunrise) };
  } else {
    // The moon crosses the arc from one Maghrib to the next sunrise.
    const start = now > t.maghrib ? t.maghrib : t.maghrib - DAY;
    const end = now > t.maghrib ? t.sunrise + DAY : t.sunrise;
    body = { kind: 'moon', progress: clamp01((now - start) / (end - start)) };
  }

  return { top, bottom, stars, body, bright: luminance(top) > 0.18 };
}

/** Point on the arc (0 = start, 1 = end) inside a w×h box, as a half ellipse. */
export function arcPoint(progress: number, w: number, h: number, pad = 14): { x: number; y: number } {
  const p = clamp01(progress);
  const angle = Math.PI * (1 - p);
  const rx = w / 2 - pad;
  const ry = h - pad;
  return { x: w / 2 + rx * Math.cos(angle), y: h - ry * Math.sin(angle) };
}
