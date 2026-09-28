/*
 * TAGR CRM service worker — Web Push only (no offline caching).
 *
 * Payload sent by lib/web-push.ts / notifications.service.ts (PushPayload in notifications.types.ts):
 *   { title, body, url, tag }
 * Served from /sw.js with no-cache headers (next.config.ts) so a new version is picked up on the next visit.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "TAGR CRM";
  const options = {
    body: payload.body || "",
    icon: "/pwa-icons/android/launchericon-192x192.png",
    badge: "/pwa-icons/android/launchericon-96x96.png",
    // Same tag = replaces the earlier one instead of stacking; renotify makes the replacement ring again.
    tag: payload.tag,
    renotify: Boolean(payload.tag),
    // Not silent: the device plays its own notification sound / vibration.
    silent: false,
    vibrate: [200, 100, 200],
    data: { url: payload.url || "/activities" },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // An open, visible CRM tab plays its own chime (the OS is quiet while you're looking at the app).
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: "push-received", title, body: options.body });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/activities", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
