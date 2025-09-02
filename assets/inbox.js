// /assets/inbox.js  (v5)
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
  const n = e.notification || e;              // OneSignal event or SW payload
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
    // update both views if they exist
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

// Page events (fires when app is open)
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(function (OneSignal) {
  try {
    OneSignal.Notifications.addEventListener('click', (evt) => addAlert(evt));
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (evt) => addAlert(evt));
  } catch {}
});

// SW messages + drain on load (captures taps from closed state)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event?.data?.channel === 'pheasant-inbox' && event.data.payload) {
      addAlert(event.data.payload);
    }
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      reg?.active?.postMessage({ channel: 'pheasant-inbox-hello' });
      reg?.active?.postMessage({ channel: 'pheasant-inbox-fetch' });
    } catch {}
  });
}

// Initial render on pages that include a container
document.addEventListener('DOMContentLoaded', () => {
  renderRecentAlerts('recent-alerts', 5);
  renderInboxPage('inbox');
});
