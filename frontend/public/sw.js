function resolveAppUrl(value) {
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    return value;
  }
  const normalized = typeof value === 'string' && value.trim() ? value.trim().replace(/^\/+/, '') : 'dashboard/messages/';
  return new URL(normalized, self.registration.scope).toString();
}

function resolveAssetUrl(value) {
  return new URL(value.replace(/^\/+/, ''), self.registration.scope).toString();
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'ServeOne',
    body: 'Новое уведомление',
    url: resolveAppUrl('dashboard/messages/')
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (error) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: resolveAssetUrl('icons/icon-192.png'),
      badge: resolveAssetUrl('icons/icon-192.png'),
      data: {
        url: resolveAppUrl(payload.url)
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = resolveAppUrl(event.notification.data?.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
