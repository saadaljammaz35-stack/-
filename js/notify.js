/**
 * التنبيهات — قبل الأذان بدقائق، وعند الأذان، وأذكار الصباح والمساء، وتذكير الورد.
 *
 * على iOS/Android (داخل القشرة الأصلية): تُجدول في نظام التشغيل نفسه،
 * فتصل والتطبيق مغلق تمامًا.
 * على المتصفح: تعمل ما دام التطبيق مفتوحًا أو في الخلفية.
 */
import { store } from './store.js';
import { calcPrayerTimes, PRAYER_META } from './prayer.js';
import { ramadanStatus } from './hijri.js';
import { isNative, nativePermission, cancelAllNative, scheduleNative, bindNativeTaps, MAX_PENDING } from './native.js';

let timers = [];
let tickHandle = null;

/** كم يومًا نجدول له مسبقًا في الوضع الأصلي */
const NATIVE_DAYS = 7;

export function notificationsSupported() {
  return isNative() || 'Notification' in window;
}

export function permission() {
  if (isNative()) return 'granted';   // يُتحقق منه فعليًّا عند التفعيل
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function requestPermission() {
  if (isNative()) return nativePermission();
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

async function show(title, body, tag, extra = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const options = {
    body, tag, dir: 'rtl', lang: 'ar',
    icon: 'assets/icon-192.png',
    badge: 'assets/badge.png',
    renotify: true,
    requireInteraction: false,
    silent: !store.get('notifications.sound', true),
    ...extra
  };
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) { await reg.showNotification(title, options); return true; }
  } catch { /* نكمل بالطريقة العادية */ }
  try { new Notification(title, options); return true; } catch { return false; }
}

export async function testNotification() {
  if (isNative()) {
    const n = await scheduleNative([{
      id: 999999, title: 'مع الله',
      body: 'تم تفعيل التنبيهات بنجاح — نسأل الله لك القبول.',
      at: new Date(Date.now() + 6000), sound: store.get('notifications.sound', true)
    }]);
    return n > 0;
  }
  return show('مع الله', 'تم تفعيل التنبيهات بنجاح — نسأل الله لك القبول.', 'test');
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function at(date, fn) {
  const delay = date.getTime() - Date.now();
  if (delay <= 0 || delay > 24 * 3600 * 1000) return;
  timers.push(setTimeout(fn, delay));
}

function parseHHMM(str, base) {
  const [h, m] = String(str || '00:00').split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h || 0, m || 0, 0, 0);
}

/** معرّف رقمي ثابت لكل إشعار (يحتاجه النظام الأصلي) */
function idFor(tag, date) {
  const key = `${tag}-${date.toISOString().slice(0, 10)}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2000000;
}

/**
 * بناء قائمة التنبيهات القادمة خلال عدد من الأيام.
 * @returns {Array<{id:number,title:string,body:string,at:Date,route:string,tag:string}>}
 */
function buildSchedule(days = 1) {
  const n = store.get('notifications');
  const out = [];
  if (!n?.enabled) return out;

  const loc = store.get('location');
  const now = new Date();
  const sound = !!n.sound;

  const base = {
    lat: loc.lat, lng: loc.lng, timeZone: loc.tz || null,
    method: store.get('method'),
    asrMethod: store.get('asrMethod'),
    adjustments: store.get('adjustments')
  };

  const push = (tag, day, when, title, body, route) => {
    if (when <= now) return;
    out.push({ id: idFor(tag, day), tag, title, body, at: when, route, sound });
  };

  for (let d = 0; d < days; d++) {
    const day = new Date(now.getTime() + d * 86400000);
    const isRamadan = ramadanStatus(day, store.get('hijriOffset', 0)).isRamadan;
    const times = calcPrayerTimes(day, { ...base, isRamadan });

    for (const meta of PRAYER_META) {
      if (meta.notPrayer) continue;
      const t = times[meta.key];
      if (!t) continue;

      if (n.beforeAdhan) {
        const mins = Math.max(1, Math.min(60, n.beforeAdhanMinutes || 5));
        push(`pre-${meta.key}`, day, new Date(t.getTime() - mins * 60000),
          `اقترب أذان ${meta.name}`,
          `بقي ${mins} دقائق على أذان ${meta.name}. استعدّ للصلاة.`, '#/prayer');
      }
      if (n.atAdhan) {
        push(`adhan-${meta.key}`, day, t,
          `حان الآن وقت أذان ${meta.name}`,
          'حيّ على الصلاة، حيّ على الفلاح.', '#/prayer');
      }
    }

    if (isRamadan) {
      push('suhoor', day, new Date(times.imsak.getTime() - 20 * 60000),
        'اقترب وقت الإمساك',
        'بقي نحو ٣٠ دقيقة على أذان الفجر — تسحّروا فإن في السحور بركة.', '#/prayer');
      push('iftar', day, times.maghrib,
        'حان وقت الإفطار',
        'ذهب الظمأ، وابتلّت العروق، وثبت الأجر إن شاء الله.', '#/list/duas/ramadan');
    }

    const daily = [
      ['morningAdhkar', 'morningAt', 'أذكار الصباح',
        'ابدأ يومك بذكر الله — أذكار الصباح بانتظارك.', '#/list/adhkar/morning', 'adhkar-morning'],
      ['eveningAdhkar', 'eveningAt', 'أذكار المساء',
        'حان وقت أذكار المساء — حصّن نفسك بذكر الله.', '#/list/adhkar/evening', 'adhkar-evening'],
      ['quranReminder', 'quranAt', 'وردك من القرآن',
        'لا تنسَ وردك اليوم من كتاب الله.', '#/quran', 'quran-daily']
    ];
    for (const [flag, timeKey, title, body, route, tag] of daily) {
      if (!n[flag]) continue;
      push(tag, day, parseHHMM(n[timeKey], day), title, body, route);
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

/**
 * إعادة جدولة كل التنبيهات.
 */
export async function scheduleAll() {
  clearTimers();

  const n = store.get('notifications');
  if (!n?.enabled) {
    if (isNative()) await cancelAllNative();
    return { scheduled: 0 };
  }

  if (isNative()) {
    // النظام الأصلي: نجدول أسبوعًا مقدّمًا فتصل والتطبيق مغلق
    await cancelAllNative();
    const items = buildSchedule(NATIVE_DAYS).slice(0, MAX_PENDING);
    const count = await scheduleNative(items);
    return { scheduled: count, native: true };
  }

  if (permission() !== 'granted') return { scheduled: 0 };

  // المتصفح: مؤقتات ضمن ٢٤ ساعة، تُجدّد كلما فُتح التطبيق
  const items = buildSchedule(1);
  for (const it of items) at(it.at, () => show(it.title, it.body, it.tag));
  return { scheduled: items.length, native: false };
}

/**
 * يبقي الجدولة حيّة: يعيدها دوريًّا وعند عودة التطبيق للواجهة.
 */
export function startScheduler() {
  bindNativeTaps();
  scheduleAll();
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = setInterval(scheduleAll, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleAll();
  });
  window.addEventListener('focus', scheduleAll);
}

export function stopScheduler() {
  clearTimers();
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
  if (isNative()) cancelAllNative();
}

/** عدد التنبيهات المجدولة حاليًّا — لعرضه في الإعدادات */
export function pendingCount() {
  return buildSchedule(isNative() ? NATIVE_DAYS : 1).length;
}
