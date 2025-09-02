// /assets/inbox.js  (v3)
const STORAGE_KEY = 'pheasant_alerts_v1';

function loadAlerts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveAlerts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
}
function normalizeEvent(evtOrPayload) {
  const e = evtOrPayload || {};
  const n = e.notification || e;
  const data = n.data || e.additionalData || {};
  const title = n.title || e.title || data.title || 'Pheasant Alert';
  const body  = n.body  || e.body  || data.alert || data.body || '';
  const url   = data.url || data.launchURL || data.openURL || (location.origin + location.pathname);
  const at    = e.at || Date.now();
  return { title, body, url, at };
}
function addAlert(evtOrPayload) {
  const a = normalizeEvent(evtOrPayload);
  if (!a.title && !a.body) return;
  const list = loadAlerts();
  const twoMin = 2 * 60 * 1000;
  if (!list.some(x => Math.abs((x.at || 0) - a.at) < twoMin && x.title === a.title && x.body === a.body)) {
    list.unshift(a);
    saveAlerts(list);
    renderRecentAlerts('recent-alerts');
  }
}

export function renderRecentAlerts(mountId = 'recent-alerts', max = 10) {
  const el = document.getElementById(mountId);
  if (!el) return;
  const list = loadAlerts().slice(0, max);
  if (!list.length) {
    el.innerHTML = `<h3 style="margin:0 0 8px 0;">Recent Alerts</h3><div class="muted">No recent alerts yet.</div>`;
    return;
  }
  el.innerHTML = `
    <h3 style="margin:0 0 8px 0;">Recent Alerts</h3>
    <ul style="list-style:none; padding:0; margin:0;">
      ${list.map(item => {
        const when = new Date(item.at);
        const time = when.toLocaleString([], { hour: 'numeric', minute: '2-digit' });
        return `
          <li style="padding:8px 0; border-top:1px solid #e5e7eb;">
            <div style="font-weight:600;">${item.title || 'Pheasant Alert'}</div>
            ${item.body ? `<div class="muted">${item.body}</div>` : ''}
            <div class="muted" style="font-size:12px; margin-top:4px;">${time}</div>
          </li>`;
      }).join('')}
    </ul>`;
}

// --- Listen for messages from the SW bridge ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event?.data?.channel === 'pheasant-inbox' && event.data.payload) {
      addAlert(event.data.payload);
    }
  });

  // Handshake: after load, ask the SW if it has a recent click we missed
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      reg?.active?.postMessage({ channel: 'pheasant-inbox-hello' });
    } catch {}
  });
}

// Initial render
document.addEventListener('DOMContentLoaded', () => {
  renderRecentAlerts('recent-alerts', 5);
});

// --- Hook OneSignal page events too (for when app is open) ---
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(function (OneSignal) {
  try {
    OneSignal.Notifications.addEventListener('click', (evt) => addAlert(evt));
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (evt) => addAlert(evt));
  } catch {}
});
