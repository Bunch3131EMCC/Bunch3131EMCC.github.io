// /OneSignalSDKWorker.js  (v3)
// Load OneSignal’s v16 worker first
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// --- Bridge so clicked notifications get logged in your app ---
// Keep the last payload in memory for a short time (for late listeners)
let lastPayload = null;
let lastAt = 0;

async function postToAnyClient(payload, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const arr = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    if (arr.length) {
      for (const c of arr) c.postMessage({ channel: 'pheasant-inbox', payload });
      return true;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

self.addEventListener('notificationclick', (event) => {
  const n = event.notification || {};
  const d = n.data || {};
  const payload = {
    type: 'onesignal-click',
    at: Date.now(),
    title: n.title || d.title || '',
    body:  n.body  || d.alert || d.body || '',
    url:   d.url   || d.launchURL || d.openURL || '/',
    additionalData: d
  };
  lastPayload = payload;
  lastAt = Date.now();
  event.waitUntil(postToAnyClient(payload, 15000));
});

// Page can ping us after it loads to retrieve the last click (if recent)
self.addEventListener('message', (event) => {
  const msg = event?.data;
  if (msg && msg.channel === 'pheasant-inbox-hello') {
    if (lastPayload && (Date.now() - lastAt) < 2 * 60 * 1000) {
      event.source?.postMessage({ channel: 'pheasant-inbox', payload: lastPayload });
    }
  }
});
