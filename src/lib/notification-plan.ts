// Pure planner for local notifications. iOS keeps at most 64 pending local notifications,
// so the app schedules a rolling window and refreshes it on launch and in the background.
import { addCivilDays, civilKey, type CivilDate } from './hijri';
import { computeDay, prayerLabel, SALAH_IDS, type PlaceLocation, type PrayerId, type PrayerSettings } from './prayer-times';
import { FAST_REASON_LABEL, upcomingVoluntaryFasts } from './ramadan';
import { civilDateIn, formatTime, instantAt } from './time';

export const IOS_PENDING_LIMIT = 64;
export const PLAN_LIMIT = 60;
export const PLAN_DAYS = 10;

export type AdhanSound = 'adhan-makkah' | 'adhan-short' | 'takbir' | 'default' | 'silent';

export type Clock = { hour: number; minute: number };

export type NotificationSettings = {
  prayers: Record<Exclude<PrayerId, 'sunrise'>, { enabled: boolean; sound: AdhanSound }>;
  preAdhan: { enabled: boolean; minutes: number };
  morningAdhkar: { enabled: boolean; minutesAfterFajr: number };
  eveningAdhkar: { enabled: boolean; minutesAfterAsr: number };
  sleepAdhkar: { enabled: boolean; at: Clock };
  quranReminder: { enabled: boolean; at: Clock };
  fridayKahf: { enabled: boolean; at: Clock };
  fasting: { enabled: boolean; at: Clock };
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  prayers: {
    fajr: { enabled: true, sound: 'adhan-makkah' },
    dhuhr: { enabled: true, sound: 'adhan-makkah' },
    asr: { enabled: true, sound: 'adhan-makkah' },
    maghrib: { enabled: true, sound: 'adhan-makkah' },
    isha: { enabled: true, sound: 'adhan-makkah' },
  },
  preAdhan: { enabled: true, minutes: 5 },
  morningAdhkar: { enabled: true, minutesAfterFajr: 30 },
  eveningAdhkar: { enabled: true, minutesAfterAsr: 30 },
  sleepAdhkar: { enabled: false, at: { hour: 22, minute: 30 } },
  quranReminder: { enabled: false, at: { hour: 20, minute: 0 } },
  fridayKahf: { enabled: true, at: { hour: 9, minute: 0 } },
  fasting: { enabled: false, at: { hour: 21, minute: 0 } },
};

export type Channel = 'adhan' | 'reminders' | 'adhkar';

export type PlannedNotification = {
  id: string;
  at: Date;
  title: string;
  body: string;
  channel: Channel;
  sound: AdhanSound | null;
  route: string;
  priority: 0 | 1 | 2;
};

export type KhatmaReminder = { id: string; name: string; at: Clock; portion: (date: CivilDate) => { from: number; to: number } | null };

export function planNotifications(input: {
  now: Date;
  place: PlaceLocation;
  prayer: PrayerSettings;
  settings: NotificationSettings;
  khatmas?: KhatmaReminder[];
  limit?: number;
  days?: number;
}): PlannedNotification[] {
  const { now, place, prayer, settings } = input;
  const limit = input.limit ?? PLAN_LIMIT;
  const days = input.days ?? PLAN_DAYS;
  const tz = place.timezone;
  const today = civilDateIn(now, tz);
  const events: PlannedNotification[] = [];
  const at = (date: CivilDate, c: Clock) => instantAt(date, c.hour, c.minute, tz);

  for (let i = 0; i < days; i++) {
    const date = addCivilDays(today, i);
    const key = civilKey(date);
    const day = computeDay(date, place, prayer);
    for (const id of SALAH_IDS) {
      const p = settings.prayers[id as Exclude<PrayerId, 'sunrise'>];
      if (!p?.enabled) continue;
      const time = day.times[id];
      const label = prayerLabel(id, day.isFriday);
      events.push({
        id: `adhan-${id}-${key}`,
        at: time,
        title: `حان الآن موعد أذان ${label}`,
        body: `${place.name} — ${formatTime(time, tz)}`,
        channel: 'adhan',
        sound: p.sound,
        route: '/prayer',
        priority: 0,
      });
      if (settings.preAdhan.enabled && settings.preAdhan.minutes > 0) {
        events.push({
          id: `pre-${id}-${key}`,
          at: new Date(time.getTime() - settings.preAdhan.minutes * 60000),
          title: `بقي ${settings.preAdhan.minutes} دقائق على أذان ${label}`,
          body: `${place.name} — ${formatTime(time, tz)}`,
          channel: 'reminders',
          sound: 'default',
          route: '/prayer',
          priority: 1,
        });
      }
    }
    if (settings.morningAdhkar.enabled) {
      events.push({
        id: `morning-${key}`,
        at: new Date(day.times.fajr.getTime() + settings.morningAdhkar.minutesAfterFajr * 60000),
        title: 'أذكار الصباح',
        body: 'حان وقت أذكار الصباح',
        channel: 'adhkar',
        sound: 'default',
        route: '/adhkar/morning',
        priority: 2,
      });
    }
    if (settings.eveningAdhkar.enabled) {
      events.push({
        id: `evening-${key}`,
        at: new Date(day.times.asr.getTime() + settings.eveningAdhkar.minutesAfterAsr * 60000),
        title: 'أذكار المساء',
        body: 'حان وقت أذكار المساء',
        channel: 'adhkar',
        sound: 'default',
        route: '/adhkar/evening',
        priority: 2,
      });
    }
    if (settings.sleepAdhkar.enabled) {
      events.push({
        id: `sleep-${key}`,
        at: at(date, settings.sleepAdhkar.at),
        title: 'أذكار النوم',
        body: 'لا تنسَ أذكار النوم',
        channel: 'adhkar',
        sound: 'default',
        route: '/adhkar/sleep',
        priority: 2,
      });
    }
    if (settings.quranReminder.enabled) {
      events.push({
        id: `quran-${key}`,
        at: at(date, settings.quranReminder.at),
        title: 'وردك من القرآن',
        body: 'تابع القراءة من حيث توقفت',
        channel: 'reminders',
        sound: 'default',
        route: '/quran',
        priority: 2,
      });
    }
    if (settings.fridayKahf.enabled && day.isFriday) {
      events.push({
        id: `kahf-${key}`,
        at: at(date, settings.fridayKahf.at),
        title: 'يوم الجمعة',
        body: 'سورة الكهف والإكثار من الصلاة على النبي ﷺ',
        channel: 'reminders',
        sound: 'default',
        route: '/mushaf?surah=18&ayah=1',
        priority: 2,
      });
    }
    for (const k of input.khatmas ?? []) {
      const portion = k.portion(date);
      if (!portion) continue;
      events.push({
        id: `khatma-${k.id}-${key}`,
        at: at(date, k.at),
        title: `ورد ${k.name}`,
        body: `ورد اليوم: من صفحة ${portion.from} إلى ${portion.to}`,
        channel: 'reminders',
        sound: 'default',
        route: '/khatma',
        priority: 2,
      });
    }
  }
  if (settings.fasting.enabled) {
    // Remind the evening before each recommended fast.
    for (const f of upcomingVoluntaryFasts(addCivilDays(today, 1), days, prayer.hijriOffset)) {
      const eve = addCivilDays(f.date, -1);
      events.push({
        id: `fast-${civilKey(f.date)}`,
        at: at(eve, settings.fasting.at),
        title: 'تذكير بالصيام',
        body: `غدًا: ${FAST_REASON_LABEL[f.reason]}`,
        channel: 'reminders',
        sound: 'default',
        route: '/ramadan',
        priority: 2,
      });
    }
  }

  const upcoming = events
    .filter((e) => e.at.getTime() > now.getTime() + 5000)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (upcoming.length <= limit) return upcoming;

  // Keep complete days for as long as everything fits, then only the adhan itself.
  const dayEnd = (n: number) => instantAt(addCivilDays(today, n + 1), 0, 0, tz).getTime();
  let horizon = 0;
  for (let n = 0; n < days; n++) {
    if (upcoming.filter((e) => e.at.getTime() < dayEnd(n)).length <= limit) horizon = n + 1;
    else break;
  }
  if (horizon === 0) return upcoming.slice(0, limit);
  const cut = dayEnd(horizon - 1);
  const chosen = upcoming.filter((e) => e.at.getTime() < cut);
  for (const e of upcoming) {
    if (chosen.length >= limit) break;
    if (e.at.getTime() >= cut && e.priority === 0) chosen.push(e);
  }
  return chosen;
}
