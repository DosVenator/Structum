/* public/sw.js */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'Уведомление';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
    tag: payload.tag || 'inv',
    renotify: true,
    requireInteraction: false
  };

  event.waitUntil((async () => {
    // ✅ если приложение открыто и видно — НЕ показываем системную нотификацию,
    // а отправляем сообщение в UI (toast + звук).
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    const hasVisible = clientsArr.some(c => {
      try { return c.visibilityState === 'visible'; } catch { return false; }
    });

    if (hasVisible) {
      for (const c of clientsArr) {
        c.postMessage({ type: 'PUSH_EVENT', payload });
      }
      return;
    }

    // ✅ иначе показываем системное уведомление (будет системный звук)
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification?.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil((async () => {
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const c of clientsArr) {
      // если уже открыто — фокусируем
      if ('focus' in c) {
        await c.focus();
        try { c.postMessage({ type: 'OPEN_URL', url }); } catch {}
        return;
      }
    }

    // иначе открываем новое окно
    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});