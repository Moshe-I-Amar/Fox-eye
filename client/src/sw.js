import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// Injected by vite-plugin-pwa — must be present for injectManifest mode
precacheAndRoute(self.__WB_MANIFEST);

// API calls — Network-first (10 s timeout, then cache fallback)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

// Map tiles — Cache-first (500 entries, 7 days)
registerRoute(
  ({ url }) => /^https:\/\/[abc]\.tile\.openstreetmap\.org\//.test(url.href),
  new CacheFirst({
    cacheName: 'map-tiles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

// ── Web Push ─────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const {
    title = 'Fox-Eye Alert',
    body  = 'New field event reported',
    eventId,
    eventType,
  } = data;

  // INJURED / AMBUSH stay visible until dismissed; LINK_UP auto-dismisses
  const requireInteraction = eventType !== 'LINK_UP';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/fox-eye-192.png',
      badge: '/fox-eye-192.png',
      tag:   `field-event-${eventId ?? Date.now()}`,
      data:  { eventId, eventType },
      requireInteraction,
      vibrate: [200, 100, 200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing Fox-Eye tab if one is open
        const existing = windowClients.find(
          (c) => c.url.includes('/mobile') || c.url.includes('/dashboard')
        );
        if (existing) return existing.focus();
        return clients.openWindow('/mobile');
      })
  );
});
