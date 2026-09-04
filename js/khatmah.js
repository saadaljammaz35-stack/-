/**
 * الختمة — خطة ختم القرآن: كم يومًا تريد؟ وكم صفحة في اليوم؟ وكم بقي؟
 */
import { store } from './store.js';
import { TOTAL_PAGES, TOTAL_JUZ, pageToJuz, pageToSurah, juzStartPage } from '../data/surahs.js';

const DAY = 86400000;
const todayISO = () => new Date().toISOString().slice(0, 10);
const dayDiff = (aISO, bISO) =>
  Math.round((new Date(bISO + 'T00:00:00') - new Date(aISO + 'T00:00:00')) / DAY);

/**
 * بدء ختمة جديدة.
 * @param {number} days عدد الأيام المطلوبة للختم
 * @param {number} startPage الصفحة التي تبدأ منها (١ افتراضيًّا)
 */
export function startKhatmah(days, startPage = 1) {
  const d = Math.max(1, Math.min(365, Math.round(days)));
  const khatmah = {
    startISO: todayISO(),
    days: d,
    startPage: Math.max(1, Math.min(TOTAL_PAGES, startPage)),
    lastPage: Math.max(0, startPage - 1),
    log: {},              // { 'YYYY-MM-DD': pagesReadThatDay }
    completedAt: null
  };
  store.set('khatmah', khatmah);
  return khatmah;
}

export function cancelKhatmah() {
  store.set('khatmah', null);
}

/** تسجيل الوصول إلى صفحة معيّنة */
export function markPage(page) {
  const k = store.get('khatmah');
  if (!k) return null;
  const p = Math.max(0, Math.min(TOTAL_PAGES, Math.round(page)));
  const delta = p - k.lastPage;
  if (delta !== 0) {
    const t = todayISO();
    k.log[t] = (k.log[t] || 0) + delta;
  }
  k.lastPage = p;
  if (p >= TOTAL_PAGES && !k.completedAt) {
    k.completedAt = new Date().toISOString();
    const history = store.get('khatmahHistory', []);
    history.unshift({
      startISO: k.startISO,
      endISO: todayISO(),
      days: dayDiff(k.startISO, todayISO()) + 1,
      planned: k.days
    });
    store.set('khatmahHistory', history.slice(0, 20));
  }
  store.set('khatmah', k);
  return k;
}

/** إضافة عدد صفحات مقروءة اليوم */
export function addPages(n) {
  const k = store.get('khatmah');
  if (!k) return null;
  return markPage(k.lastPage + n);
}

/**
 * حالة الختمة الكاملة: النسبة، ورد اليوم، التقدّم أو التأخّر، والموعد المتوقّع.
 */
export function khatmahStatus() {
  const k = store.get('khatmah');
  if (!k) return null;

  const today = todayISO();
  const elapsed = Math.max(0, dayDiff(k.startISO, today));   // كم يومًا مضى (٠ = أول يوم)
  const dayNumber = elapsed + 1;
  const daysLeft = Math.max(0, k.days - elapsed);

  const totalToRead = TOTAL_PAGES - (k.startPage - 1);
  const read = Math.max(0, k.lastPage - (k.startPage - 1));
  const remainingPages = Math.max(0, TOTAL_PAGES - k.lastPage);

  const perDayPlanned = Math.ceil(totalToRead / k.days);
  // ورد اليوم المتبقّي = ما يلزم لإنهاء ما تبقّى في الأيام المتبقية
  const perDayNow = daysLeft > 0 ? Math.ceil(remainingPages / daysLeft) : remainingPages;

  const readToday = k.log[today] || 0;
  const shouldHaveRead = Math.min(totalToRead, perDayPlanned * dayNumber);
  const diff = read - shouldHaveRead;   // موجب = متقدّم، سالب = متأخّر

  const pace = read > 0 && dayNumber > 0 ? read / dayNumber : 0;
  const projectedDays = pace > 0 ? Math.ceil(totalToRead / pace) : null;
  const finishDate = new Date(new Date(k.startISO + 'T00:00:00').getTime() + (k.days - 1) * DAY);

  return {
    khatmah: k,
    dayNumber,
    daysPlanned: k.days,
    daysLeft,
    read,
    remainingPages,
    totalToRead,
    percent: totalToRead ? Math.min(100, (read / totalToRead) * 100) : 0,
    perDayPlanned,
    perDayNow,
    readToday,
    todayRemaining: Math.max(0, perDayNow - readToday),
    diff,
    onTrack: diff >= 0,
    projectedDays,
    finishDate,
    currentPage: k.lastPage + 1 <= TOTAL_PAGES ? k.lastPage + 1 : TOTAL_PAGES,
    currentJuz: pageToJuz(Math.max(1, k.lastPage)),
    currentSurah: pageToSurah(Math.max(1, k.lastPage)),
    completed: !!k.completedAt
  };
}

/** خطط جاهزة */
export const PRESETS = [
  { days: 30, label: 'شهر', hint: 'جزء كل يوم — ٢٠ صفحة' },
  { days: 60, label: 'شهران', hint: 'نصف جزء يوميًّا — ١٠ صفحات' },
  { days: 15, label: 'نصف شهر', hint: 'جزءان يوميًّا — ٤٠ صفحة' },
  { days: 7, label: 'أسبوع', hint: 'حزب النبي ﷺ — ٨٧ صفحة' },
  { days: 90, label: 'ثلاثة أشهر', hint: '٧ صفحات يوميًّا' },
  { days: 365, label: 'سنة', hint: 'صفحتان يوميًّا' }
];

/** كم صفحة في اليوم لعدد أيام معيّن */
export const pagesPerDay = (days, startPage = 1) =>
  Math.ceil((TOTAL_PAGES - (startPage - 1)) / Math.max(1, days));

/** كم يومًا لعدد صفحات في اليوم */
export const daysForPages = (perDay) => Math.ceil(TOTAL_PAGES / Math.max(1, perDay));

export { TOTAL_PAGES, TOTAL_JUZ, pageToJuz, pageToSurah, juzStartPage };
