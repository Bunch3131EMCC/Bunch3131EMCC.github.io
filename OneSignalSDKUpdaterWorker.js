// /OneSignalSDKUpdaterWorker.js
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

// prove it’s alive (you’ll see “SW installed/activated” in Recent Alerts with ?debug=1)
self.addEventListener('install', (event) => {
  event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload: { title: 'SW installed', at: Date.now() } }));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload: { title: 'SW activated', at: Date.now() } }));
});

// reply to pings your page sends
self.addEventListener('message', (event) => {
  const ch = event?.data?.channel;
  if (ch === 'pheasant-inbox-hello' || ch === 'pheasant-inbox-fetch') {
    event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload: { title: 'SW pong', body: ch, at: Date.now() } }));
  }
});

// forward clicks into the page (iOS critical)
self.addEventListener('notificationclick', (event) => {
  const payload = {
    title: event.notification?.title || 'Notification',
    body:  event.notification?.body  || '',
    data:  event.notification?.data  || {},
    at: Date.now()
  };
  event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload }));
});

// optional: try to forward raw push payloads too
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
  } catch(_) {}
});
