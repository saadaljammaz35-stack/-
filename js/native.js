/**
 * جسر التشغيل الأصلي (iOS / Android عبر Capacitor).
 * إن كان التطبيق يعمل داخل قشرة أصلية استُخدمت الإشعارات المحلية للنظام،
 * وهي تعمل والتطبيق مغلق تمامًا. وإلا رجعنا لإشعارات المتصفح.
 */

export const isNative = () => {
  try {
    return !!(window.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

export const nativePlatform = () => {
  try { return window.Capacitor?.getPlatform?.() || 'web'; } catch { return 'web'; }
};

const plugin = () => window.Capacitor?.Plugins?.LocalNotifications || null;

/** حدّ آبل للإشعارات المعلّقة ٦٤ — نبقى دونه بأمان */
export const MAX_PENDING = 60;

export async function nativePermission() {
  const p = plugin();
  if (!p) return 'unsupported';
  try {
    const res = await p.checkPermissions();
    if (res.display === 'granted') return 'granted';
    const req = await p.requestPermissions();
    return req.display === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** إلغاء كل الإشعارات المجدولة سابقًا */
export async function cancelAllNative() {
  const p = plugin();
  if (!p) return;
  try {
    const pending = await p.getPending();
    if (pending?.notifications?.length) {
      await p.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch { /* لا شيء لإلغائه */ }
}

/**
 * جدولة قائمة إشعارات في نظام التشغيل.
 * @param {Array<{id:number, title:string, body:string, at:Date, sound:boolean}>} items
 */
export async function scheduleNative(items) {
  const p = plugin();
  if (!p) return 0;

  const now = Date.now();
  const list = items
    .filter((it) => it.at.getTime() > now + 5000)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_PENDING)
    .map((it) => ({
      id: it.id,
      title: it.title,
      body: it.body,
      schedule: { at: it.at, allowWhileIdle: true },
      sound: it.sound === false ? null : 'default',
      smallIcon: 'ic_stat_icon',
      extra: { route: it.route || '#/prayer' }
    }));

  if (!list.length) return 0;
  try {
    await p.schedule({ notifications: list });
    return list.length;
  } catch (e) {
    console.warn('تعذّرت جدولة الإشعارات الأصلية', e);
    return 0;
  }
}

/** فتح الشاشة المناسبة عند الضغط على الإشعار */
export function bindNativeTaps() {
  const p = plugin();
  if (!p) return;
  try {
    p.addListener('localNotificationActionPerformed', (event) => {
      const route = event?.notification?.extra?.route;
      if (route) location.hash = route;
    });
  } catch { /* غير مدعوم */ }
}

/** إخفاء شاشة البداية بعد جهوزية الواجهة */
export async function hideSplash() {
  try { await window.Capacitor?.Plugins?.SplashScreen?.hide(); } catch { /* تجاهل */ }
}

/** ضبط لون شريط الحالة حسب الوضع الليلي */
export async function syncStatusBar(dark) {
  const sb = window.Capacitor?.Plugins?.StatusBar;
  if (!sb) return;
  try {
    await sb.setStyle({ style: dark ? 'DARK' : 'LIGHT' });
    if (nativePlatform() === 'android') {
      await sb.setBackgroundColor({ color: dark ? '#171b16' : '#ecedeb' });
    }
  } catch { /* تجاهل */ }
}
