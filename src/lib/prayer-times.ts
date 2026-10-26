// Prayer time calculation on top of the adhan library (batoulapps), which implements the
// standard astronomical formulas and the published parameters of each authority.
import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
  SunnahTimes,
} from 'adhan';

import { addCivilDays, civilWeekday, toHijri, type CivilDate } from './hijri';
import { civilDateIn } from './time';

export type PrayerId = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export const PRAYER_IDS: PrayerId[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const SALAH_IDS: PrayerId[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const PRAYER_NAMES: Record<PrayerId, string> = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
};

export type MethodId =
  | 'UmmAlQura'
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'NorthAmerica'
  | 'Dubai'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'Turkey'
  | 'Tehran'
  | 'MoonsightingCommittee';

export const METHODS: { id: MethodId; name: string; note: string }[] = [
  { id: 'UmmAlQura', name: 'أم القرى — مكة المكرمة', note: 'الفجر 18.5°، العشاء بعد المغرب بـ90 دقيقة (120 في رمضان)' },
  { id: 'MuslimWorldLeague', name: 'رابطة العالم الإسلامي', note: 'الفجر 18°، العشاء 17°' },
  { id: 'Egyptian', name: 'الهيئة المصرية العامة للمساحة', note: 'الفجر 19.5°، العشاء 17.5°' },
  { id: 'Karachi', name: 'جامعة العلوم الإسلامية — كراتشي', note: 'الفجر 18°، العشاء 18°' },
  { id: 'NorthAmerica', name: 'الجمعية الإسلامية لأمريكا الشمالية (ISNA)', note: 'الفجر 15°، العشاء 15°' },
  { id: 'Dubai', name: 'دبي', note: 'الفجر 18.2°، العشاء 18.2°' },
  { id: 'Kuwait', name: 'الكويت', note: 'الفجر 18°، العشاء 17.5°' },
  { id: 'Qatar', name: 'قطر', note: 'الفجر 18°، العشاء بعد المغرب بـ90 دقيقة' },
  { id: 'Singapore', name: 'سنغافورة', note: 'الفجر 20°، العشاء 18°' },
  { id: 'Turkey', name: 'رئاسة الشؤون الدينية — تركيا', note: 'الفجر 18°، العشاء 17°' },
  { id: 'Tehran', name: 'معهد الجيوفيزياء — طهران', note: 'الفجر 17.7°، العشاء 14°' },
  { id: 'MoonsightingCommittee', name: 'لجنة رؤية الهلال (Moonsighting)', note: 'تعديلات موسمية لخطوط العرض العليا' },
];

export type Madhhab = 'shafi' | 'hanafi';
export type HighLatitude = 'auto' | 'middleofthenight' | 'seventhofthenight' | 'twilightangle';

export type PrayerSettings = {
  method: MethodId;
  madhab: Madhhab;
  highLatitude: HighLatitude;
  /** Minutes added to each computed time (can be negative). */
  adjustments: Record<PrayerId, number>;
  /** Umm al-Qura: Isha 120 min after Maghrib during Ramadan instead of 90. */
  ramadanIsha: boolean;
  hijriOffset: number;
};

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  method: 'UmmAlQura',
  madhab: 'shafi',
  highLatitude: 'auto',
  adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  ramadanIsha: true,
  hijriOffset: 0,
};

export type PlaceLocation = {
  name: string;
  country?: string;
  lat: number;
  lng: number;
  timezone: string;
  source: 'gps' | 'manual';
};

export type DayTimes = {
  date: CivilDate;
  times: Record<PrayerId, Date>;
  midnight: Date;
  lastThird: Date;
  isFriday: boolean;
  hijriMonth: number;
};

function buildParams(settings: PrayerSettings, coords: Coordinates, hijriMonth: number) {
  const params = CalculationMethod[settings.method]();
  params.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule =
    settings.highLatitude === 'auto'
      ? HighLatitudeRule.recommended(coords)
      : settings.highLatitude;
  if (settings.method === 'UmmAlQura' && settings.ramadanIsha && hijriMonth === 9) {
    params.ishaInterval = 120;
  }
  params.adjustments = { ...params.adjustments, ...settings.adjustments };
  return params;
}

/** Computes the six times plus midnight and the last third for a civil date at a place. */
export function computeDay(date: CivilDate, place: PlaceLocation, settings: PrayerSettings): DayTimes {
  const coords = new Coordinates(place.lat, place.lng);
  const hijriMonth = toHijri(date, settings.hijriOffset).month;
  const params = buildParams(settings, coords, hijriMonth);
  // adhan reads the calendar fields of this Date; its result is a set of absolute instants.
  const pt = new PrayerTimes(coords, new Date(date.year, date.month - 1, date.day, 12), params);
  const sunnah = new SunnahTimes(pt);
  return {
    date,
    times: {
      fajr: pt.fajr,
      sunrise: pt.sunrise,
      dhuhr: pt.dhuhr,
      asr: pt.asr,
      maghrib: pt.maghrib,
      isha: pt.isha,
    },
    midnight: sunnah.middleOfTheNight,
    lastThird: sunnah.lastThirdOfTheNight,
    isFriday: civilWeekday(date) === 5,
    hijriMonth,
  };
}

export function prayerLabel(id: PrayerId, isFriday: boolean): string {
  return id === 'dhuhr' && isFriday ? 'الجمعة' : PRAYER_NAMES[id];
}

export type NextPrayer = { id: PrayerId; at: Date; day: DayTimes; previous: { id: PrayerId; at: Date } | null };

/** The next obligatory prayer after `now` (sunrise is not counted). */
export function nextPrayer(now: Date, place: PlaceLocation, settings: PrayerSettings): NextPrayer {
  const today = civilDateIn(now, place.timezone);
  const days = [-1, 0, 1].map((o) => computeDay(addCivilDays(today, o), place, settings));
  const events = days.flatMap((d) => SALAH_IDS.map((id) => ({ id, at: d.times[id], day: d })));
  const idx = events.findIndex((e) => e.at.getTime() > now.getTime());
  const next = events[idx];
  const prev = idx > 0 ? events[idx - 1] : null;
  return { id: next.id, at: next.at, day: next.day, previous: prev ? { id: prev.id, at: prev.at } : null };
}

/** Times for every day of a Gregorian month. */
export function computeMonth(year: number, month: number, place: PlaceLocation, settings: PrayerSettings): DayTimes[] {
  const days: DayTimes[] = [];
  for (let d = 1; d <= 31; d++) {
    const date = { year, month, day: d };
    const check = new Date(Date.UTC(year, month - 1, d));
    if (check.getUTCMonth() !== month - 1) break;
    days.push(computeDay(date, place, settings));
  }
  return days;
}
