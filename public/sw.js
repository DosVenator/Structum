/* public/sw.js */

const CACHE = 'structum-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/store.js',
  '/js/app.js',
  '/js/scanner.js',
  '/js/idb.js',
  '/js/offlineQueue.js',
  '/icons/icon-192.png',
  '/manifest.json'
];

// install: кэшируем оболочку
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    self.clients.claim();
    // можно чистить старые кэши при смене версии
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)));
  })());
});

// Для статики: cache-first
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // API не кэшируем (иначе будет путаница)
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, fresh.clone()).catch(() => {});
      return fresh;
    } catch (e) {
      // если офлайн и нет в кэше — хотя бы главную
      if (url.pathname === '/' || url.pathname.endsWith('.html')) {
        const fallback = await caches.match('/index.html');
        if (fallback) return fallback;
      }
      throw e;
    }
  })());
});

// PUSH: системное уведомление + сообщение во вкладку
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Уведомление', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Structum';
  const body = payload.body || 'Новое событие';

  const options = {
    body,
    tag: payload.tag || undefined,
    renotify: true,
    vibrate: [120, 60, 120, 60, 180], // чуть заметнее

    data: payload.data || { url: '/' },

    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png'
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: 'PUSH_EVENT', payload });
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification?.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        client.postMessage({ type: 'OPEN_URL', url });
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});