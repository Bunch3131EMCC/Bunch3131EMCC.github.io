// assets/schedule.js  (v11)

// Parse "YYYY-MM-DD" + "HH:mm" into a Date (local tz)
function toDate(tz, ymd, hm) {
  const [Y, M, D] = ymd.split('-').map(Number);
  const [h, m] = hm.split(':').map(Number);
  return new Date(Y, M - 1, D, h, m, 0, 0);
}

// Allow testing via ?now=2025-09-11T07:05
function getNow() {
  const q = new URLSearchParams(location.search).get('now');
  if (q) { const d = new Date(q); if (!isNaN(+d)) return d; }
  return new Date();
}

// Display "HH:mm" as "h:mm AM/PM"
function formatTime12(hm) {
  const [H, M] = hm.split(':').map(Number);
  const am = H < 12;
  let h = H % 12;
  if (h === 0) h = 12; // 0 or 12 -> 12
  return `${h}:${String(M).padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

async function fetchSchedule(url) {
  const ver = url.includes('?') ? '&' : '?';
  const res = await fetch(url + ver + 'v=11', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  try { return await res.json(); }
  catch (e) { throw new Error(`Invalid JSON in ${url}: ${e.message}`); }
}

async function renderScheduleSummary(mountId, jsonUrl) {
  const el = document.getElementById(mountId);
  if (!el) throw new Error(`mount #${mountId} not found`);

  let data;
  try { data = await fetchSchedule(jsonUrl); }
  catch (e) { el.innerHTML = `<div class="muted">Schedule failed to load (${e.message}).</div>`; throw e; }

  const now = getNow();
  const days = Array.isArray(data.days) ? data.days : [];
  const tz   = data.timezone || 'America/Los_Angeles';
  const todayYMD = now.toISOString().slice(0, 10);
  const today = days.find(d => d.date === todayYMD);

  const flatten = (day) => (day.events || []).map(ev => ({
    ...ev, dt: toDate(tz, day.date, ev.time), day
  })).sort((a, b) => a.dt - b.dt);

  let html = `<h3 style="margin:0 0 8px 0;">Today</h3>`;

  if (today) {
    const evs = flatten(today);
    const upcoming = evs.filter(e => e.dt > now);
    const upNext = upcoming[0];
    const remaining = upcoming.slice(0, 4);

    html += `<div class="card" style="margin:8px 0;">
      <div><strong>${today.label || today.date}</strong></div>
      ${upNext
        ? `<div class="muted" style="margin-top:6px;">Up Next · ${formatTime12(upNext.time)} — ${upNext.title}</div>`
        : `<div class="muted" style="margin-top:6px;">All scheduled items for today are complete.</div>`}
      ${remaining.length ? `<ul style="margin:10px 0 0 18px;">${
        remaining.map(e => `<li><strong>${formatTime12(e.time)}</strong> ${e.title}</li>`).join('')
      }</ul>` : ''}
      <div style="margin-top:10px;">
        <a class="pill" href="schedule.html">View Full Schedule</a>
      </div>
    </div>`;
  } else {
    const futureDay = days.find(d => toDate(tz, d.date, '00:00') > now);
    const first = futureDay?.events?.[0];
    html += `<div class="card" style="margin:8px 0;">
      <div><strong>Next: ${futureDay ? (futureDay.label || futureDay.date) : '—'}</strong></div>
      ${first ? `<div class="muted" style="margin-top:6px;">First event · ${formatTime12(first.time)} — ${first.title}</div>` : ``}
      <div style="margin-top:10px;"><a class="pill" href="schedule.html">View Full Schedule</a></div>
    </div>`;
  }

  el.innerHTML = html;
  return data;
}

async function renderFullSchedule(mountId, jsonUrl) {
  const el = document.getElementById(mountId);
  if (!el) throw new Error(`mount #${mountId} not found`);

  let data;
  try { data = await fetchSchedule(jsonUrl); }
  catch (e) { el.innerHTML = `<div class="muted">Schedule failed to load (${e.message}).</div>`; throw e; }

  const now = getNow();
  const tz  = data.timezone || 'America/Los_Angeles';
  let out = '';

  (data.days || []).forEach(day => {
    out += `<section class="card" style="margin-top:12px;">
      <h2 style="margin:0 0 8px 0;">${day.label || day.date}</h2>
      <ul style="list-style:none;padding:0;margin:0;">`;

    (day.events || []).forEach(ev => {
      const dt = toDate(tz, day.date, ev.time);
      const isPast = dt < now;
      const isNowish = Math.abs(dt - now) < 30 * 60 * 1000; // ±30 min
      out += `<li style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid #e5e7eb;">
        <div style="width:88px;font-weight:600;">${formatTime12(ev.time)}</div>
        <div style="flex:1;">
          <div>${ev.title}</div>
          ${isNowish ? `<div class="muted" style="font-size:12px;">Happening soon</div>` : ``}
        </div>
        ${isPast ? `<span class="muted" style="font-size:12px;">done</span>` : ``}
      </li>`;
    });

    out += `</ul></section>`;
  });

  el.innerHTML = out || `<div class="muted">No schedule data.</div>`;
}
