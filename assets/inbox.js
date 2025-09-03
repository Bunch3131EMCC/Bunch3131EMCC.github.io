// /assets/inbox.js (v16 – latest on home, full history in inbox, no overzealous dedupe)
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

function addAlert(evtOrPayload) {
  const a = normalizeEvent(evtOrPayload);
  if (!a.title && !a.body) a.title = 'Notification opened';

  // Gentle dedupe: only drop if *identical title+body* landed within the last 10s
  const key = `${a.title || ''}||${a.body || ''}`;
  const now = Date.now();
  window.__pheasantSeen = window.__pheasantSeen || [];
  const duplicate = window.__pheasantSeen.find(x => x.key === key && (now - x.t) < 10000);
  if (duplicate) return;
  window.__pheasantSeen.push({ key, t: now });

  // Keep full history — prepend newest, do NOT replace previous with same title
  const list = loadAlerts();
  list.unshift(a);
  saveAlerts(list);

  renderRecentAlerts('recent-alerts'); // now shows only the latest
  renderInboxPage('inbox');            // shows full history
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
export function renderRecentAlerts(mountId = 'recent-alerts') {
  const el = document.getElementById(mountId);
  if (!el) return;

  const list = loadAlerts();
  const latest = list[0];

  const body = !latest
    ? `<div class="muted">No recent alerts yet.</div>`
    : `<ul style="list-style:none; padding:0; margin:0;">
         <li style="padding:8px 0; border-top:1px solid #e5e7eb;">
           <div style="font-weight:600;">${latest.title || 'Pheasant Alert'}</div>
           ${latest.body ? `<div class="muted">${latest.body}</div>` : ''}
           <div class="muted" style="font-size:12px; margin-top:4px;">${new Date(latest.at).toLocaleString([], { hour: 'numeric', minute: '2-digit' })}</div>
         </li>
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
    renderRecentAlerts(mountId);
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
  tryConsumeInboxParam();   // capture cold-launch click payloads
  renderRecentAlerts('recent-alerts');
  renderInboxPage('inbox');
});
