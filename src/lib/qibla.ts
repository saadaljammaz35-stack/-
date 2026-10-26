// Qibla direction (initial great-circle bearing to the Kaaba) and distance to Makkah.

export const KAABA = { lat: 21.422487, lng: 39.826206 };
const EARTH_RADIUS_KM = 6371.0088;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Bearing from true north, clockwise, in degrees [0, 360). */
export function qiblaBearing(lat: number, lng: number): number {
  const φ1 = rad(lat);
  const φ2 = rad(KAABA.lat);
  const Δλ = rad(KAABA.lng - lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Haversine distance to the Kaaba in kilometres. */
export function distanceToKaabaKm(lat: number, lng: number): number {
  const φ1 = rad(lat);
  const φ2 = rad(KAABA.lat);
  const Δφ = rad(KAABA.lat - lat);
  const Δλ = rad(KAABA.lng - lng);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Smallest signed angle from `from` to `to` in degrees (-180, 180]. */
export function angleDelta(from: number, to: number): number {
  let d = ((to - from) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** Whether the device heading points at the qibla within `tolerance` degrees. */
export function isAligned(heading: number, bearing: number, tolerance = 3): boolean {
  return Math.abs(angleDelta(heading, bearing)) <= tolerance;
}

const COMPASS_POINTS = ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'];

export function compassPoint(bearing: number): string {
  return COMPASS_POINTS[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
}
