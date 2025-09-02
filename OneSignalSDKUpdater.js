// /OneSignalSDKUpdaterWorker.js  (root scope)
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

/**
 * Forward notification clicks into any open client pages.
 * Your /assets/inbox.js listens for this and logs the alert.
 */
self.addEventListener('notificationclick', (event) => {
  // event.notification has title/body/data etc.
  const payload = {
    title: event.notification?.title,
    body: event.notification?.body,
    data: event.notification?.data || {},
    at: Date.now()
  };

  // Broadcast to all controlled windows (even if not focused)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ channel: 'pheasant-inbox', payload });
        });
      })
  );
});

/**
 * (Optional) If you want foreground-ish logs too, you can also try to
 * broadcast on 'push' so the page hears about the inbound payload even
 * before click. Not all platforms deliver full payload here, but harmless to keep.
 */
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json?.() ?? {} : {};
    const payload = {
      title: data.title || '',
      body: data.body || data.alert || '',
      data,
      at: Date.now()
    };
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ channel: 'pheasant-inbox', payload });
          });
        })
    );
  } catch (_) { /* ignore */ }
});
