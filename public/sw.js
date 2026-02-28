/* public/sw.js */

// Чтобы SW сразу активировался
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// PUSH: показываем системное уведомление (шторка + звук ОС по умолчанию)
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Уведомление', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Structum';
  const body = payload.body || 'Новое событие';

  const options = {
    body,
    tag: payload.tag || undefined,
    renotify: true,

    // На Android даст стандартный звук/вибро по настройкам системы
    vibrate: [80, 40, 80],

    // Чтобы клик открывал приложение
    data: payload.data || { url: '/' },

    // Иконки (если есть)
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',

    // Можно сделать "липким" (не всем нравится):
    // requireInteraction: true
  };

  event.waitUntil((async () => {
    // 1) Показать системную нотификацию
    await self.registration.showNotification(title, options);

    // 2) Плюс отправим сообщение в открытую вкладку (чтобы тост/звук онлайн)
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: 'PUSH_EVENT', payload });
    }
  })());
});

// Клик по уведомлению → открыть/фокуснуть приложение
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification?.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // если уже открыто — фокус
    for (const client of allClients) {
      if ('focus' in client) {
        client.postMessage({ type: 'OPEN_URL', url });
        return client.focus();
      }
    }

    // иначе открыть новое
    if (self.clients.openWindow) {
      return self.clients.openWindow(url);
    }
  })());
});