// /assets/inbox.js (v15 stable – push/click only, no SW noise)
const STORAGE_KEY = 'pheasant_alerts_v1';

// (Optional) URL debug: ?debug=1
const DEBUG_ON = new URLSearchParams(location.search).get('debug') === '1';
function dbg(...args) {
  if (!DEBUG_ON) return;
  try {
    console.log('[inbox]', ...args);
    const el = document.getElementById('inbox-debug');
    if (el) el.innerHTML += `<div style="padding:2px 0;border-top:1px solid #eee"><code>${
      args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
    }</code></div>`;
  } catch {}
}

// ---------- Storage ----------
function loadAlerts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveAlerts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
}

// ---------- Normalize + add ----------
function normalizeEvent(evtOrPayload) {
  const e = evtOrPayload || {};
  const n = e.notification || e; // OneSignal click/fg events carry .notification
  const data = n?.data || e.additionalData || {};
  const title = n?.title || e.title || data.title || '';
  const body  = n?.body  || e.body  || data.alert || data.body || '';
  const url   = data.url || data.launchURL || data.openURL || (location.origin + location.pathname);
  const at    = e.at || Date.now();
  return { title, body, url, at };
}

// ---- Replace your existing addAlert(...) with this:
function addAlert(evtOrPayload) {
  const a = normalizeEvent(evtOrPayload);
  if (!a.title && !a.body) a.title = 'Notification opened';

  // tiny dedupe: same title+body within 10s (prevents true double-fires)
  const key = `${a.title || ''}||${a.body || ''}`;
  const now = Date.now();
  window.__pheasantSeen = window.__pheasantSeen || [];
  const dupe = window.__pheasantSeen.find(x => x.key === key && (now - x.t) < 10000);
  if (dupe) return;
  window.__pheasantSeen.push({ key, t: now });

  // always keep history — prepend newest
  const list = loadAlerts();
  list.unshift(a);
  saveAlerts(list);

  // re-render UI
  renderRecentAlerts('recent-alerts', 5);  // your existing function — shows up to 5
  renderInboxPage('inbox');                 // full history page
}

// ---------- Cold-launch payload (?inbox=<json>) ----------
function tryConsumeInboxParam() {
  try {
    const raw = new URLSearchParams(location.search).get('inbox');
    if (!raw) return;
    const payload = JSON.parse(decodeURIComponent(raw));
    dbg('consume ?inbox', payload);
    addAlert(payload);
    const u = new URL(location.href);
    u.searchParams.delete('inbox');
    history.replaceState(null, '', u.toString());
  } catch (e) {
    dbg('consume error', e);
  }
}

// ---------- Renderers ----------
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

// ---------- OneSignal (keep foreground + click) ----------
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(function (OneSignal) {
  try {
    OneSignal.Notifications.addEventListener('click', (evt) => {
      dbg('OS click', evt);
      addAlert(evt);
    });
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (evt) => {
      dbg('OS fg', evt);
      addAlert(evt);
      if (evt?.preventDefault) evt.preventDefault();
      const n = evt?.notification;
      if (n?.display) n.display();
    });
  } catch (e) { dbg('OS listeners error', e); }
});

// ---------- SW messages (click from closed + raw push forwarders) ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event?.data?.channel === 'pheasant-inbox' && event.data.payload) {
      dbg('SW message', event.data.payload);
      addAlert(event.data.payload);
    }
  });
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', () => {
  tryConsumeInboxParam();        // log cold-launch payloads
  renderRecentAlerts('recent-alerts', 5);
  renderInboxPage('inbox');
});

// Removed:
// - window.postMessage page bridge (prevents app-generated noise)
// - pingSW() & callers (removes SW "pong" chatter)
