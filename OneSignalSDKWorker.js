// /OneSignalSDKWorker.js
// Load OneSignal’s v16 service worker
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// --- Small bridge so clicks get logged in your app inbox ---
async function postToAnyClient(payload) {
  for (let i = 0; i < 12; i++) {
    const clientsArr = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    if (clientsArr.length) {
      for (const c of clientsArr) c.postMessage({ channel: 'pheasant-inbox', payload });
      return;
    }
    await new Promise(r => setTimeout(r, 250));
  }
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
  event.waitUntil(postToAnyClient(payload));
});
