/**
 * حساب مواقيت الصلاة فلكيًّا — يعمل بلا إنترنت.
 * الطريقة الافتراضية: أم القرى (مكة المكرمة).
 */

const DEG = Math.PI / 180;
const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const tan = (d) => Math.tan(d * DEG);
const asin = (x) => Math.asin(x) / DEG;
const acos = (x) => Math.acos(x) / DEG;
const atan2d = (y, x) => Math.atan2(y, x) / DEG;
const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };

export const METHODS = {
  ummAlQura: { name: 'أم القرى — مكة المكرمة', fajr: 18.5, isha: '90 min' },
  mwl: { name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
  egypt: { name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
  karachi: { name: 'جامعة العلوم الإسلامية — كراتشي', fajr: 18, isha: 18 },
  isna: { name: 'أمريكا الشمالية ISNA', fajr: 15, isha: 15 },
  gulf: { name: 'هيئة الخليج', fajr: 19.5, isha: '90 min' },
  dubai: { name: 'دائرة الشؤون الإسلامية — دبي', fajr: 18.2, isha: 18.2 },
  qatar: { name: 'قطر', fajr: 18, isha: '90 min' },
  kuwait: { name: 'الكويت', fajr: 18, isha: 17.5 },
  turkey: { name: 'ديانت — تركيا', fajr: 18, isha: 17 },
  tehran: { name: 'طهران', fajr: 17.7, isha: 14 },
  singapore: { name: 'سنغافورة', fajr: 20, isha: 18 }
};

export const ASR_METHODS = {
  standard: { name: 'الجمهور (الشافعي ومالك وأحمد)', factor: 1 },
  hanafi: { name: 'الحنفي', factor: 2 }
};

export const PRAYER_META = [
  { key: 'fajr', name: 'الفجر', icon: 'fajr' },
  { key: 'sunrise', name: 'الشروق', icon: 'sunrise', notPrayer: true },
  { key: 'dhuhr', name: 'الظهر', icon: 'dhuhr' },
  { key: 'asr', name: 'العصر', icon: 'asr' },
  { key: 'maghrib', name: 'المغرب', icon: 'maghrib' },
  { key: 'isha', name: 'العشاء', icon: 'isha' }
];

/**
 * إزاحة منطقة زمنية معيّنة بالساعات في لحظة معيّنة (تراعي التوقيت الصيفي).
 * بلا منطقة → إزاحة جهاز المستخدم.
 */
export function tzOffsetHours(date, timeZone) {
  if (!timeZone) return -date.getTimezoneOffset() / 60;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(date).reduce((a, p) => (a[p.type] = p.value, a), {});
    const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
      +parts.hour % 24, +parts.minute, +parts.second);
    return Math.round((asUTC - date.getTime()) / 60000) / 60;
  } catch {
    return -date.getTimezoneOffset() / 60;
  }
}

/** اليوم اليولياني */
function julianDate(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

/** ميل الشمس ومعادلة الزمن */
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(atan2d(cos(e) * sin(L), cos(L)) / 15, 24);
  const decl = asin(sin(e) * sin(L));
  const eqt = q / 15 - RA;
  return { decl, eqt };
}

/** الزاوية الزمنية لارتفاع معيّن */
function timeAngle(angle, lat, decl) {
  const x = (-sin(angle) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl));
  if (x > 1 || x < -1) return NaN; // لا يحدث في خطوط العرض العالية
  return acos(x) / 15;
}

function asrAngleTime(factor, lat, decl) {
  const angle = -Math.atan(1 / (factor + tan(Math.abs(lat - decl)))) / DEG;
  return timeAngle(angle, lat, decl);
}

/**
 * حساب المواقيت ليوم معيّن.
 * @returns {{fajr:Date, sunrise:Date, dhuhr:Date, asr:Date, maghrib:Date, isha:Date, imsak:Date}}
 */
export function calcPrayerTimes(date, opts) {
  const {
    lat, lng,
    method = 'ummAlQura',
    asrMethod = 'standard',
    isRamadan = false,
    adjustments = {},
    highLatRule = 'angleBased',
    timeZone = null
  } = opts;

  const cfg = METHODS[method] || METHODS.ummAlQura;
  const asrFactor = (ASR_METHODS[asrMethod] || ASR_METHODS.standard).factor;

  // إزاحة منطقة المدينة المختارة (أو الجهاز) — تراعي التوقيت الصيفي تلقائيًّا
  const tzOffset = tzOffsetHours(date, timeZone);

  const jd = julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
  const { decl, eqt } = sunPosition(jd);

  const dhuhr = 12 + tzOffset - lng / 15 - eqt;
  let fajr = dhuhr - timeAngle(cfg.fajr, lat, decl);
  const sunrise = dhuhr - timeAngle(0.833, lat, decl);
  const asr = dhuhr + asrAngleTime(asrFactor, lat, decl);
  const maghrib = dhuhr + timeAngle(0.833, lat, decl);
  let isha;

  if (typeof cfg.isha === 'string') {
    // دقائق ثابتة بعد المغرب (٩٠ دقيقة، و١٢٠ في رمضان عند أم القرى)
    const mins = (method === 'ummAlQura' && isRamadan) ? 120 : parseInt(cfg.isha, 10);
    isha = maghrib + mins / 60;
  } else {
    isha = dhuhr + timeAngle(cfg.isha, lat, decl);
  }

  // معالجة خطوط العرض العالية حين تتعذّر الزاوية
  if (Number.isNaN(fajr) || Number.isNaN(isha)) {
    const night = 24 - (maghrib - sunrise);
    if (highLatRule === 'oneSeventh') {
      if (Number.isNaN(fajr)) fajr = sunrise - night / 7;
      if (Number.isNaN(isha)) isha = maghrib + night / 7;
    } else {
      if (Number.isNaN(fajr)) fajr = sunrise - night * (cfg.fajr / 60);
      if (Number.isNaN(isha)) isha = maghrib + night * ((typeof cfg.isha === 'number' ? cfg.isha : 18) / 60);
    }
  }

  const raw = {
    fajr, sunrise, dhuhr: dhuhr + 1 / 60, asr, maghrib, isha,
    imsak: fajr - 10 / 60
  };

  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const adj = (adjustments[k] || 0) / 60;
    out[k] = instantFrom(date, v + adj, tzOffset);
  }
  return out;
}

/**
 * تحويل «ساعة الحائط» في منطقة المدينة إلى لحظة زمنية حقيقية،
 * حتى يبقى العدّ التنازلي صحيحًا ولو كان المستخدم في منطقة أخرى.
 */
function instantFrom(base, wallHours, tzOffset) {
  const utcMidnight = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
  return new Date(utcMidnight + Math.round((wallHours - tzOffset) * 3600 * 1000));
}

/**
 * الصلاة القادمة والحالية مع الوقت المتبقّي.
 */
export function nextPrayer(now, opts) {
  const today = calcPrayerTimes(now, opts);
  const list = PRAYER_META.map((m) => ({ ...m, time: today[m.key] }));

  for (const p of list) {
    if (p.time > now) {
      const prevIdx = list.indexOf(p) - 1;
      return {
        next: p,
        current: prevIdx >= 0 ? list[prevIdx] : null,
        times: today,
        remaining: p.time - now
      };
    }
  }
  // بعد العشاء: القادم فجر الغد
  const tomorrow = new Date(now.getTime() + 86400000);
  const t2 = calcPrayerTimes(tomorrow, opts);
  return {
    next: { key: 'fajr', name: 'الفجر', icon: 'fajr', time: t2.fajr },
    current: list[list.length - 1],
    times: today,
    tomorrow: t2,
    remaining: t2.fajr - now
  };
}

/** الوقت المتبقّي بصيغة مقروءة */
export function formatRemaining(ms) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s, text: h > 0 ? `${toAr(h)} س ${toAr(m)} د` : `${toAr(m)} د ${toAr(s)} ث` };
}

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toAr = (s) => String(s).replace(/\d/g, (d) => AR_DIGITS[+d]);

/** عرض الوقت بتوقيت المدينة المختارة */
export function formatTime(date, use24 = false, timeZone = null) {
  if (!date || Number.isNaN(date.getTime?.())) return '—:—';
  let h = date.getHours();
  let m = date.getMinutes();
  if (timeZone) {
    try {
      const p = new Intl.DateTimeFormat('en-US', {
        timeZone, hour12: false, hour: '2-digit', minute: '2-digit'
      }).formatToParts(date).reduce((a, x) => (a[x.type] = x.value, a), {});
      h = +p.hour % 24;
      m = +p.minute;
    } catch { /* نُبقي توقيت الجهاز */ }
  }
  const mm = String(m).padStart(2, '0');
  if (use24) return toAr(`${String(h).padStart(2, '0')}:${mm}`);
  const suffix = h < 12 ? 'ص' : 'م';
  const h12 = h % 12 || 12;
  return `${toAr(h12)}:${toAr(mm)} ${suffix}`;
}
