// /assets/inbox.js  (v10 fixed)
// NOTE: previous copy had an extra stray "}" after addAlert() that broke the module.

const STORAGE_KEY = 'pheasant_alerts_v1';

// Optional on-page debug (use ?debug=1)
const DEBUG_ON = new URLSearchParams(location.search).get('debug') === '1';
function dbg(...args) {
  if (!DEBUG_ON) return;
  console.log('[inbox]', ...args);
  try {
    const el = document.getElementById('inbox-debug');
    if (el) el.innerHTML += `<div style="padding:2px 0;border-top:1px solid #eee"><code>${
      args.map(a => typeof a==='string' ? a : JSON.stringify(a)).join(' ')
    }</code></div>`;
  } catch {}
}

// Storage helpers
function loadAlerts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveAlerts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
}

// Normalize + add
function normalizeEvent(evtOrPayload) {
  const e = evtOrPayload || {};
  const n = e.notification || e;
  const data = n.data || e.additionalData || {};
  const title = n.title || e.title || data.title || '';
  const body  = n.body  || e.body  || data.alert || data.body || '';
  const url   = data.url || data.launchURL || data.openURL || (location.origin + location.pathname);
  const at    = e.at || Date.now();
  return { title, body, url, at };
}

function addAlert(evtOrPayload) {
  const a = normalizeEvent(evtOrPayload);
  if (!a.title && !a.body) a.title = 'Notification opened';

  const now = Date.now();

  // session-level quick dedupe
  window.__pheasantSeen = window.__pheasantSeen || [];
  // consider alerts same if titles match and within 30s, ignoring empty vs non-empty body
  const sameTitleRecent = window.__pheasantSeen.find(
    x => x.title === (a.title || '') && (now - x.t) < 30000
  );

  const list = loadAlerts();
  const twoMin = 2 * 60 * 1000;

  // find a recent stored item with same title within 2 min
  const idx = list.findIndex(
    x => Math.abs((x.at || 0) - (a.at || now)) < twoMin && (x.title || '') === (a.title || '')
  );

  if (idx >= 0) {
    // prefer richer body: if new has body and old doesn't (or shorter), replace old
    const old = list[idx];
    const oldBody = (old.body || '');
    const newBody = (a.body || '');
    if (newBody && newBody.length > oldBody.length) {
      list[idx] = a;
      saveAlerts(list);
      renderRecentAlerts('recent-alerts', 5);
      renderInboxPage('inbox');
    }
    // record sighting and exit (we already had an entry)
    if (!sameTitleRecent) window.__pheasantSeen.push({ title: a.title || '', t: now });
    return;
  }

  // if we saw this title seconds ago (likely SW then page), skip second copy
  if (sameTitleRecent) return;

  // otherwise add new
  list.unshift(a);
  saveAlerts(list);
  renderRecentAlerts('recent-alerts', 5);
  renderInboxPage('inbox');

  window.__pheasantSeen.push({ title: a.title || '', t: now });
}

// Renderers
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
    ${DEBUG_ON ? `<div id="inbox-debug" class="muted" style="margin-top:8px;font-size:12px;max-height:130px;overflow:auto;border-top:1px dashed #ddd;padding-top:6px;"></div>` : '' }
  `;

  document.getElementById('clear-inbox')?.addEventListener('click', () => {
    saveAlerts([]);
    renderRecentAlerts(mountId, max);
    renderInboxPage('inbox');
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
          <div style="font-weight:700">${m.title || 'Pheasant Alert'}</div>
          ${m.body ? `<div style="margin-top:6px;">${m.body}</div>` : ``}
          <div class="muted" style="font-size:12px;margin-top:6px;">${new Date(m.at).toLocaleString()}</div>
        </section>
      `).join('');
}

// OneSignal page events (fires while app is open)
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(function (OneSignal) {
  try {
    OneSignal.Notifications.addEventListener('click', (evt) => { dbg('OS click', evt); addAlert(evt); });
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (evt) => { dbg('OS fg', evt); addAlert(evt); });
  } catch (e) { dbg('OS listeners error', e); }
});

// SW messages (tap from closed)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event?.data?.channel === 'pheasant-inbox' && event.data.payload) {
      dbg('SW message', event.data.payload);
      addAlert(event.data.payload);
    }
  });
}

// Aggressive SW handshake to fetch missed clicks
function pingSW(times = 8, delay = 400) {
  if (!('serviceWorker' in navigator)) return;
  let count = 0;
  const send = () => {
    navigator.serviceWorker.ready
      .then(reg => {
        dbg('ping SW');
        reg?.active?.postMessage({ channel: 'pheasant-inbox-hello' });
        reg?.active?.postMessage({ channel: 'pheasant-inbox-fetch' });
      })
      .catch(()=>{});
    if (++count < times) setTimeout(send, delay);
  };
  send();
}

// Auto-render + start handshakes
document.addEventListener('DOMContentLoaded', () => {
  renderRecentAlerts('recent-alerts', 5);
  renderInboxPage('inbox');
  pingSW(8, 400);
});
window.addEventListener('load', () => { pingSW(5, 600); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') pingSW(4, 500);
});
