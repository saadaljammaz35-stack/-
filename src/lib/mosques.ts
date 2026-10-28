// Mosques near a point from OpenStreetMap (Overpass API): the query, parsing the answer into
// named places with distance and direction, and how distances read.
import { distanceKm } from './geo';

export type Mosque = { id: string; name: string | null; lat: number; lng: number; km: number; bearing: number };

/** Coordinates sent to the service are rounded to about 100 m. */
export const roundCoord = (v: number) => Math.round(v * 1000) / 1000;

export function overpassQuery(lat: number, lng: number, radiusM: number): string {
  const around = `(around:${radiusM},${roundCoord(lat)},${roundCoord(lng)})`;
  return `[out:json][timeout:20];(node["amenity"="place_of_worship"]["religion"="muslim"]${around};way["amenity"="place_of_worship"]["religion"="muslim"]${around};relation["amenity"="place_of_worship"]["religion"="muslim"]${around};);out center tags 80;`;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Initial great-circle bearing from the first point to the second, degrees from north. */
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

type OverpassElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/** Places from an Overpass answer, nearest first, with a name in the requested language when mapped. */
export function parseMosques(json: { elements?: OverpassElement[] }, lat: number, lng: number, lang: 'ar' | 'en' = 'ar'): Mosque[] {
  const seen = new Set<string>();
  const out: Mosque[] = [];
  for (const e of json.elements ?? []) {
    const p = e.lat != null && e.lon != null ? { lat: e.lat, lon: e.lon } : e.center;
    if (typeof p?.lat !== 'number' || typeof p.lon !== 'number') continue;
    const id = `${e.type}/${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = e.tags ?? {};
    const name = (lang === 'en' ? t['name:en'] : t['name:ar']) || t.name || null;
    out.push({ id, name, lat: p.lat, lng: p.lon, km: distanceKm(lat, lng, p.lat, p.lon), bearing: bearingDeg(lat, lng, p.lat, p.lon) });
  }
  return out.sort((a, b) => a.km - b.km);
}

/** «350 م», «1.2 كم» (or «350 m», «1.2 km»). */
export function formatDistance(km: number, lang: 'ar' | 'en' = 'ar'): string {
  if (km < 1) {
    const m = Math.max(10, Math.round((km * 1000) / 10) * 10);
    return lang === 'en' ? `${m} m` : `${m} م`;
  }
  const v = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return lang === 'en' ? `${v} km` : `${v} كم`;
}
