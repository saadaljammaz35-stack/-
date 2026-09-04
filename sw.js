/** العامل الخدمي — تشغيل التطبيق دون إنترنت */
const CACHE = 'maa-allah-v1';

const ASSETS = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/views.js',
  'js/ui.js',
  'js/icons.js',
  'js/store.js',
  'js/prayer.js',
  'js/hijri.js',
  'js/qibla.js',
  'js/khatmah.js',
  'js/quran.js',
  'js/notify.js',
  'data/adhkar.js',
  'data/duas.js',
  'data/hadith.js',
  'data/asma-husna.js',
  'data/surahs.js',
  'manifest.webmanifest',
  'assets/icon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS).catch(() => Promise.all(ASSETS.map((a) => c.add(a).catch(() => null)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // نصوص القرآن: الشبكة أولًا ثم المخزّن
  if (url.hostname.includes('alquran.cloud')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // البث والصوت: من الشبكة مباشرة
  if (url.hostname.includes('youtube') || url.hostname.includes('radiojar') || url.hostname.includes('islamic.network')) {
    return;
  }

  // ملفات التطبيق: المخزّن أولًا
  e.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.tag?.startsWith('adhkar-morning') ? '#/list/adhkar/morning'
    : e.notification.tag?.startsWith('adhkar-evening') ? '#/list/adhkar/evening'
    : e.notification.tag?.startsWith('quran') ? '#/quran'
    : '#/prayer';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate?.(c.url.split('#')[0] + target); return c.focus(); }
      }
      return self.clients.openWindow('./' + target);
    })
  );
});
