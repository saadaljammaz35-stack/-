// Events in the sky: the sun standing over the Kaaba (and over its antipode), eclipses seen from
// the user's city, and whether tonight's crescent can be seen (Odeh's criterion).
import { Body, Equator, Horizon, Libration, MakeTime, NextLocalSolarEclipse, NextLunarEclipse, Observer, SearchLocalSolarEclipse, SearchLunarEclipse, SearchMoonPhase, SearchRiseSet } from 'astronomy-engine';

import { KAABA } from './qibla';
import { solarCoordinates, sunPosition } from './sun';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const DAY = 86_400_000;

// ---------- The sun over the Kaaba ----------

export type KaabaTransit = { kind: 'kaaba' | 'antipode'; at: Date; altitude: number };
const ANTIPODE = { lat: -KAABA.lat, lng: KAABA.lng - 180 };

/** The moment of local transit (solar noon) at a longitude on a UTC day. */
function transitOn(dayStartUtc: number, lng: number): Date {
  let t = dayStartUtc + (12 - lng / 15) * 3_600_000;
  // Two refinements with the equation of time are plenty.
  for (let i = 0; i < 2; i++) t = dayStartUtc + (12 - lng / 15 - solarCoordinates(new Date(t)).equationOfTime / 60) * 3_600_000;
  return new Date(t);
}

/**
 * The coming times the sun stands (within half a degree) straight over the Kaaba — when every
 * shadow points away from it and facing the sun is facing the qibla — and over its antipode,
 * when shadows point towards it. Within `days` from `from`.
 */
export function kaabaTransits(from: Date, days = 400): KaabaTransit[] {
  const out: KaabaTransit[] = [];
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()) - DAY;
  for (const [kind, place] of [
    ['kaaba', KAABA],
    ['antipode', ANTIPODE],
  ] as const) {
    let best: KaabaTransit | null = null;
    for (let i = 0; i <= days + 1; i++) {
      const at = transitOn(start + i * DAY, place.lng);
      const { altitude } = sunPosition(at, place.lat, place.lng);
      if (altitude > 89) {
        if (!best || altitude > best.altitude) best = { kind, at, altitude };
      } else if (best) {
        out.push(best);
        best = null;
      }
    }
    if (best) out.push(best);
  }
  return out.filter((e) => e.at.getTime() > from.getTime() - DAY).sort((a, b) => a.at.getTime() - b.at.getTime());
}

// ---------- Eclipses ----------

export type Eclipse = {
  body: 'sun' | 'moon';
  kind: 'partial' | 'annular' | 'total';
  begin: Date;
  peak: Date;
  end: Date;
  /** Fraction of the sun's disc covered at the peak (solar), or of the moon's diameter in shadow (lunar). */
  magnitude: number;
  /** Whether the body is above the horizon at the peak where the user is. */
  visibleAtPeak: boolean;
};

function moonAltitude(at: Date, obs: Observer): number {
  const eq = Equator(Body.Moon, at, obs, true, true);
  return Horizon(at, obs, eq.ra, eq.dec, 'normal').altitude;
}

/** Eclipses seen from a place (the body above the horizon for part of it), soonest first. */
export function upcomingEclipses(lat: number, lng: number, from: Date, years = 5): Eclipse[] {
  const obs = new Observer(lat, lng, 0);
  const until = from.getTime() + years * 365.25 * DAY;
  const out: Eclipse[] = [];

  for (let e = SearchLocalSolarEclipse(from, obs); e.peak.time.date.getTime() < until; e = NextLocalSolarEclipse(e.peak.time, obs)) {
    const seen = [e.partial_begin, e.peak, e.partial_end].some((x) => x.altitude > 0);
    if (!seen) continue;
    out.push({ body: 'sun', kind: e.kind as Eclipse['kind'], begin: e.partial_begin.time.date, peak: e.peak.time.date, end: e.partial_end.time.date, magnitude: e.obscuration, visibleAtPeak: e.peak.altitude > 0 });
  }

  for (let e = SearchLunarEclipse(from); e.peak.date.getTime() < until; e = NextLunarEclipse(e.peak)) {
    // A penumbral eclipse barely dims the moon and is not seen as an eclipse.
    if (e.kind === 'penumbral') continue;
    const peak = e.peak.date;
    const begin = new Date(peak.getTime() - e.sd_partial * 60_000);
    const end = new Date(peak.getTime() + e.sd_partial * 60_000);
    const alts = [begin, peak, end].map((t) => moonAltitude(t, obs));
    if (!alts.some((a) => a > 0)) continue;
    out.push({ body: 'moon', kind: e.kind as Eclipse['kind'], begin, peak, end, magnitude: e.obscuration, visibleAtPeak: alts[1] > 0 });
  }
  return out.sort((a, b) => a.peak.getTime() - b.peak.getTime());
}

// ---------- The crescent ----------

export type CrescentZone = 'naked-eye' | 'optical-maybe-eye' | 'optical-only' | 'not-visible' | 'impossible';

export type Crescent = {
  sunset: Date;
  moonset: Date | null;
  /** Minutes the moon stays up after the sun. */
  lagMinutes: number;
  /** Hours since the new moon at sunset; negative before it. */
  ageHours: number;
  conjunction: Date;
  /** Moon altitude at sunset (degrees, airless). */
  altitude: number;
  /** Sun–moon angle at the best time (degrees). */
  elongation: number;
  /** Odeh's visibility value at the best time. */
  v: number | null;
  zone: CrescentZone;
};

function horizontal(body: Body, at: Date, obs: Observer) {
  const eq = Equator(body, at, obs, true, true);
  return { ...Horizon(at, obs, eq.ra, eq.dec), ra: eq.ra, dec: eq.dec };
}

/** Angle between two points on the sky (degrees), from right ascension (hours) and declination. */
function separation(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const a = rad(ra1 * 15);
  const b = rad(ra2 * 15);
  const c = Math.sin(rad(dec1)) * Math.sin(rad(dec2)) + Math.cos(rad(dec1)) * Math.cos(rad(dec2)) * Math.cos(a - b);
  return deg(Math.acos(Math.min(1, Math.max(-1, c))));
}

/**
 * The crescent on the evening of a day (from `noonUtc`, any instant before that day's sunset):
 * Odeh (2004), at the best time, four ninths of the way from sunset to moonset.
 */
export function crescentOn(noon: Date, lat: number, lng: number): Crescent | null {
  const obs = new Observer(lat, lng, 0);
  const sunsetT = SearchRiseSet(Body.Sun, obs, -1, noon, 1);
  if (!sunsetT) return null;
  const sunset = sunsetT.date;
  const conjunction = SearchMoonPhase(0, MakeTime(new Date(sunset.getTime() - 15 * DAY)), 30)!.date;
  const ageHours = (sunset.getTime() - conjunction.getTime()) / 3_600_000;
  const moonsetT = SearchRiseSet(Body.Moon, obs, -1, sunset, 1);
  const moonset = moonsetT ? moonsetT.date : null;
  const lagMinutes = moonset ? (moonset.getTime() - sunset.getTime()) / 60_000 : 0;
  const moonAtSunset = horizontal(Body.Moon, sunset, obs);

  const base = { sunset, moonset, lagMinutes, ageHours, conjunction, altitude: moonAtSunset.altitude };
  if (ageHours <= 0 || !moonset || lagMinutes <= 0 || lagMinutes > 24 * 60) {
    const sun = horizontal(Body.Sun, sunset, obs);
    return { ...base, elongation: separation(sun.ra, sun.dec, moonAtSunset.ra, moonAtSunset.dec), v: null, zone: 'impossible' };
  }
  const best = new Date(sunset.getTime() + ((moonset.getTime() - sunset.getTime()) * 4) / 9);
  const sun = horizontal(Body.Sun, best, obs);
  const moon = horizontal(Body.Moon, best, obs);
  const arcv = moon.altitude - sun.altitude;
  const elongation = separation(sun.ra, sun.dec, moon.ra, moon.dec);
  const sd = (Libration(best).diam_deg / 2) * 60;
  const w = sd * (1 - Math.cos(rad(elongation)));
  const v = arcv - (-0.1018 * w ** 3 + 0.7319 * w ** 2 - 6.3226 * w + 7.1651);
  const zone: CrescentZone = v >= 5.65 ? 'naked-eye' : v >= 2 ? 'optical-maybe-eye' : v >= -0.96 ? 'optical-only' : 'not-visible';
  return { ...base, elongation, v, zone };
}
