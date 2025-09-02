// /assets/inbox.js  (v6)
const STORAGE_KEY = 'pheasant_alerts_v1';

function loadAlerts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveAlerts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
}
function normalizeEvent(evtOrPayload) {
  const e = evtOrPayload || {};
  const n = e.notification || e;              // OneSignal event OR SW payload
  const data = n.data || e.additionalData || {};
  const title = n.title || e.title || data.title || 'Pheasant Alert';
  const body  = n.body  || e.body  || data.alert || data.body || '';
  const url   = data.url || data.launchURL || data.openURL || (location.origin + location.pathname);
  const at    = e.at || Date.now();
  return { title, body, url, at };
}
function addAlert(evtOrPayload) {
+   const a = normalizeEvent(evtOrPayload);
+   // If iOS gives us no text, still log the open
+   if (!a.title && !a.body) a.title = 'Notification opened';
+   const list = loadAlerts();
  const twoMin = 2 * 60 * 1000;
  if (!list.some(x => Math.abs((x.at || 0) - a.at) < twoMin && x.title === a.title && x.body === a.body)) {
    list.unshift(a);
    saveAlerts(list);
    renderRecentAlerts('recent-alerts', 5);
    renderInboxPage('inbox');
  }
}

export function renderRecentAlerts(mountId = 'recent-alerts', max = 5) {
  const el = document.getElementById(mountId);
  if (!el) return;
  const list = loadAlerts().slice(0, max);
  const body = !list.length
    ? `<div class="muted">No recent alerts yet.</div>`
    : `<ul style="list-style:none; padding:0; margin:0;">
        ${list.map(item => {
          const when = new Date(item.at);
          const time = when.toLocaleString([], { hour: 'numeric', minute: '2-digit' });
          return `<li style="padding:8px 0; border-top:1px solid #e5e7eb;">
            <div style="font-weight:600;">${item.title || 'Pheasant Alert'}</div>
            ${item.body ? `<div class="muted">${item.body}</div>` : ''}
            <div class="muted" style="font-size:12px; margin-top:4px;">${time}</div>
          </li>`;
        }).join('')}
      </ul>`;
  el.innerHTML = `
    <h3 style="margin:0 0 8px 0;">Recent Alerts</h3>
    ${body}
    <div style="margin-top:10px;">
      <a class="pill" href="inbox.html">View All Alerts</a>
      <button id="clear-inbox" class="btn alt" style="margin-left:8px;padding:6px 10px;font-size:14px;">Clear</button>
    </div>
  `;
  document.getElementById('clear-inbox')?.addEventListener('click', () => {
    saveAlerts([]);
    renderRecentAlerts(mountId, max);
  });
}

export function renderInboxPage(mountId = 'inbox') {
  const el = document.getElementById(mountId);
  if (!el) return;
  const list = loadAlerts();
  el.innerHTML = !list.length
    ? `<div class="muted">No alerts yet.</div>`
    : list.map(m => `
        <section class="card" style="margin-top:12px;">
          <div style="font-weight:700">${m.title}</div>
          ${m.body ? `<div style="margin-top:6px;">${m.body}</div>` : ``}
          <div class="muted" style="font-size:12px;margin-top:6px;">
            ${new Date(m.at).toLocaleString()}
          </div>
        </section>
      `).join('');
}

// ---- OneSignal page events (fires when app is open) ----
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(function (OneSignal) {
  try {
    OneSignal.Notifications.addEventListener('click', (evt) => addAlert(evt));
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (evt) => addAlert(evt));
  } catch {}
});

// ---- SW messages from our bridge ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event?.data?.channel === 'pheasant-inbox' && event.data.payload) {
      addAlert(event.data.payload);
    }
  });
}

// ---- Aggressive handshake with the SW to fetch any missed clicks ----
function pingSW(times = 8, delay = 400) {
  if (!('serviceWorker' in navigator)) return;
  let count = 0;
  const send = () => {
    navigator.serviceWorker.ready
      .then(reg => {
        reg?.active?.postMessage({ channel: 'pheasant-inbox-hello' });
        reg?.active?.postMessage({ channel: 'pheasant-inbox-fetch' });
      })
      .catch(() => {});
    if (++count < times) setTimeout(send, delay);
  };
  send();
}

// Initial render + early ping
document.addEventListener('DOMContentLoaded', () => {
  renderRecentAlerts('recent-alerts', 5);
  renderInboxPage('inbox');
  pingSW(8, 400); // start ASAP after DOM is ready
});

// Ping again on load (in case SW becomes active slightly later)
window.addEventListener('load', () => { pingSW(5, 600); });

// And whenever the page becomes visible after a push open
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') pingSW(4, 500);
});
