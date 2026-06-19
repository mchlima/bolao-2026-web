/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

// Custom service worker (vite-pwa injectManifest). Keeps the previous behaviour
// — precache static assets + auto-update — and adds Web Push handling.
declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
clientsClaim();

interface PushData {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

// A push arrived → show the OS notification.
self.addEventListener('push', (event: PushEvent) => {
  let data: PushData = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = data.title || 'Cravei';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  );
});

// Tap → focus an open tab (navigating it) or open a new one at the deep link.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const wc = client as WindowClient;
        if ('focus' in wc) {
          void wc.navigate(url);
          return wc.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
