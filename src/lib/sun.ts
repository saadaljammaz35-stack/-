// The sun's position in the sky (NOAA's solar position algorithm, accurate to well under a degree),
// used to find the qibla from the sun when there is no compass.
import { angleDelta } from './qibla';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const norm = (d: number) => ((d % 360) + 360) % 360;

/** Declination (degrees) and the equation of time (minutes) at an instant. */
export function solarCoordinates(at: Date): { declination: number; equationOfTime: number } {
  const t = (at.getTime() / 86_400_000 + 2440587.5 - 2451545) / 36525;
  const l0 = norm(280.46646 + t * (36000.76983 + t * 0.0003032));
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c = Math.sin(rad(m)) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(rad(2 * m)) * (0.019993 - 0.000101 * t) + Math.sin(rad(3 * m)) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const declination = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const equationOfTime =
    4 * deg(y * Math.sin(2 * rad(l0)) - 2 * e * Math.sin(rad(m)) + 4 * e * y * Math.sin(rad(m)) * Math.cos(2 * rad(l0)) - 0.5 * y * y * Math.sin(4 * rad(l0)) - 1.25 * e * e * Math.sin(2 * rad(m)));
  return { declination, equationOfTime };
}

/** The sun's hour angle (degrees, −180…180): negative before the local transit (Dhuhr), positive after. */
export function hourAngle(at: Date, lng: number): number {
  const { equationOfTime } = solarCoordinates(at);
  const utcMinutes = at.getUTCHours() * 60 + at.getUTCMinutes() + at.getUTCSeconds() / 60;
  return norm((utcMinutes + equationOfTime + 4 * lng) / 4) - 180;
}

/** Azimuth (degrees clockwise from true north) and altitude above the horizon (degrees, without refraction). */
export function sunPosition(at: Date, lat: number, lng: number): { azimuth: number; altitude: number } {
  const { declination, equationOfTime } = solarCoordinates(at);
  const utcMinutes = at.getUTCHours() * 60 + at.getUTCMinutes() + at.getUTCSeconds() / 60;
  const hourAngle = rad(norm((utcMinutes + equationOfTime + 4 * lng) / 4) - 180);
  const φ = rad(lat);
  const δ = rad(declination);
  const altitude = deg(Math.asin(Math.sin(φ) * Math.sin(δ) + Math.cos(φ) * Math.cos(δ) * Math.cos(hourAngle)));
  const azimuth = norm(deg(Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(φ) - Math.tan(δ) * Math.cos(φ))) + 180);
  return { azimuth, altitude };
}

export type SunQibla =
  | { kind: 'below' }
  /** The sun is too high for its direction to be read by eye. */
  | { kind: 'overhead'; altitude: number }
  /** Face the sun, then turn `turn` degrees (positive: to the right). */
  | { kind: 'turn'; azimuth: number; altitude: number; turn: number };

/** The highest sun whose direction can still be judged by eye (and by the shadow it casts). */
export const MAX_READABLE_ALTITUDE = 75;

/** How to find the qibla from the sun at an instant. */
export function sunQibla(at: Date, lat: number, lng: number, qibla: number): SunQibla {
  const { azimuth, altitude } = sunPosition(at, lat, lng);
  if (altitude < 1) return { kind: 'below' };
  if (altitude > MAX_READABLE_ALTITUDE) return { kind: 'overhead', altitude };
  return { kind: 'turn', azimuth, altitude, turn: angleDelta(azimuth, qibla) };
}

/** The next instant (to five minutes) from which the sun's direction can be read, within a day. */
export function nextReadableSun(from: Date, lat: number, lng: number): Date | null {
  for (let i = 1; i <= 288; i++) {
    const at = new Date(from.getTime() + i * 5 * 60_000);
    const { altitude } = sunPosition(at, lat, lng);
    if (altitude >= 1 && altitude <= MAX_READABLE_ALTITUDE) return at;
  }
  return null;
}
