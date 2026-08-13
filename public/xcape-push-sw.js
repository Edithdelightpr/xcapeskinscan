/* global self, clients */
/**
 * XCAPE push + notification-click handling.
 *
 * This file is imported into the Workbox-generated service worker
 * (see `workbox.importScripts` in vite.config.ts). It only handles push
 * messages and notification interactions — no caching logic lives here,
 * and it never reads or stores application data.
 */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'XCAPE', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'XCAPE';
  const options = {
    body: payload.body || '',
    icon: '/icons-xcape-192.png',
    badge: '/icons-xcape-192.png',
    tag: payload.tag || undefined,
    data: { url: typeof payload.url === 'string' ? payload.url : '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const raw = (event.notification.data && event.notification.data.url) || '/';
  // Only ever deep-link inside this origin.
  let target = '/';
  try {
    const parsed = new URL(raw, self.location.origin);
    if (parsed.origin === self.location.origin) target = parsed.pathname + parsed.search + parsed.hash;
  } catch {
    target = '/';
  }

  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await clients.openWindow(target);
    })(),
  );
});
