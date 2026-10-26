// Device location → prayer-time location (coordinates, a readable place name and time zone).
import { getCalendars } from 'expo-localization';
import * as Location from 'expo-location';

import { getContentDb } from '@/data/db';
import type { PlaceLocation } from '@/lib/prayer-times';
import { distanceKm } from '@/lib/geo';

export type LocateResult = { ok: true; place: PlaceLocation } | { ok: false; reason: 'denied' | 'unavailable' };

export function deviceTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

export async function nearestCity(lat: number, lng: number) {
  const db = await getContentDb();
  const rows = await db.getAllAsync<{ name: string; country_name: string; lat: number; lng: number; timezone: string }>(
    `SELECT name, country_name, lat, lng, timezone FROM cities
     WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`,
    lat - 1.5,
    lat + 1.5,
    lng - 1.5,
    lng + 1.5,
  );
  let best: (typeof rows)[number] | null = null;
  let bestKm = Infinity;
  for (const r of rows) {
    const km = distanceKm(lat, lng, r.lat, r.lng);
    if (km < bestKm) {
      bestKm = km;
      best = r;
    }
  }
  return best ? { ...best, km: bestKm } : null;
}

export async function locateDevice(ask: boolean): Promise<LocateResult> {
  const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: 'denied' };
  let pos: Location.LocationObject | null = null;
  try {
    pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch {
    pos = await Location.getLastKnownPositionAsync();
  }
  if (!pos) return { ok: false, reason: 'unavailable' };
  const { latitude: lat, longitude: lng } = pos.coords;
  const near = await nearestCity(lat, lng);
  let name = near && near.km < 35 ? near.name : null;
  let country = near?.country_name;
  if (!name) {
    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      name = geo?.city ?? geo?.subregion ?? geo?.region ?? null;
      country = geo?.country ?? country;
    } catch {
      // Reverse geocoding needs a network on some platforms; coordinates are enough.
    }
  }
  return {
    ok: true,
    place: {
      name: name ?? `${lat.toFixed(3)}، ${lng.toFixed(3)}`,
      country,
      lat,
      lng,
      timezone: deviceTimeZone(),
      source: 'gps',
    },
  };
}
