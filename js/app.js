/** مع الله — نواة التطبيق: الهيكل، الشريط العلوي، التنقّل */
import { h, ar, toast, daysWord } from './ui.js';
import { ICONS, LOGO } from './icons.js';
import { store } from './store.js';
import { calcPrayerTimes, formatRemaining, formatTime } from './prayer.js';
import { ramadanStatus, formatHijri, weekdayName, formatGregorian, sunnahFastToday } from './hijri.js';
import * as views from './views.js';
import * as notify from './notify.js';

const app = document.getElementById('app');
const iconHTML = (n) => ICONS[n] || ICONS.info;

/* ===========================================================
   شريط الصيام العلوي
   =========================================================== */
const fastingBar = document.getElementById('fastingBar');

function prayerOpts() {
  const loc = store.get('location');
  return {
    lat: loc.lat, lng: loc.lng, timeZone: loc.tz || null,
    method: store.get('method'),
    asrMethod: store.get('asrMethod'),
    adjustments: store.get('adjustments'),
    isRamadan: ramadanStatus(new Date(), store.get('hijriOffset', 0)).isRamadan
  };
}

function renderFastingBar() {
  const mode = store.get('fastingBar', 'auto');
  const now = new Date();
  const off = store.get('hijriOffset', 0);
  const ram = ramadanStatus(now, off);

  // في الوضع التلقائي: يظهر في رمضان فقط، ويختفي من نفسه بانتهائه
  if (mode === 'off' || (mode === 'auto' && !ram.isRamadan)) {
    fastingBar.hidden = true;
    fastingBar.innerHTML = '';
    return;
  }
  fastingBar.hidden = false;

  const times = calcPrayerTimes(now, prayerOpts());
  const fajr = times.fajr, maghrib = times.maghrib;
  const isFastingNow = now >= fajr && now < maghrib;

  let start, end, label, labelIcon, fillClass;
  if (isFastingNow) {
    start = fajr; end = maghrib;
    label = 'صائم — يتبقّى على الإفطار';
    labelIcon = 'sunset';
    fillClass = '';
  } else {
    // فترة الإفطار: من مغرب اليوم إلى فجر الغد
    const tomorrow = calcPrayerTimes(new Date(now.getTime() + 86400000), prayerOpts());
    if (now >= maghrib) { start = maghrib; end = tomorrow.fajr; }
    else { // بعد منتصف الليل وقبل الفجر
      const yesterday = calcPrayerTimes(new Date(now.getTime() - 86400000), prayerOpts());
      start = yesterday.maghrib; end = fajr;
    }
    label = 'مفطر — يتبقّى على الإمساك';
    labelIcon = 'sunrise';
    fillClass = ' fasting-fill--night';
  }

  const total = end - start;
  const done = Math.min(Math.max(now - start, 0), total);
  const pct = total > 0 ? (done / total) * 100 : 0;
  const remaining = formatRemaining(end - now);

  const dateLine = ram.isRamadan
    ? `${weekdayName(now)} · ${ar(ram.day)} رمضان ${ar(ram.hijri.year)} هـ · ${formatGregorian(now)}`
    : `${weekdayName(now)} · ${formatHijri(now, off)} · ${formatGregorian(now)}`;

  // خارج رمضان (وضع «دائمًا»): نعرض صيام النافلة إن وُجد، وإلا العدّ حتى رمضان
  const sunnah = sunnahFastToday(now, off);
  const countText = ram.isRamadan
    ? `اليوم ${ar(ram.day)} من ${ar(ram.total)} · بقي ${daysWord(ram.remaining)}`
    : sunnah.length ? sunnah[0]
    : ram.daysUntil ? `رمضان بعد ${daysWord(ram.daysUntil)}`
    : '';

  fastingBar.innerHTML = `
    <div class="fasting-bar__top">
      <div class="fasting-bar__label">${iconHTML(labelIcon)}<span>${label} ${ar(remaining.h)}:${ar(String(remaining.m).padStart(2, '0'))}</span></div>
      <div class="fasting-bar__count">${countText}</div>
    </div>
    <div class="fasting-track"><div class="fasting-fill${fillClass}" style="width:${pct.toFixed(1)}%"></div></div>
    <div class="fasting-bar__meta">
      <span>${isFastingNow ? 'الفجر ' + formatTime(start, store.get('time24'), store.get('location.tz')) : 'المغرب ' + formatTime(start, store.get('time24'), store.get('location.tz'))}</span>
      <span>${ar(Math.round(pct))}٪</span>
      <span>${isFastingNow ? 'المغرب ' + formatTime(end, store.get('time24'), store.get('location.tz')) : 'الفجر ' + formatTime(end, store.get('time24'), store.get('location.tz'))}</span>
    </div>
    <div class="fasting-bar__date">${dateLine}</div>`;
}

/* ===========================================================
   الترويسة والتبويبات
   =========================================================== */
function renderChrome() {
  const bar = document.getElementById('appbar');
  bar.innerHTML = '';
  bar.append(
    h('div', { class: 'appbar__group' },
      h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'الإعدادات', html: iconHTML('settings') }),
      h('a', { class: 'icon-btn', href: '#/search', 'aria-label': 'بحث', html: iconHTML('search') }),
      h('a', { class: 'icon-btn', href: '#/favorites', 'aria-label': 'المحفوظات', html: iconHTML('bookmark') })
    ),
    h('a', { class: 'brand', href: '#/home', 'aria-label': 'مع الله' },
      h('span', { class: 'brand__mark', html: LOGO }),
      h('span', { class: 'brand__name', text: 'مع الله' })),
    h('div', { class: 'appbar__group' },
      h('a', { class: 'icon-btn', href: '#/live', 'aria-label': 'البث المباشر', html: iconHTML('play') })
    )
  );

  const tabs = document.getElementById('tabs');
  const items = [
    ['المنوعة', '#/home'],
    ['الصلاة', '#/prayer'],
    ['القرآن', '#/quran'],
    ['القبلة', '#/qibla'],
    ['الأحاديث', '#/hadith'],
    ['المفضلة', '#/favorites'],
    ['العداد', '#/counter']
  ];
  tabs.innerHTML = '';
  for (const [name, href] of items) {
    tabs.append(h('a', { class: 'tab', href, role: 'tab', 'data-href': href, text: name }));
  }
}

function syncTabs(route) {
  document.querySelectorAll('.tab').forEach((t) => {
    const base = t.dataset.href.split('/')[1];
    t.setAttribute('aria-selected', String(route.startsWith('#/' + base)));
  });
}

/* ===========================================================
   التوجيه
   =========================================================== */
function render() {
  const hash = location.hash || '#/home';
  const parts = hash.replace(/^#\//, '').split('/');
  const [root, a, b] = parts;

  app.firstElementChild?.dispatchEvent(new CustomEvent('screen:leave'));

  let node;
  switch (root) {
    case 'home': node = views.viewHome(); break;
    case 'prayer': node = views.viewPrayer(); break;
    case 'qibla': node = views.viewQibla(); break;
    case 'counter': node = views.viewCounter(); break;
    case 'favorites': node = views.viewFavorites(); break;
    case 'names': node = views.viewNames(); break;
    case 'sections': node = views.viewSections(); break;
    case 'etiquette': node = views.viewEtiquette(); break;
    case 'quran': node = views.viewQuran(); break;
    case 'mushaf': node = views.viewMushaf(a); break;
    case 'live': node = views.viewLive(); break;
    case 'donate': node = views.viewDonate(); break;
    case 'search': node = views.viewSearch(); break;
    case 'settings': node = views.viewSettings(); break;
    case 'hadith': node = a ? views.viewHadithSection(a) : views.viewHadithIndex(); break;
    case 'list': node = views.viewList(a, b); break;
    default: node = views.viewHome();
  }

  app.innerHTML = '';
  app.append(node);
  syncTabs(hash);
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ===========================================================
   الإقلاع
   =========================================================== */
function boot() {
  views.applyTheme();
  views.applyAppIcon();
  document.documentElement.style.setProperty('--font-scale', String(store.get('fontScale', 1)));

  renderChrome();
  renderFastingBar();
  render();

  window.addEventListener('hashchange', render);
  document.addEventListener('app:rerender', render);
  document.addEventListener('fastingbar:refresh', renderFastingBar);

  // تحديث شريط الصيام كل ٣٠ ثانية
  setInterval(renderFastingBar, 30000);

  // تغيّر تفضيل النظام للوضع الليلي
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => { if (store.get('theme') === 'auto') views.applyTheme(); });

  // التنبيهات
  if (store.get('notifications.enabled') && notify.permission() === 'granted') {
    notify.startScheduler();
  }

  // العامل الخدمي — للعمل دون إنترنت
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* غير حرج */ });
    });
  }

  // تحديد الموقع تلقائيًّا في أول تشغيل
  if (!localStorage.getItem('maa-allah:asked-location')) {
    localStorage.setItem('maa-allah:asked-location', '1');
  }
}

boot();
