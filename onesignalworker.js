// /OneSignalSDKWorker.js
// Load OneSignal's SW, then add our tiny bridge for logging
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Helper: wait for a client window to exist (OneSignal will open/focus it)
async function postToAnyClient(payload) {
  // Try repeatedly for a short time so we can catch the newly-opened tab
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
    body: n.body || d.alert || d.body || '',
    url: d.url || d.launchURL || d.openURL || '/',
    additionalData: d
  };
  event.waitUntil(postToAnyClient(payload));
});

// Optional: If you ever want to catch “will display while page is open” in SW,
// you’d use 'push' here. For now we leave it to the page's foreground handler.
