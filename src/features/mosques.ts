// Mosques near the user from OpenStreetMap's public Overpass service (no account or key). Only a
// position rounded to about 100 m is sent, and only when the user opens the nearby mosques page.
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

import { overpassQuery, parseMosques, type Mosque } from '@/lib/mosques';

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const TIMEOUT_MS = 20_000;

async function query(lat: number, lng: number, radiusM: number, lang: 'ar' | 'en'): Promise<Mosque[]> {
  let lastError: unknown = null;
  for (const url of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery(lat, lng, radiusM))}`,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseMosques(await res.json(), lat, lng, lang);
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error('unavailable');
}

/** Up to 40 mosques within 3 km, widening to 8 km when fewer than five are mapped nearby. */
export async function fetchNearbyMosques(lat: number, lng: number, lang: 'ar' | 'en'): Promise<Mosque[]> {
  const near = await query(lat, lng, 3000, lang);
  if (near.length >= 5) return near.slice(0, 40);
  return (await query(lat, lng, 8000, lang)).slice(0, 40);
}

/** The device's position when location access is (or, with `ask`, becomes) allowed. */
export async function devicePosition(ask: boolean): Promise<{ lat: number; lng: number } | null> {
  const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return null;
  let pos: Location.LocationObject | null = null;
  try {
    pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch {
    pos = await Location.getLastKnownPositionAsync();
  }
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
}

/** Walking directions in the phone's maps app. */
export function openDirections(m: Mosque): void {
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${m.lat},${m.lng}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&travelmode=walking`;
  Linking.openURL(url).catch(() => undefined);
}

/** Nearby mosques on the phone's own map. */
export function openMosquesMap(lat: number, lng: number, lang: 'ar' | 'en'): void {
  const q = encodeURIComponent(lang === 'en' ? 'mosque' : 'مسجد');
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?q=${q}&sll=${lat},${lng}&z=15`
      : Platform.OS === 'android'
        ? `geo:${lat},${lng}?q=${q}`
        : `https://www.google.com/maps/search/${q}/@${lat},${lng},15z`;
  Linking.openURL(url).catch(() => undefined);
}
