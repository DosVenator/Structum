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

  // Сделаем заметнее (длиннее вибрация)
  vibrate: [120, 60, 120, 60, 200],

  // Чтобы висело, пока не уберут (можно выключить, если бесит)
  requireInteraction: true,

  data: payload.data || { url: '/' },

  icon: '/icons/icon-192.png',
  badge: '/icons/icon-192.png',

  actions: [
    { action: 'open', title: 'Открыть' }
  ]
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
  const url = event.notification?.data?.url || '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of allClients) {
      // Лучше фокуснуть и (если надо) перейти
      if ('focus' in client) {
        await client.focus();
        client.postMessage({ type: 'OPEN_URL', url });
        return;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});