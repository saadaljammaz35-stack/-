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
  { id: 'wudu', ar: 'الوضوء', en: 'Wudu', icon: 'droplet', chapters: [8, 9] },
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
  { id: 'debt', ar: 'الدَّين', en: 'Debt', icon: 'wallet', chapters: [41] },
  { id: 'hard', ar: 'أمر صعب', en: 'A hard matter', icon: 'mountain', chapters: [43, 46] },
  { id: 'sin', ar: 'بعد الذنب', en: 'After a sin', icon: 'undo', chapters: [44, 129] },
  { id: 'waswasa', ar: 'الوسوسة', en: 'Whispers of doubt', icon: 'brain', chapters: [40, 42, 45] },
  { id: 'oppressor', ar: 'الخوف من ظالم أو عدو', en: 'Fearing an oppressor or enemy', icon: 'shield-alert', chapters: [36, 37, 39] },
  { id: 'afflicted', ar: 'رؤية مبتلى', en: 'Seeing someone afflicted', icon: 'hand-heart', chapters: [83] },
  { id: 'waking', ar: 'الاستيقاظ من النوم', en: 'Waking up', icon: 'sunrise', chapters: [1] },
  { id: 'food', ar: 'الطعام', en: 'Food', icon: 'utensils', chapters: [69, 70, 71] },
  { id: 'clothes', ar: 'اللباس', en: 'Clothing', icon: 'shirt', chapters: [2, 3, 4, 5] },
  { id: 'newborn', ar: 'المولود', en: 'A newborn', icon: 'baby', chapters: [47, 48] },
  { id: 'marriage', ar: 'الزواج', en: 'Marriage', icon: 'heart', chapters: [79, 80] },
  { id: 'iftar', ar: 'إفطار الصائم', en: 'Breaking the fast', icon: 'moon-star', chapters: [68, 73, 74, 75] },
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
