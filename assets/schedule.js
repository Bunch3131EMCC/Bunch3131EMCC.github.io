function toDate(tz, ymd, hm) {
  const [Y,M,D] = ymd.split('-').map(Number);
  const [h,m]   = hm.split(':').map(Number);
  return new Date(Y, M-1, D, h, m, 0, 0);
}

async function fetchSchedule(url) {
  const ver = url.includes('?') ? '&' : '?';
  const res = await fetch(url + ver + 'v=7', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  try { return await res.json(); }
  catch (e) { throw new Error(`Invalid JSON in ${url}: ${e.message}`); }
}

async function renderScheduleSummary(mountId, jsonUrl) {
  const el = document.getElementById(mountId);
  if (!el) throw new Error(`mount #${mountId} not found`);
  let data;
  try {
    data = await fetchSchedule(jsonUrl);
  } catch (e) {
    el.innerHTML = `<div class="muted">Schedule failed to load (${e.message}).</div>`;
    throw e;
  }

  const now = new Date();
  const days = Array.isArray(data.days) ? data.days : [];
  const tz   = data.timezone || 'America/Los_Angeles';

  const todayYMD = now.toISOString().slice(0,10);
  const today = days.find(d => d.date === todayYMD);

  const flatten = (day) => (day.events || []).map(ev => ({
    ...ev, dt: toDate(tz, day.date, ev.time), day
  })).sort((a,b) => a.dt - b.dt);

  let html = `<h3 style="margin:0 0 8px 0;">Today</h3>`;

  if (today) {
    const evs = flatten(today);
    const upcoming = evs.filter(e => e.dt > now);
    const upNext = upcoming[0];
    const remaining = upcoming.slice(0, 4);

    html += `<div class="card" style="margin:8px 0;">
      <div><strong>${today.label || today.date}</strong></div>
      ${upNext
        ? `<div class="muted" style="margin-top:6px;">Up Next · ${upNext.time} — ${upNext.title}</div>`
        : `<div class="muted" style="margin-top:6px;">All scheduled items for today are complete.</div>`}
      ${remaining.length ? `<ul style="margin:10px 0 0 18px;">${
        remaining.map(e => `<li><strong>${e.time}</strong> ${e.title}</li>`).join('')
      }</ul>` : ''}
      <div style="margin-top:10px;">
        <a class="pill" href="schedule.html">View Full Schedule</a>
      </div>
    </div>`;
  } else {
    const futureDay = days.find(d => toDate(tz, d.date, '00:00') > now);
    if (futureDay) {
      const first = (futureDay.events || [])[0];
      html += `<div class="card" style="margin:8px 0;">
        <div><strong>Next: ${futureDay.label || futureDay.date}</strong></div>
        ${first ? `<div class="muted" style="margin-top:6px;">First event · ${first.time} — ${first.title}</div>` : ``}
        <div style="margin-top:10px;"><a class="pill" href="schedule.html">View Full Schedule</a></div>
      </div>`;
    } else {
      html += `<div class="card" style="margin:8px 0;">
        <div class="muted">No upcoming dates.</div>
        <div style="margin-top:10px;"><a class="pill" href="schedule.html">View Full Schedule</a></div>
      </div>`;
    }
  }

  el.innerHTML = html;
  return data;
}
