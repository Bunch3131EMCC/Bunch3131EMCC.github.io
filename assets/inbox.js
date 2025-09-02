// assets/inbox.js  (v1)
const INBOX_KEY = 'pheasant_inbox_v1';

function loadInbox() {
  try { return JSON.parse(localStorage.getItem(INBOX_KEY)) || []; }
  catch { return []; }
}
function saveInbox(list) {
  localStorage.setItem(INBOX_KEY, JSON.stringify(list.slice(0, 100)));
}
function normalizeEvent(evt) {
  const n = (evt && evt.notification) ? evt.notification : evt || {};
  const title = n.title || n.heading || document.title || 'Notification';
  const body  = n.body  || n.content || '';
  const url   = n.url   || n.launchURL || location.origin;
  const data  = n.additionalData || n.data || {};
  const id    = n.id || n.notificationId || data.id || String(Date.now());
  return { id, ts: Date.now(), title, body, url, data };
}
function addToInbox(evt) {
  const list = loadInbox();
  const msg = normalizeEvent(evt);
  // avoid exact-duplicate ids at the top
  if (list.find(x => x.id === msg.id)) msg.id = msg.id + '-' + Date.now();
  list.unshift(msg);
  saveInbox(list);
}

export function renderRecentAlerts(mountId, limit = 5) {
  const el = document.getElementById(mountId);
  if (!el) return;
  const list = loadInbox();

  if (!list.length) {
    el.innerHTML = `<h3 style="margin:0 0 8px 0;">Recent Alerts</h3>
      <div class="muted">No alerts yet.</div>`;
    return;
  }

  const items = list.slice(0, limit).map(m => `
    <div style="padding:8px 0;border-top:1px solid #e5e7eb;">
      <div style="font-weight:600">${m.title}</div>
      <div class="muted">${m.body}</div>
      <div class="muted" style="font-size:12px;margin-top:4px;">
        ${new Date(m.ts).toLocaleString()}
      </div>
    </div>`).join('');

  el.innerHTML = `
    <h3 style="margin:0 0 8px 0;">Recent Alerts</h3>
    ${items}
    <div style="margin-top:10px;">
      <a class="pill" href="inbox.html">View All Alerts</a>
      <button id="clear-inbox" class="btn alt" style="margin-left:8px;padding:6px 10px;font-size:14px;">Clear</button>
    </div>
  `;

  const clearBtn = document.getElementById('clear-inbox');
  clearBtn?.addEventListener('click', () => { saveInbox([]); renderRecentAlerts(mountId, limit); });
}

export function renderInboxPage(mountId = 'inbox') {
  const el = document.getElementById(mountId);
  if (!el) return;
  const list = loadInbox();
  if (!list.length) {
    el.innerHTML = `<div class="muted">No alerts yet.</div>`;
    return;
  }
  el.innerHTML = list.map(m => `
    <section class="card" style="margin-top:12px;">
      <div style="font-weight:700">${m.title}</div>
      <div style="margin-top:6px;">${m.body}</div>
      <div class="muted" style="font-size:12px;margin-top:6px;">${new Date(m.ts).toLocaleString()}</div>
    </section>`).join('');
}

// Hook OneSignal events if SDK is present
(function attachOneSignalListeners(){
  // Wait until OneSignal is available & initialized
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(function(OneSignal) {
    try {
      // Fires when user taps the notification
      OneSignal.Notifications.addEventListener('click', (evt) => { try { addToInbox(evt); } catch {} });
      // Fires when a notification would show while your page is open
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (evt) => { try { addToInbox(evt); } catch {} });
    } catch (e) {
      console.warn('[inbox] Could not attach OneSignal listeners', e);
    }
  });
})();
