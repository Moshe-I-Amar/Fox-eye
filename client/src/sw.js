import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

// Required for registerType: 'autoUpdate' (vite-plugin-pwa):
// 1. skipWaiting — new SW activates immediately on install instead of waiting for
//    all old tabs to close. Without this every new Vercel deployment keeps serving
//    stale cached JS chunks, causing React init failures and broken event handlers.
// 2. clientsClaim — new SW takes control of already-open tabs right after activation
//    so they start receiving fresh assets without a page reload.
// 3. SKIP_WAITING message handler — handles the postMessage sent by the autoUpdate
//    shim; prevents the Workbox core.js "Cannot read properties of undefined
//    (reading 'payload')" TypeError that occurs when this message is unhandled.
self.skipWaiting();
clientsClaim();

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Injected by vite-plugin-pwa — must be present for injectManifest mode
precacheAndRoute(self.__WB_MANIFEST);

// API calls — Network-first (10 s timeout, then cache fallback).
// Exclude /api/auth/* — session checks must never be served from cache;
// a stale 200 for /api/auth/me would make the app think the user is
// still logged in after their cookie expired or was cleared on logout.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/'),
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
