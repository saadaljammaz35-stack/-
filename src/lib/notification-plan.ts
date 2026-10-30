// Pure planner for local notifications. iOS keeps at most 64 pending local notifications,
// so the app schedules a rolling window and refreshes it on launch and in the background.
import { addCivilDays, civilKey, hijriMonthName, toHijri, type CivilDate } from './hijri';
import { computeDay, prayerLabel, SALAH_IDS, type PlaceLocation, type PrayerId, type PrayerSettings } from './prayer-times';
import { FAST_REASON_LABEL, FAST_REASON_LABEL_EN, upcomingVoluntaryFasts } from './ramadan';
import { civilDateIn, formatTime, instantAt } from './time';
import { kaabaTransits, upcomingEclipses } from './sky-events';
import { oddNightTonight } from './seasons-extra';
import { SEASONS, seasonOn } from './virtues';

export const IOS_PENDING_LIMIT = 64;
export const PLAN_LIMIT = 60;
export const PLAN_DAYS = 10;

/** Adhan alert sound: the bundled adhan clip, the opening takbir, the system sound, or none. */
export type AdhanSound = 'adhan' | 'takbir' | 'default' | 'silent';

/** Maps sounds saved by earlier versions onto the current set. */
export function normalizeAdhanSound(value: unknown): AdhanSound {
  if (value === 'adhan' || value === 'takbir' || value === 'default' || value === 'silent') return value;
  if (value === 'adhan-makkah' || value === 'adhan-short') return 'adhan';
  return 'adhan';
}

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
  /** At the start of the last third of each night. */
  qiyam: { enabled: boolean };
  /** The evening before Muharram, Sha‘ban, the last ten of Ramadan, the six of Shawwal and the ten of Dhul-Hijjah. */
  seasons: { enabled: boolean };
  /** An hour before Maghrib on Fridays, the hour in which duas are answered. */
  fridayHour: { enabled: boolean };
  /** «منبّه الفجر بالآية»: the Fajr alert repeats every few minutes until a verse is read in the app. */
  fajrWake?: { enabled: boolean };
  /** «صلّيت» buttons on each adhan alert, to log the prayer from the notification. */
  prayerActions?: { enabled: boolean };
  /** Android: adhan alerts silent, with a vibration that counts the prayer (one pulse for Fajr … five for Isha). */
  quietVibration?: { enabled: boolean };
  /** Before Fajr on Fridays: the sunnah of reciting as-Sajdah and al-Insan in it. */
  fridayFajr: { enabled: boolean };
  /** Friday morning: ghusl, perfume and going early. */
  fridaySunnah: { enabled: boolean };
  /** Adds «put your phone on silent» to each adhan alert. */
  silentHint: { enabled: boolean };
  /** After Maghrib on the evening a Hijri month begins: the dua on seeing the new moon. */
  hilal: { enabled: boolean };
  /** The sun over the Kaaba (a qibla check) and eclipses seen from the user's city. */
  sky: { enabled: boolean };
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  prayers: {
    fajr: { enabled: true, sound: 'adhan' },
    dhuhr: { enabled: true, sound: 'adhan' },
    asr: { enabled: true, sound: 'adhan' },
    maghrib: { enabled: true, sound: 'adhan' },
    isha: { enabled: true, sound: 'adhan' },
  },
  preAdhan: { enabled: true, minutes: 5 },
  morningAdhkar: { enabled: true, minutesAfterFajr: 30 },
  eveningAdhkar: { enabled: true, minutesAfterAsr: 30 },
  sleepAdhkar: { enabled: false, at: { hour: 22, minute: 30 } },
  quranReminder: { enabled: false, at: { hour: 20, minute: 0 } },
  fridayKahf: { enabled: true, at: { hour: 9, minute: 0 } },
  fasting: { enabled: false, at: { hour: 21, minute: 0 } },
  qiyam: { enabled: false },
  seasons: { enabled: true },
  fridayHour: { enabled: false },
  fridayFajr: { enabled: false },
  fridaySunnah: { enabled: false },
  fajrWake: { enabled: false },
  prayerActions: { enabled: true },
  quietVibration: { enabled: false },
  silentHint: { enabled: false },
  hilal: { enabled: true },
  sky: { enabled: true },
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
  /** On adhan alerts: which prayer, on which day (civil key), for the «صلّيت» actions. */
  prayer?: Exclude<PrayerId, 'sunrise'>;
  date?: string;
};

/** Minutes after the Fajr adhan at which the wake-up alert repeats. */
export const FAJR_WAKE_REPEATS = [3, 6, 9, 12];
export const fajrWakeId = (key: string, n: number) => `fajr-wake-${key}-${n}`;

export type KhatmaReminder = { id: string; name: string; at: Clock; portion: (date: CivilDate) => { from: number; to: number } | null };

export function planNotifications(input: {
  now: Date;
  place: PlaceLocation;
  prayer: PrayerSettings;
  settings: NotificationSettings;
  khatmas?: KhatmaReminder[];
  limit?: number;
  days?: number;
  /** Language of the notification text (the app's interface language). */
  lang?: 'ar' | 'en';
  /** The day (civil key) on which the Fajr wake-up was already answered. */
  fajrWokeOn?: string | null;
}): PlannedNotification[] {
  const { now, place, prayer, settings } = input;
  const lang = input.lang ?? 'ar';
  const tr = (ar: string, en: string) => (lang === 'en' ? en : ar);
  const time = (d: Date) => formatTime(d, place.timezone, 'latin', false, lang);
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
      const at = day.times[id];
      const label = prayerLabel(id, day.isFriday, lang);
      events.push({
        id: `adhan-${id}-${key}`,
        at,
        title: tr(`حان الآن موعد أذان ${label}`, `It is time for ${label}`),
        body: settings.silentHint?.enabled ? tr(`${place.name} — ${time(at)} · اجعل جوالك صامتًا قبل دخول المسجد`, `${place.name} — ${time(at)} · Silence your phone before entering the mosque`) : `${place.name} — ${time(at)}`,
        channel: 'adhan',
        sound: p.sound,
        route: id === 'fajr' && settings.fajrWake?.enabled ? '/fajr-wake' : '/between',
        priority: 0,
        prayer: id as Exclude<PrayerId, 'sunrise'>,
        date: key,
      });
      if (id === 'fajr' && settings.fajrWake?.enabled && input.fajrWokeOn !== key) {
        FAJR_WAKE_REPEATS.forEach((m, n) =>
          events.push({
            id: fajrWakeId(key, n),
            at: new Date(at.getTime() + m * 60000),
            title: tr('استيقظ لصلاة الفجر', 'Wake up for Fajr'),
            body: tr('افتح التطبيق واقرأ آية ليتوقف التنبيه', 'Open the app and read a verse to stop the alert'),
            channel: 'adhan',
            sound: 'takbir',
            route: '/fajr-wake',
            priority: 0,
          }),
        );
      }
      if (settings.preAdhan.enabled && settings.preAdhan.minutes > 0) {
        events.push({
          id: `pre-${id}-${key}`,
          at: new Date(at.getTime() - settings.preAdhan.minutes * 60000),
          title: tr(`بقي ${settings.preAdhan.minutes} دقائق على أذان ${label}`, `${label} in ${settings.preAdhan.minutes} minutes`),
          body: `${place.name} — ${time(at)}`,
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
        title: tr('أذكار الصباح', 'Morning adhkar'),
        body: tr('حان وقت أذكار الصباح', 'Time for the morning adhkar'),
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
        title: tr('أذكار المساء', 'Evening adhkar'),
        body: tr('حان وقت أذكار المساء', 'Time for the evening adhkar'),
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
        title: tr('أذكار النوم', 'Sleep adhkar'),
        body: tr('لا تنسَ أذكار النوم', 'Remember the adhkar before sleep'),
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
        title: tr('وردك من القرآن', 'Your Quran reading'),
        body: tr('تابع القراءة من حيث توقفت', 'Continue where you left off'),
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
        title: tr('يوم الجمعة', 'Friday'),
        body: tr('سورة الكهف والإكثار من الصلاة على النبي ﷺ', 'Surat al-Kahf and abundant salawat upon the Prophet ﷺ'),
        channel: 'reminders',
        sound: 'default',
        route: '/mushaf?surah=18&ayah=1',
        priority: 2,
      });
    }
    if (settings.fridayFajr?.enabled && day.isFriday) {
      events.push({
        id: `friday-fajr-${key}`,
        at: new Date(day.times.fajr.getTime() - 30 * 60000),
        title: tr('فجر الجمعة', 'Friday Fajr'),
        body: tr('كان النبي ﷺ يقرأ في فجر الجمعة «الم تنزيل» السجدة و«هل أتى على الإنسان». متفق عليه', 'The Prophet ﷺ recited as-Sajdah and al-Insan in Fajr on Fridays (al-Bukhari and Muslim).'),
        channel: 'reminders',
        sound: 'default',
        route: '/friday',
        priority: 2,
      });
    }
    if (settings.fridaySunnah?.enabled && day.isFriday) {
      events.push({
        id: `friday-sunnah-${key}`,
        at: new Date(day.times.sunrise.getTime() + 45 * 60000),
        title: tr('سنن الجمعة', 'Friday sunnahs'),
        body: tr('الغسل والطيب، والتبكير إلى الجمعة', 'Ghusl and perfume, and going early to the Friday prayer'),
        channel: 'reminders',
        sound: 'default',
        route: '/friday',
        priority: 2,
      });
    }
    if (settings.fridayHour?.enabled && day.isFriday) {
      events.push({
        id: `friday-hour-${key}`,
        at: new Date(day.times.maghrib.getTime() - 60 * 60000),
        title: tr('آخر ساعة من يوم الجمعة', 'The last hour of Friday'),
        body: tr('«فالتمسوها آخر ساعة بعد العصر» رواه أبو داود والنسائي. افتح دعاءك.', 'The hour of answered prayer: seek it in the last hour after Asr (Abu Dawud, al-Nasa’i).'),
        channel: 'reminders',
        sound: 'default',
        route: '/duas/mine',
        priority: 2,
      });
    }
    if (settings.qiyam?.enabled) {
      // The night that follows this day's Maghrib.
      events.push({
        id: `qiyam-${key}`,
        at: day.lastThird,
        title: tr('الثلث الأخير من الليل', 'The last third of the night'),
        body: tr('«ينزل ربنا تبارك وتعالى كل ليلة إلى السماء الدنيا حين يبقى ثلث الليل الآخر» متفق عليه', 'Allah descends to the lowest heaven every night in its last third (Bukhari and Muslim)'),
        channel: 'reminders',
        sound: 'default',
        route: '/virtues',
        priority: 2,
      });
    }
    if (settings.seasons?.enabled) {
      // Half an hour after Maghrib on the eve of a season's first day.
      const next = seasonOn(addCivilDays(date, 1), prayer.hijriOffset);
      if (next?.day === 1) {
        const s = SEASONS[next.id];
        events.push({
          id: `season-${next.id}-${key}`,
          at: new Date(day.times.maghrib.getTime() + 30 * 60000),
          title: next.id === 'ramadan-last-ten' ? tr('الليلة أولى ليالي العشر الأواخر', 'Tonight: the last ten nights begin') : tr(`غدًا: ${s.title.ar}`, `Tomorrow: ${s.title.en}`),
          body: tr(s.note.ar, s.note.en),
          channel: 'reminders',
          sound: 'default',
          route: '/virtues',
          priority: 2,
        });
      }
    }
    if (settings.seasons?.enabled) {
      // After Isha on each odd night of the last ten: the dua for Laylat al-Qadr.
      const night = oddNightTonight(date, prayer.hijriOffset);
      if (night) {
        events.push({
          id: `qadr-${key}`,
          at: new Date(day.times.isha.getTime() + 30 * 60000),
          title: tr(`الليلة ليلة ${night} من رمضان`, `Tonight is night ${night} of Ramadan`),
          body: tr('تحرّوا ليلة القدر في الوتر من العشر الأواخر. ودعاؤها: «اللهم إنك عفوّ…»', 'Seek Laylat al-Qadr in the odd nights of the last ten; its dua'),
          channel: 'reminders',
          sound: 'default',
          route: '/seasons/qadr',
          priority: 1,
        });
      }
      // Getting ready: thirty, fourteen and seven days before Ramadan, and a week before Dhul-Hijjah.
      const ahead = (n: number) => toHijri(addCivilDays(date, n), prayer.hijriOffset);
      for (const n of [30, 14, 7]) {
        const h = ahead(n);
        if (h.month === 9 && h.day === 1) {
          events.push({
            id: `pre-ramadan-${n}-${key}`,
            at: new Date(day.times.maghrib.getTime() + 45 * 60000),
            title: tr(`باقٍ ${n} يومًا على رمضان`, `${n} days until Ramadan`),
            body: n === 30 ? tr('اقضِ ما عليك من صيام، وابدأ التهيؤ', 'Make up any fasts you owe, and begin preparing') : n === 14 ? tr('خطّط لختمتك وقيامك وصدقتك في رمضان', 'Plan your khatma, night prayer and charity for Ramadan') : tr('أسبوع على رمضان: بلّغنا الله إياه', 'A week until Ramadan'),
            channel: 'reminders',
            sound: 'default',
            route: '/ramadan',
            priority: 2,
          });
        }
      }
      const dh = ahead(7);
      if (dh.month === 12 && dh.day === 1) {
        events.push({
          id: `pre-hijjah-${key}`,
          at: new Date(day.times.maghrib.getTime() + 45 * 60000),
          title: tr('أسبوع على عشر ذي الحجة', 'A week until the ten days of Dhul-Hijjah'),
          body: tr('أحب الأيام إلى الله للعمل الصالح: استعد لها', 'The days in which good deeds are most beloved to Allah'),
          channel: 'reminders',
          sound: 'default',
          route: '/seasons/dhul-hijjah',
          priority: 2,
        });
      }
    }
    if (settings.hilal?.enabled) {
      // The evening before the first of a Hijri month, when its crescent may be seen.
      const tomorrow = toHijri(addCivilDays(date, 1), prayer.hijriOffset);
      if (tomorrow.day === 1) {
        events.push({
          id: `hilal-${tomorrow.year}-${tomorrow.month}`,
          at: new Date(day.times.maghrib.getTime() + 15 * 60000),
          title: tr(`هلال ${hijriMonthName(tomorrow.month, 'ar')}`, `The crescent of ${hijriMonthName(tomorrow.month, 'en')}`),
          body: tr('إذا رأيت الهلال فادعُ بدعاء رؤيته', 'If you see the new moon, say its dua'),
          channel: 'adhkar',
          sound: 'default',
          route: '/adhkar/situation:hilal',
          priority: 2,
        });
      }
    }
    for (const k of input.khatmas ?? []) {
      const portion = k.portion(date);
      if (!portion) continue;
      events.push({
        id: `khatma-${k.id}-${key}`,
        at: at(date, k.at),
        title: tr(`ورد ${k.name}`, `${k.name}`),
        body: tr(`ورد اليوم: من صفحة ${portion.from} إلى ${portion.to}`, `Today: pages ${portion.from}–${portion.to}`),
        channel: 'reminders',
        sound: 'default',
        route: '/khatma',
        priority: 2,
      });
    }
  }

  if (settings.sky?.enabled) {
    const until = now.getTime() + days * 86_400_000;
    for (const e of kaabaTransits(now, days + 1)) {
      if (e.at.getTime() <= now.getTime() || e.at.getTime() > until) continue;
      const kaaba = e.kind === 'kaaba';
      events.push({
        id: `sky-${e.kind}-${civilKey(civilDateIn(e.at, tz))}`,
        at: new Date(e.at.getTime() - 10 * 60000),
        title: kaaba ? tr(`الشمس فوق الكعبة الساعة ${time(e.at)}`, `The sun is over the Kaaba at ${time(e.at)}`) : tr(`الشمس فوق مقابل الكعبة الساعة ${time(e.at)}`, `The sun is over the Kaaba's antipode at ${time(e.at)}`),
        body: kaaba ? tr('إن كانت الشمس ظاهرة عندك فاستقبلها: هي القبلة في تلك اللحظة', 'If you can see the sun, face it: it is the qibla at that moment') : tr('إن كانت الشمس ظاهرة عندك فاستدبرها: ظلك يشير إلى القبلة', 'If you can see the sun, your shadow points to the qibla'),
        channel: 'reminders',
        sound: 'default',
        route: '/sky/kaaba',
        priority: 2,
      });
    }
    for (const e of upcomingEclipses(place.lat, place.lng, now, (days + 1) / 365.25)) {
      if (e.begin.getTime() <= now.getTime() || e.begin.getTime() > until) continue;
      const sun = e.body === 'sun';
      events.push({
        id: `sky-eclipse-${e.body}-${civilKey(civilDateIn(e.peak, tz))}`,
        at: new Date(e.begin.getTime() - 15 * 60000),
        title: sun ? tr(`كسوف الشمس يبدأ الساعة ${time(e.begin)}`, `A solar eclipse begins at ${time(e.begin)}`) : tr(`خسوف القمر يبدأ الساعة ${time(e.begin)}`, `A lunar eclipse begins at ${time(e.begin)}`),
        body: tr('«فإذا رأيتم ذلك فصلّوا وادعوا» — صلاة الكسوف وأحاديثها', '“When you see it, pray and supplicate” — the eclipse prayer'),
        channel: 'reminders',
        sound: 'default',
        route: '/sky/eclipses',
        priority: 1,
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
        title: tr('تذكير بالصيام', 'Fasting reminder'),
        body: tr(`غدًا: ${FAST_REASON_LABEL[f.reason]}`, `Tomorrow: ${FAST_REASON_LABEL_EN[f.reason]}`),
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
