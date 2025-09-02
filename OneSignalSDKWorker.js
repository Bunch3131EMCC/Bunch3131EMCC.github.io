// /OneSignalSDKWorker.js
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// --- helper: broadcast a message into any open app windows
async function broadcast(msg) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

// Proof-of-life (you can remove later)
self.addEventListener('install', (event) => {
  event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload: { title: 'SW installed', at: Date.now() } }));
});
self.addEventListener('activate', (event) => {
  // Take control immediately so postMessage uses the controller without a 2nd reload
  event.waitUntil((async () => {
    await self.clients.claim();
    await broadcast({ channel: 'pheasant-inbox', payload: { title: 'SW activated', at: Date.now() } });
  })());
});

// Reply to ANY page message so we can verify the bridge
self.addEventListener('message', (event) => {
  const ch = event?.data?.channel || '(no channel)';
  const body =
    ch === 'pheasant-inbox-hello' || ch === 'pheasant-inbox-fetch'
      ? ch
      : JSON.stringify(event.data);
  event.waitUntil(broadcast({
    channel: 'pheasant-inbox',
    payload: { title: 'SW pong', body, at: Date.now() }
  }));
});

// Forward notification **clicks** into the page (critical on iOS)
self.addEventListener('notificationclick', (event) => {
  const payload = {
    title: event.notification?.title || 'Notification',
    body:  event.notification?.body  || '',
    data:  event.notification?.data  || {},
    at: Date.now()
  };
  const targetUrl = '/'; // change to a specific page if desired

  event.waitUntil((async () => {
    // If the app is already open, focus and postMessage
    let pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (pages.length) {
      try { await pages[0].focus(); } catch {}
      try { pages.forEach(c => c.postMessage({ channel: 'pheasant-inbox', payload })); } catch {}
      return;
    }

    // Cold launch: open with payload in the URL so the page can consume it on load
    const urlWithPayload =
      targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'inbox=' + encodeURIComponent(JSON.stringify(payload));
    await self.clients.openWindow(urlWithPayload);

    // Best-effort: after a short delay, broadcast again (in case the page registered the listener)
    setTimeout(async () => {
      try {
        const again = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        again.forEach(c => c.postMessage({ channel: 'pheasant-inbox', payload }));
      } catch {}
    }, 500);
  })());
});

// Best-effort: forward raw **push** payloads too (may be empty on iOS)
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
