// /OneSignalSDKWorker.js
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// broadcast helper
async function broadcast(msg) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

// proof-of-life
self.addEventListener('install', (event) => {
  event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload: { title: 'SW installed', at: Date.now() } }));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await broadcast({ channel: 'pheasant-inbox', payload: { title: 'SW activated', at: Date.now() } });
  })());
});

// echo any page ping → “SW pong”
self.addEventListener('message', (event) => {
  const ch = event?.data?.channel || '(no channel)';
  const body = (ch === 'pheasant-inbox-hello' || ch === 'pheasant-inbox-fetch') ? ch : JSON.stringify(event.data);
  event.waitUntil(broadcast({
    channel: 'pheasant-inbox',
    payload: { title: 'SW pong', body, at: Date.now() }
  }));
});

// notification clicks → back into the page (scope-safe)
self.addEventListener('notificationclick', (event) => {
  event.waitUntil(broadcast({
    channel: 'pheasant-inbox',
    payload: { title: 'SW click', body: '(tap detected)', at: Date.now() }
  }));

  const payload = {
    title: event.notification?.title || 'Notification',
    body:  event.notification?.body  || '',
    data:  event.notification?.data  || {},
    at: Date.now()
  };

  const scopeURL = new URL(self.registration.scope);
  const openURL  = scopeURL.href;

  event.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (pages.length) {
      try { await pages[0].focus(); } catch {}
      try { pages.forEach(c => c.postMessage({ channel: 'pheasant-inbox', payload })); } catch {}
      return;
    }
    const u = new URL(openURL);
    u.searchParams.set('inbox', encodeURIComponent(JSON.stringify(payload)));
    await self.clients.openWindow(u.toString());

    setTimeout(async () => {
      try {
        const again = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        again.forEach(c => c.postMessage({ channel: 'pheasant-inbox', payload }));
      } catch {}
    }, 500);
  })());
});

// best-effort: raw push → page
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
