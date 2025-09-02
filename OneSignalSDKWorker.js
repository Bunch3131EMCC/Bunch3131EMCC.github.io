// /OneSignalSDKWorker.js  (v5)
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Make sure the new SW takes control ASAP
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

// --- Persist clicked notifications so the page can read them later ---
const DB_NAME = 'pheasant-inbox';
const STORE   = 'clicks';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function putClick(rec) {
  const db = await openDb();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function getAllAndClear() {
  const db = await openDb();
  return await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    const req = st.getAll();
    req.onsuccess = () => {
      const out = req.result || [];
      st.clear();
      tx.oncomplete = () => res(out);
    };
    req.onerror = () => rej(req.error);
  });
}

// Best-effort: also post to any open client
async function postToAnyClient(payload, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const arr = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    if (arr.length) {
      for (const c of arr) {
        try { c.postMessage({ channel: 'pheasant-inbox', payload }); } catch {}
      }
      return true;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

let lastPayload = null, lastAt = 0;

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
  lastPayload = payload; lastAt = Date.now();

  event.waitUntil((async () => {
    await putClick({ key: Date.now() + Math.random(), payload });
    await postToAnyClient(payload, 15000);
  })());
});

// Page can fetch the last-click (recent) and drain the queue
self.addEventListener('message', (event) => {
  const msg = event?.data;
  if (!msg) return;
  if (msg.channel === 'pheasant-inbox-hello') {
    if (lastPayload && (Date.now() - lastAt) < 2 * 60 * 1000) {
      event.source?.postMessage({ channel: 'pheasant-inbox', payload: lastPayload });
    }
  } else if (msg.channel === 'pheasant-inbox-fetch') {
    (async () => {
      const items = await getAllAndClear();
      if (items.length) {
        for (const rec of items) event.source?.postMessage({ channel: 'pheasant-inbox', payload: rec.payload });
      }
    })();
  }
});
