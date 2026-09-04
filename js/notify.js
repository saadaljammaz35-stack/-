/**
 * التنبيهات — قبل الأذان بدقائق، وعند الأذان، وأذكار الصباح والمساء، وتذكير الورد.
 * تعمل ما دام التطبيق مفتوحًا أو في الخلفية (Service Worker).
 */
import { store } from './store.js';
import { calcPrayerTimes, PRAYER_META } from './prayer.js';
import { ramadanStatus } from './hijri.js';

let timers = [];
let tickHandle = null;

export function notificationsSupported() {
  return 'Notification' in window;
}

export function permission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

async function show(title, body, tag, extra = {}) {
  if (permission() !== 'granted') return false;
  const options = {
    body,
    tag,
    dir: 'rtl',
    lang: 'ar',
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

export const testNotification = () =>
  show('مع الله', 'تم تفعيل التنبيهات بنجاح — نسأل الله لك القبول.', 'test');

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function at(date, fn) {
  const delay = date.getTime() - Date.now();
  // setTimeout يتعثّر مع المدد الطويلة جدًّا — نجدولها ضمن ٢٤ ساعة فقط
  if (delay <= 0 || delay > 24 * 3600 * 1000) return;
  timers.push(setTimeout(fn, delay));
}

function parseHHMM(str, base = new Date()) {
  const [h, m] = String(str || '00:00').split(':').map(Number);
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h || 0, m || 0, 0, 0);
  return d;
}

/**
 * إعادة جدولة كل تنبيهات اليوم (واليوم التالي عند الحاجة).
 */
export function scheduleAll() {
  clearTimers();
  const n = store.get('notifications');
  if (!n?.enabled || permission() !== 'granted') return { scheduled: 0 };

  const loc = store.get('location');
  const now = new Date();
  const opts = {
    lat: loc.lat, lng: loc.lng, timeZone: loc.tz || null,
    method: store.get('method'),
    asrMethod: store.get('asrMethod'),
    adjustments: store.get('adjustments'),
    isRamadan: ramadanStatus(now, store.get('hijriOffset', 0)).isRamadan
  };

  let count = 0;
  const scheduleForDay = (day) => {
    const times = calcPrayerTimes(day, opts);
    for (const meta of PRAYER_META) {
      const t = times[meta.key];
      if (!t || t <= now) continue;

      if (meta.notPrayer) continue;

      if (n.beforeAdhan) {
        const mins = Math.max(1, Math.min(60, n.beforeAdhanMinutes || 5));
        const pre = new Date(t.getTime() - mins * 60000);
        if (pre > now) {
          count++;
          at(pre, () => show(
            `اقترب أذان ${meta.name}`,
            `بقي ${mins} دقائق على أذان ${meta.name}. استعدّ للصلاة.`,
            'pre-' + meta.key
          ));
        }
      }

      if (n.atAdhan) {
        count++;
        at(t, () => show(
          `حان الآن وقت أذان ${meta.name}`,
          'حيّ على الصلاة، حيّ على الفلاح.',
          'adhan-' + meta.key
        ));
      }
    }

    // السحور والإفطار في رمضان
    if (opts.isRamadan) {
      const imsak = times.imsak;
      if (imsak > now) {
        count++;
        at(new Date(imsak.getTime() - 20 * 60000), () => show(
          'اقترب وقت الإمساك',
          'بقي نحو ٣٠ دقيقة على أذان الفجر — تسحّروا فإن في السحور بركة.',
          'suhoor'
        ));
      }
      if (times.maghrib > now) {
        count++;
        at(times.maghrib, () => show(
          'حان وقت الإفطار',
          'ذهب الظمأ، وابتلّت العروق، وثبت الأجر إن شاء الله.',
          'iftar'
        ));
      }
    }
  };

  scheduleForDay(now);

  // أذكار الصباح والمساء والورد
  const daily = [
    ['morningAdhkar', 'morningAt', 'أذكار الصباح', 'ابدأ يومك بذكر الله — أذكار الصباح بانتظارك.', 'adhkar-morning'],
    ['eveningAdhkar', 'eveningAt', 'أذكار المساء', 'حان وقت أذكار المساء — حصّن نفسك بذكر الله.', 'adhkar-evening'],
    ['quranReminder', 'quranAt', 'وردك من القرآن', 'لا تنسَ وردك اليوم من كتاب الله.', 'quran-daily']
  ];

  for (const [flag, timeKey, title, body, tag] of daily) {
    if (!n[flag]) continue;
    const when = parseHHMM(n[timeKey], now);
    if (when > now) {
      count++;
      at(when, () => show(title, body, tag));
    }
  }

  return { scheduled: count };
}

/**
 * يبقي الجدولة حيّة: يعيد الجدولة كل ١٥ دقيقة وعند عودة التطبيق للواجهة.
 */
export function startScheduler() {
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
}
