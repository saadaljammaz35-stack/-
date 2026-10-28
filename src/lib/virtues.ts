// The virtuous days and seasons of the Hijri year. Each one names the hadiths (HadeethEnc ids
// in the content database) that establish it; the app shows them with their grade and source.
import { addCivilDays, civilWeekday, toHijri, type CivilDate } from './hijri';

export type VirtueId = 'monday' | 'thursday' | 'white-days' | 'arafah' | 'tasua' | 'ashura' | 'friday';
export type SeasonId = 'muharram' | 'shaban' | 'ramadan-last-ten' | 'shawwal-six' | 'dhul-hijjah-ten';

type Text = { ar: string; en: string };

export const VIRTUES: Record<VirtueId, { title: Text; note: Text; fast: boolean; hadith: number[] }> = {
  monday: {
    title: { ar: 'يوم الاثنين', en: 'Monday' },
    note: { ar: 'تُعرض فيه الأعمال، ويُستحب صيامه', en: 'Deeds are presented; fasting is recommended' },
    fast: true,
    hadith: [5908],
  },
  thursday: {
    title: { ar: 'يوم الخميس', en: 'Thursday' },
    note: { ar: 'تُعرض فيه الأعمال، ويُستحب صيامه', en: 'Deeds are presented; fasting is recommended' },
    fast: true,
    hadith: [5908],
  },
  'white-days': {
    title: { ar: 'الأيام البيض', en: 'The White Days' },
    note: { ar: 'صيام الثالث عشر والرابع عشر والخامس عشر من الشهر', en: 'Fasting the 13th, 14th and 15th of the month' },
    fast: true,
    hadith: [10108, 4538],
  },
  arafah: {
    title: { ar: 'يوم عرفة', en: 'The Day of Arafah' },
    note: { ar: 'صيامه يكفّر السنة التي قبله والسنة التي بعده', en: 'Fasting it expiates the year before and the year after' },
    fast: true,
    hadith: [65874],
  },
  tasua: {
    title: { ar: 'يوم تاسوعاء', en: 'Tasu‘a' },
    note: { ar: 'يُصام مع عاشوراء', en: 'Fasted together with Ashura' },
    fast: true,
    hadith: [6217, 65522],
  },
  ashura: {
    title: { ar: 'يوم عاشوراء', en: 'The Day of Ashura' },
    note: { ar: 'صيامه يكفّر السنة التي قبله', en: 'Fasting it expiates the year before' },
    fast: true,
    hadith: [65874, 10121],
  },
  friday: {
    title: { ar: 'يوم الجمعة', en: 'Friday' },
    note: { ar: 'خير يوم طلعت عليه الشمس، وفيه ساعة إجابة آخرَ ساعة بعد العصر', en: 'The best day; its hour of answered prayer is the last hour after Asr' },
    fast: false,
    hadith: [3711, 65753, 65755],
  },
};

export const SEASONS: Record<SeasonId, { month: number; from: number; to: number; title: Text; note: Text; hadith: number[] }> = {
  muharram: {
    month: 1,
    from: 1,
    to: 30,
    title: { ar: 'شهر الله المحرّم', en: 'Muharram' },
    note: { ar: 'أفضل الصيام بعد رمضان', en: 'The best month for fasting after Ramadan' },
    hadith: [11261],
  },
  shaban: {
    month: 8,
    from: 1,
    to: 30,
    title: { ar: 'شهر شعبان', en: 'Sha‘ban' },
    note: { ar: 'كان النبي ﷺ يكثر الصيام فيه', en: 'The Prophet ﷺ fasted most in it' },
    hadith: [65517],
  },
  'ramadan-last-ten': {
    month: 9,
    from: 21,
    to: 30,
    title: { ar: 'العشر الأواخر من رمضان', en: 'The last ten nights of Ramadan' },
    note: { ar: 'تحرّوا ليلة القدر في الليالي الوتر منها', en: 'Seek Laylat al-Qadr in their odd nights' },
    hadith: [4540, 4202],
  },
  'shawwal-six': {
    month: 10,
    from: 2,
    to: 30,
    title: { ar: 'ست من شوال', en: 'Six days of Shawwal' },
    note: { ar: 'من صامها بعد رمضان كان كصيام الدهر', en: 'With Ramadan, like fasting the whole year' },
    hadith: [65523],
  },
  'dhul-hijjah-ten': {
    month: 12,
    from: 1,
    to: 10,
    title: { ar: 'عشر ذي الحجة', en: 'The first ten days of Dhul-Hijjah' },
    note: { ar: 'أحب الأيام إلى الله للعمل الصالح', en: 'The days in which good deeds are most beloved to Allah' },
    hadith: [6255],
  },
};

/** The last third of the night, when «ينزل ربنا تبارك وتعالى كل ليلة إلى السماء الدنيا». */
export const NIGHT_HADITH = 10412;

/** Days on which no voluntary fast is suggested: Ramadan, Eid al-Fitr, Eid al-Adha and the days of Tashreeq. */
export function noVoluntaryFast(date: CivilDate, hijriOffset = 0): boolean {
  const h = toHijri(date, hijriOffset);
  return h.month === 9 || (h.month === 10 && h.day === 1) || (h.month === 12 && h.day >= 10 && h.day <= 13);
}

/** The virtues of one day, most specific first. */
export function virtuesOn(date: CivilDate, hijriOffset = 0): VirtueId[] {
  const h = toHijri(date, hijriOffset);
  const weekday = civilWeekday(date);
  const out: VirtueId[] = [];
  if (!noVoluntaryFast(date, hijriOffset)) {
    if (h.month === 12 && h.day === 9) out.push('arafah');
    if (h.month === 1 && h.day === 9) out.push('tasua');
    if (h.month === 1 && h.day === 10) out.push('ashura');
    if (h.day >= 13 && h.day <= 15) out.push('white-days');
    if (weekday === 1) out.push('monday');
    if (weekday === 4) out.push('thursday');
  }
  if (weekday === 5) out.push('friday');
  return out;
}

/** The season a day falls in, with its day number in the season (1-based). */
export function seasonOn(date: CivilDate, hijriOffset = 0): { id: SeasonId; day: number } | null {
  const h = toHijri(date, hijriOffset);
  for (const [id, s] of Object.entries(SEASONS) as [SeasonId, (typeof SEASONS)[SeasonId]][]) {
    if (h.month === s.month && h.day >= s.from && h.day <= s.to) return { id, day: h.day - s.from + 1 };
  }
  return null;
}

export type Occasion = { date: CivilDate; virtues: VirtueId[]; seasonStarts: SeasonId | null };

/** Days in the coming `days` (from `from`, inclusive) with a virtue or the first day of a season. */
export function upcomingOccasions(from: CivilDate, days: number, hijriOffset = 0): Occasion[] {
  const out: Occasion[] = [];
  for (let i = 0; i < days; i++) {
    const date = addCivilDays(from, i);
    const season = seasonOn(date, hijriOffset);
    const seasonStarts = season?.day === 1 ? season.id : null;
    const virtues = virtuesOn(date, hijriOffset);
    if (virtues.length || seasonStarts) out.push({ date, virtues, seasonStarts });
  }
  return out;
}
