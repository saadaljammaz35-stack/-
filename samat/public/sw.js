// SAMAT | سماط — service worker: makes the site installable and shows order notifications.
// No offline caching on purpose: prices, stock and orders always come from the server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'SAMAT', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'سماط SAMAT', {
    body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: d.tag, renotify: Boolean(d.tag),
    data: { url: d.url || '/' }, dir: 'auto', lang: 'ar',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    for (const w of wins) if (w.url.includes(url) && 'focus' in w) return w.focus();
    return self.clients.openWindow(url);
  }));
});
