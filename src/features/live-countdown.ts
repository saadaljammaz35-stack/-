// Keeps the live prayer countdown on the next prayer: an iOS Live Activity (Lock Screen and
// Dynamic Island) or, on Android, an ongoing notification that moves itself on at each prayer.
import { requireOptionalNativeModule } from 'expo';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import { nextPrayer, prayerLabel, type PlaceLocation, type PrayerSettings } from '@/lib/prayer-times';
import { formatTime } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { PrayerActivity } from '@/widgets/live-activity';
import type { PrayerActivityProps } from '@/widgets/types';

type AndroidEntry = { at: number; title: string; text: string };
const AndroidCountdown =
  Platform.OS === 'android' ? requireOptionalNativeModule<{ schedule: (entries: AndroidEntry[], channelName: string) => void; stop: () => void }>('LiveCountdown') : null;

const iosVersion = Platform.OS === 'ios' ? Number.parseFloat(String(Platform.Version)) : 0;

/** Live Activities need iOS 16.2 (stale dates); Android needs the native module in the build. */
export const liveCountdownSupported = (Platform.OS === 'ios' && PrayerActivity != null && iosVersion >= 16.2) || AndroidCountdown != null;

/** The prayers after `now`, soonest first. */
function comingPrayers(now: Date, place: PlaceLocation, settings: PrayerSettings, count: number) {
  const out: ReturnType<typeof nextPrayer>[] = [];
  let from = now;
  for (let i = 0; i < count; i++) {
    const p = nextPrayer(from, place, settings);
    out.push(p);
    from = new Date(p.at.getTime() + 1000);
  }
  return out;
}

export async function syncLiveCountdown(): Promise<void> {
  if (!liveCountdownSupported) return;
  const { liveCountdown, location, prayer, language, digits } = useSettings.getState();
  const ar = language !== 'en';
  if (!liveCountdown || !location) {
    AndroidCountdown?.stop();
    for (const a of PrayerActivity?.getInstances() ?? []) await a.end('immediate').catch(() => undefined);
    return;
  }
  const now = new Date();
  const time = (d: Date) => formatTime(d, location.timezone, digits, false, language);

  if (AndroidCountdown) {
    // Three days ahead, so it keeps going even if the app is not opened for a while.
    const entries = comingPrayers(now, location, prayer, 15).map((p) => {
      const name = prayerLabel(p.id, p.day.isFriday, language);
      return { at: p.at.getTime(), title: `${name} · ${time(p.at)}`, text: ar ? `باقي على الأذان · ${location.name}` : `Until the adhan · ${location.name}` };
    });
    AndroidCountdown.schedule(entries, ar ? 'العدّاد الحي للصلاة' : 'Live prayer countdown');
    return;
  }

  if (PrayerActivity) {
    const next = nextPrayer(now, location, prayer);
    const props: PrayerActivityProps = {
      name: prayerLabel(next.id, next.day.isFriday, language),
      time: time(next.at),
      at: next.at.getTime(),
      city: location.name,
      remainingLabel: ar ? 'باقي على الأذان' : 'Until the adhan',
      dueLabel: ar ? 'حان الآن وقت الصلاة' : 'It is time to pray',
      night: next.id === 'fajr' || next.id === 'isha',
      reverse: ar !== (getLocales()[0]?.textDirection === 'rtl'),
    };
    const running = PrayerActivity.getInstances();
    try {
      if (running.length) {
        await running[0].update(props, next.at);
        for (const extra of running.slice(1)) await extra.end('immediate');
      } else {
        // Starting needs the app in the foreground; a background refresh only updates.
        PrayerActivity.start(props, 'maallah://prayer', next.at);
      }
    } catch {
      // Live Activities switched off in iOS Settings, or started from the background.
    }
  }
}
