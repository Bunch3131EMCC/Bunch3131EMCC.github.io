// /OneSignalSDKWorker.js
// /OneSignalSDKWorker.js
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Broadcast helper: post a message into any open app windows
async function broadcast(msg) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

// (Optional) proof-of-life messages
self.addEventListener('install', (event) => {
  event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload: { title: 'SW installed', at: Date.now() } }));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload: { title: 'SW activated', at: Date.now() } }));
});

// Reply to your page pings (your inbox.js already sends them)
self.addEventListener('message', (event) => {
  const ch = event?.data?.channel;
  if (ch === 'pheasant-inbox-hello' || ch === 'pheasant-inbox-fetch') {
    event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload: { title: 'SW pong', body: ch, at: Date.now() } }));
  }
});

// iOS critical: forward notification **clicks** into the page
self.addEventListener('notificationclick', (event) => {
  const payload = {
    title: event.notification?.title || 'Notification',
    body:  event.notification?.body  || '',
    data:  event.notification?.data  || {},
    at: Date.now()
  };
  event.waitUntil(broadcast({ channel: 'pheasant-inbox', payload }));
});

// (Optional) try to forward raw **push** payloads too
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

