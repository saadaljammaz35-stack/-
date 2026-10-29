// Prayer times on a flight: the aircraft is placed along the great circle from origin to
// destination at a steady speed, and each prayer comes when the sun reaches its position in
// the sky as seen from the aircraft at that minute. Sunrise and sunset allow for the lower
// horizon seen from cruising altitude.
import { CalculationMethod } from 'adhan';

import type { Madhhab, MethodId } from './prayer-times';
import { angleDelta, qiblaBearing } from './qibla';
import { hourAngle, solarCoordinates, sunPosition } from './sun';

export type Point = { lat: number; lng: number };
export type FlightPrayer = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type FlightEvent = {
  id: FlightPrayer;
  at: Date;
  position: Point;
  /** Qibla bearing from true north at that point. */
  qibla: number;
  /** The aircraft's course from true north. */
  course: number;
  /** Where the qibla is relative to the nose: positive to the right, negative to the left. */
  relative: number;
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** The point a fraction `f` of the way along the great circle from `a` to `b`. */
export function pointAlong(a: Point, b: Point, f: number): Point {
  const φ1 = rad(a.lat);
  const λ1 = rad(a.lng);
  const φ2 = rad(b.lat);
  const λ2 = rad(b.lng);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d < 1e-9) return a;
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: deg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: deg(Math.atan2(y, x)) };
}

/** Initial great-circle bearing from `a` to `b`, degrees from true north. */
export function courseTo(a: Point, b: Point): number {
  const φ1 = rad(a.lat);
  const φ2 = rad(b.lat);
  const Δλ = rad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** How far below the astronomical horizon the visible horizon lies from a height (degrees). */
export function horizonDip(altitudeKm: number): number {
  return altitudeKm > 0 ? (1.76 * Math.sqrt(altitudeKm * 1000)) / 60 : 0;
}

export type FlightInput = {
  from: Point;
  to: Point;
  departure: Date;
  durationMin: number;
  method: MethodId;
  madhab: Madhhab;
  /** Cruising altitude; 0 for the ground. */
  altitudeKm?: number;
};

export function flightPrayerTimes(input: FlightInput): FlightEvent[] {
  const params = CalculationMethod[input.method]();
  const dip = horizonDip(input.altitudeKm ?? 11);
  const horizon = -(0.833 + dip);
  const shadow = input.madhab === 'hanafi' ? 2 : 1;
  const steps = Math.max(1, Math.round(input.durationMin));
  const start = input.departure.getTime();

  const sample = (i: number) => {
    const f = Math.min(1, i / steps);
    const at = new Date(start + i * 60_000);
    const position = pointAlong(input.from, input.to, f);
    const { altitude } = sunPosition(at, position.lat, position.lng);
    const { declination } = solarCoordinates(at);
    const asrAltitude = deg(Math.atan(1 / (shadow + Math.tan(rad(Math.abs(position.lat - declination))))));
    return { i, f, at, position, altitude, hour: hourAngle(at, position.lng), asrAltitude };
  };

  const events: FlightEvent[] = [];
  const push = (id: FlightPrayer, s: ReturnType<typeof sample>, frac: number) => {
    const at = new Date(s.at.getTime() + frac * 60_000);
    const f = Math.min(1, (s.i + frac) / steps);
    const position = pointAlong(input.from, input.to, f);
    // The course at the very end is taken just before arrival.
    const course = courseTo(pointAlong(input.from, input.to, Math.min(f, 0.999)), input.to);
    const qibla = qiblaBearing(position.lat, position.lng);
    events.push({ id, at, position, qibla, course, relative: angleDelta(course, qibla) });
  };
  /** Linear crossing of `value` from a to b: the fraction of the minute, or null. */
  const cross = (a: number, b: number, value: number, rising: boolean) => {
    if (rising ? a < value && b >= value : a > value && b <= value) return (value - a) / (b - a);
    return null;
  };

  let prev = sample(0);
  let maghribAt: number | null = null;
  for (let i = 1; i <= steps; i++) {
    const cur = sample(i);
    const fajr = cross(prev.altitude, cur.altitude, -params.fajrAngle, true);
    if (fajr != null) push('fajr', prev, fajr);
    const rise = cross(prev.altitude, cur.altitude, horizon, true);
    if (rise != null) push('sunrise', prev, rise);
    if (prev.hour < 0 && cur.hour >= 0 && cur.hour - prev.hour < 90 && cur.altitude > horizon) push('dhuhr', prev, -prev.hour / (cur.hour - prev.hour));
    if (cur.hour > 0) {
      const asr = cross(prev.altitude - prev.asrAltitude, cur.altitude - cur.asrAltitude, 0, false);
      if (asr != null) push('asr', prev, asr);
    }
    const set = cross(prev.altitude, cur.altitude, horizon, false);
    if (set != null) {
      push('maghrib', prev, set);
      maghribAt = prev.at.getTime() + set * 60_000;
    }
    if (params.ishaInterval > 0) {
      if (maghribAt != null && cur.at.getTime() >= maghribAt + params.ishaInterval * 60_000 && prev.at.getTime() < maghribAt + params.ishaInterval * 60_000) {
        push('isha', prev, (maghribAt + params.ishaInterval * 60_000 - prev.at.getTime()) / 60_000);
      }
    } else {
      const isha = cross(prev.altitude, cur.altitude, -params.ishaAngle, false);
      if (isha != null) push('isha', prev, isha);
    }
    prev = cur;
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}
