// /OneSignalSDKWorker.js (clean)
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Broadcast helper to talk to any open app windows
async function broadcast(msg) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

// Keep claim (helps the updated SW take control), but no noisy logs
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ----- Notification click → forward real payload to the page -----
self.addEventListener('notificationclick', (event) => {
  const payload = {
    title: event.notification?.title || 'Notification',
    body:  event.notification?.body  || '',
    data:  event.notification?.data  || {},
    at: Date.now()
  };

  const scopeURL = new URL(self.registration.scope);
  const openURL  = scopeURL.href;

  event.waitUntil((async () => {
    // If an app window exists, focus it and deliver the payload
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (pages.length) {
      try { await pages[0].focus(); } catch {}
      try { pages.forEach(c => c.postMessage({ channel: 'pheasant-inbox', payload })); } catch {}
      return;
    }

    // Cold launch: open with ?inbox= so the page can consume on load
    const u = new URL(openURL);
    u.searchParams.set('inbox', encodeURIComponent(JSON.stringify(payload)));
    await self.clients.openWindow(u.toString());

    // After a short delay, try broadcasting again (page may be ready now)
    setTimeout(async () => {
      try {
        const again = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        again.forEach(c => c.postMessage({ channel: 'pheasant-inbox', payload }));
      } catch {}
    }, 500);
  })());
});

// ----- Best-effort: forward raw push payloads (may be empty on iOS) -----
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? (event.data.json?.() ?? {}) : {};
    const payload = {
      title: data.title || '',
      body:  data.body  || data.alert || '',
      data,
      at: Date.now()
    };
    event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload }));
  } catch (_) {}
});

// NOTE: Intentionally removed noisy debug/logging:
// - install/activate proof-of-life broadcasts
// - message echo -> "SW pong"
// - extra "SW click" broadcast
