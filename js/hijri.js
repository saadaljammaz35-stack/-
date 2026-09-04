/**
 * التاريخ الهجري (أم القرى) واليوم من الأسبوع، وحالة رمضان.
 */

export const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const HIJRI_MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
];

export const GREG_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);

let hijriFmt = null;
function getFormatter() {
  if (hijriFmt) return hijriFmt;
  try {
    hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC'
    });
  } catch {
    hijriFmt = null;
  }
  return hijriFmt;
}

/** تحويل تقريبي احتياطي (الحساب الفلكي المدني) عند غياب دعم Intl */
function fallbackHijri(date) {
  const jd = Math.floor(date.getTime() / 86400000) + 2440588;
  const l0 = jd - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  let l = l0 - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719)
    + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { day, month, year };
}

/**
 * التاريخ الهجري ليوم ميلادي، مع إمكانية تعديل يدوي بالأيام (لاختلاف الرؤية).
 */
export function toHijri(date, offsetDays = 0) {
  const d = new Date(date.getTime() + offsetDays * 86400000);
  const fmt = getFormatter();
  if (fmt) {
    const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const parts = fmt.formatToParts(utc);
    const get = (t) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
    const day = get('day');
    const month = get('month');
    const year = get('year');
    if (day && month && year) return { day, month, year };
  }
  return fallbackHijri(d);
}

export function formatHijri(date, offsetDays = 0) {
  const h = toHijri(date, offsetDays);
  return `${toArabicDigits(h.day)} ${HIJRI_MONTHS[h.month - 1]} ${toArabicDigits(h.year)} هـ`;
}

export function formatGregorian(date) {
  return `${toArabicDigits(date.getDate())} ${GREG_MONTHS[date.getMonth()]} ${toArabicDigits(date.getFullYear())} م`;
}

export function weekdayName(date) {
  return WEEKDAYS[date.getDay()];
}

/** اليوم كاملًا: الأربعاء ٥ رمضان ١٤٤٧ هـ — ٤ سبتمبر ٢٠٢٦ م */
export function fullDateLine(date, offsetDays = 0) {
  return `${weekdayName(date)} · ${formatHijri(date, offsetDays)} · ${formatGregorian(date)}`;
}

/**
 * حالة رمضان: هل نحن فيه؟ وكم مضى وكم بقي؟
 */
export function ramadanStatus(date, offsetDays = 0) {
  const h = toHijri(date, offsetDays);
  const isRamadan = h.month === 9;
  const daysInMonth = ramadanLength(date, offsetDays);

  if (isRamadan) {
    return {
      isRamadan: true,
      day: h.day,
      total: daysInMonth,
      remaining: Math.max(0, daysInMonth - h.day),
      isLastTen: h.day >= 21,
      isOddNight: h.day >= 21 && h.day % 2 === 1,
      hijri: h
    };
  }

  return { isRamadan: false, daysUntil: daysUntilRamadan(date, offsetDays), hijri: h };
}

/** طول شهر رمضان الحالي (٢٩ أو ٣٠) بالتقويم المستخدم */
function ramadanLength(date, offsetDays) {
  const h = toHijri(date, offsetDays);
  if (h.month !== 9) return 30;
  // نتقدّم من اليوم الأول للشهر حتى يتغيّر الشهر
  let probe = new Date(date.getTime() - (h.day - 1) * 86400000);
  for (let i = 28; i <= 31; i++) {
    const t = toHijri(new Date(probe.getTime() + i * 86400000), offsetDays);
    if (t.month !== 9) return i;
  }
  return 30;
}

/** كم يومًا يفصلنا عن أول رمضان القادم */
function daysUntilRamadan(date, offsetDays) {
  for (let i = 1; i <= 400; i++) {
    const t = toHijri(new Date(date.getTime() + i * 86400000), offsetDays);
    if (t.month === 9 && t.day === 1) return i;
  }
  return null;
}

/** المناسبات الإسلامية القريبة */
export function upcomingOccasions(date, offsetDays = 0, limit = 4) {
  const targets = [
    { m: 9, d: 1, name: 'أول رمضان' },
    { m: 9, d: 21, name: 'ليالي العشر الأواخر' },
    { m: 10, d: 1, name: 'عيد الفطر' },
    { m: 12, d: 9, name: 'يوم عرفة' },
    { m: 12, d: 10, name: 'عيد الأضحى' },
    { m: 1, d: 1, name: 'رأس السنة الهجرية' },
    { m: 1, d: 10, name: 'يوم عاشوراء' },
    { m: 8, d: 15, name: 'منتصف شعبان' }
  ];
  const found = [];
  for (let i = 0; i <= 400 && found.length < limit; i++) {
    const t = toHijri(new Date(date.getTime() + i * 86400000), offsetDays);
    const hit = targets.find((x) => x.m === t.month && x.d === t.day);
    if (hit && !found.some((f) => f.name === hit.name)) {
      found.push({ name: hit.name, inDays: i });
    }
  }
  return found;
}

/** أيام الصيام المستحبّة اليوم */
export function sunnahFastToday(date, offsetDays = 0) {
  const h = toHijri(date, offsetDays);
  const dow = date.getDay();
  const notes = [];
  if (h.month === 9) return ['صيام رمضان — فريضة'];
  if (dow === 1 || dow === 4) notes.push('صيام الإثنين والخميس');
  if (h.day >= 13 && h.day <= 15) notes.push('الأيام البيض (١٣، ١٤، ١٥)');
  if (h.month === 10 && h.day >= 2 && h.day <= 8) notes.push('ستٌّ من شوال');
  if (h.month === 12 && h.day === 9) notes.push('يوم عرفة');
  if (h.month === 1 && (h.day === 9 || h.day === 10)) notes.push('تاسوعاء وعاشوراء');
  return notes;
}
