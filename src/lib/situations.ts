// «أذكار المواقف»: places and situations, each with its chapters in Hisn al-Muslim.

export type Situation = { id: string; ar: string; en: string; icon: string; chapters: number[] };

export const PLACES: Situation[] = [
  { id: 'leave-home', ar: 'الخروج من البيت', en: 'Leaving home', icon: 'door-open', chapters: [10] },
  { id: 'enter-home', ar: 'دخول البيت', en: 'Entering home', icon: 'house', chapters: [11] },
  { id: 'to-mosque', ar: 'الذهاب إلى المسجد', en: 'Going to the mosque', icon: 'footprints', chapters: [12] },
  { id: 'enter-mosque', ar: 'دخول المسجد', en: 'Entering the mosque', icon: 'landmark', chapters: [13] },
  { id: 'leave-mosque', ar: 'الخروج من المسجد', en: 'Leaving the mosque', icon: 'log-out', chapters: [14] },
  { id: 'market', ar: 'دخول السوق', en: 'Entering the market', icon: 'shopping-bag', chapters: [98] },
  { id: 'toilet', ar: 'الخلاء', en: 'The washroom', icon: 'droplets', chapters: [6, 7] },
  { id: 'riding', ar: 'الركوب', en: 'Riding', icon: 'car', chapters: [95] },
  { id: 'travel', ar: 'السفر', en: 'Travel', icon: 'plane', chapters: [96, 102, 104, 105] },
  { id: 'town', ar: 'دخول بلدة', en: 'Entering a town', icon: 'building', chapters: [97] },
  { id: 'graves', ar: 'زيارة القبور', en: 'Visiting graves', icon: 'flower', chapters: [60] },
];

export const STATES: Situation[] = [
  { id: 'rain', ar: 'المطر', en: 'Rain', icon: 'cloud-rain', chapters: [64, 65] },
  { id: 'wind', ar: 'الريح', en: 'Wind', icon: 'wind', chapters: [61] },
  { id: 'thunder', ar: 'الرعد', en: 'Thunder', icon: 'cloud-lightning', chapters: [62] },
  { id: 'hilal', ar: 'رؤية الهلال', en: 'The new moon', icon: 'moon', chapters: [67] },
  { id: 'anger', ar: 'الغضب', en: 'Anger', icon: 'flame', chapters: [82] },
  { id: 'worry', ar: 'الهم والحزن', en: 'Worry and grief', icon: 'cloud', chapters: [34, 35] },
  { id: 'fear', ar: 'الفزع', en: 'Alarm', icon: 'shield', chapters: [126, 30] },
  { id: 'pain', ar: 'الوجع', en: 'Pain', icon: 'heart-pulse', chapters: [124] },
  { id: 'sick-visit', ar: 'عيادة المريض', en: 'Visiting the sick', icon: 'stethoscope', chapters: [49, 50] },
  { id: 'calamity', ar: 'المصيبة', en: 'A calamity', icon: 'cloud-drizzle', chapters: [53] },
  { id: 'sneeze', ar: 'العطاس', en: 'Sneezing', icon: 'smile', chapters: [77] },
  { id: 'rooster', ar: 'صياح الديك ونهيق الحمار', en: 'A rooster or donkey', icon: 'bird', chapters: [110] },
  { id: 'good-news', ar: 'ما يسرّ وما يكره', en: 'Good or bad news', icon: 'sparkles', chapters: [106, 122, 123] },
  { id: 'gathering', ar: 'كفارة المجلس', en: 'Leaving a gathering', icon: 'users', chapters: [85] },
  { id: 'eye', ar: 'خشية العين', en: 'Fearing the evil eye', icon: 'eye', chapters: [125] },
];

export const ALL_SITUATIONS = [...PLACES, ...STATES];

/** Weather now, from MET Norway's location forecast. */
export type Weather = { rain: boolean; thunder: boolean; wind: boolean; windMs: number };

/** Wind strong enough to be felt as «الريح» (a strong breeze, about 36 km/h). */
export const STRONG_WIND_MS = 10;

export function parseWeather(json: unknown): Weather | null {
  const series = (json as { properties?: { timeseries?: { data?: Record<string, unknown> }[] } })?.properties?.timeseries;
  const now = series?.[0]?.data as
    | { instant?: { details?: { wind_speed?: number } }; next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } } }
    | undefined;
  if (!now) return null;
  const symbol = now.next_1_hours?.summary?.symbol_code ?? '';
  const mm = now.next_1_hours?.details?.precipitation_amount ?? 0;
  const windMs = now.instant?.details?.wind_speed ?? 0;
  return {
    rain: mm >= 0.2 || /rain|sleet|showers/.test(symbol),
    thunder: /thunder/.test(symbol),
    wind: windMs >= STRONG_WIND_MS,
    windMs,
  };
}
