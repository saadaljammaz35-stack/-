// Rain, thunder and wind where the user is, for «أذكار الأحوال». Opt-in: a position rounded to
// about 1 km is sent to MET Norway's public forecast service (no key, no identifier).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { parseWeather, type Weather } from '@/lib/situations';
import { useSettings } from '@/store/settings';

const API = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const FRESH_MS = 30 * 60_000;
const NOTIFY_GAP_MS = 6 * 3600_000;

type WeatherState = { weather: Weather | null; at: number; key: string; notifiedAt: number };
export const useWeather = create<WeatherState>(() => ({ weather: null, at: 0, key: '', notifiedAt: 0 }));

/** Fetches the current weather when enabled and stale; returns it (or null). */
export async function refreshWeather(): Promise<Weather | null> {
  const { weatherAdhkar, location } = useSettings.getState();
  if (!weatherAdhkar || !location) return null;
  const lat = location.lat.toFixed(2);
  const lon = location.lng.toFixed(2);
  const key = `${lat},${lon}`;
  const s = useWeather.getState();
  if (s.key === key && Date.now() - s.at < FRESH_MS) return s.weather;
  try {
    // MET Norway asks every client to identify itself; browsers send their own User-Agent.
    const res = await fetch(`${API}?lat=${lat}&lon=${lon}`, Platform.OS === 'web' ? undefined : { headers: { 'User-Agent': 'MaAllahApp/1.0 https://ma-allah.vercel.app' } });
    if (!res.ok) return null;
    const weather = parseWeather(await res.json());
    useWeather.setState({ weather, at: Date.now(), key });
    return weather;
  } catch {
    return null;
  }
}

/** From the background refresh: one alert for rain or strong wind, at most every six hours. */
export async function notifyWeather(): Promise<void> {
  if (Platform.OS === 'web') return;
  const w = await refreshWeather();
  const { location, language } = useSettings.getState();
  if (!w || !location || !(w.rain || w.wind || w.thunder)) return;
  if (Date.now() - useWeather.getState().notifiedAt < NOTIFY_GAP_MS) return;
  useWeather.setState({ notifiedAt: Date.now() });
  const ar = language !== 'en';
  const id = w.thunder ? 'thunder' : w.rain ? 'rain' : 'wind';
  const title = ar ? { thunder: 'رعد', rain: 'مطر', wind: 'ريح' }[id] + ` في ${location.name}` : `${{ thunder: 'Thunder', rain: 'Rain', wind: 'Wind' }[id]} in ${location.name}`;
  const body = ar ? { thunder: 'دعاء الرعد', rain: 'الدعاء إذا رأيت المطر', wind: 'دعاء الريح' }[id] : 'Its dua from Hisn al-Muslim';
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', data: { route: `/adhkar/situation:${id}` } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: 'adhkar' },
  }).catch(() => undefined);
}
