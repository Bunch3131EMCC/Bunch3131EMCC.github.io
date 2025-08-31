<script>
// tiny helper to parse "YYYY-MM-DD" + "HH:mm" in a given tz (fallback: local)
function toDate(tz, ymd, hm) {
  const [Y,M,D] = ymd.split("-").map(Number);
  const [h,m] = hm.split(":").map(Number);
  // build local then shift via Intl for display only; comparisons use local epoch
  return new Date(Y, M-1, D, h, m, 0, 0);
}

async function fetchSchedule(url) {
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=4');
  if (!res.ok) throw new Error('schedule.json fetch failed');
  return res.json();
}

// ---------- HOMEPAGE SUMMARY ----------
async function renderScheduleSummary(mountId, jsonUrl) {
  const el = document.getElementById(mountId);
  if (!el) return;

  const data = await fetchSchedule(jsonUrl);
  const now = new Date();

  // find today's bucket
  const todayYMD = now.toISOString().slice(0,10);
  const days = data.days;
  const today = days.find(d => d.date === todayYMD);

  // helper to flatten events with absolute times
  function flatten(day) {
    return day.events.map(ev => ({
      ...ev,
      dt: toDate(data.timezone, day.date, ev.time),
      day
    })).sort((a,b) => a.dt - b.dt);
  }

  let html = `<h3 style="margin:0 0 8px 0;">Today</h3>`;
  if (today) {
    const evs = flatten(today);
    const past = evs.filter(e => e.dt <= now);
    const upcoming = evs.filter(e => e.dt > now);

    const upNext = upcoming[0];
    const remaining = upcoming.slice(0, 4); // show a few

    html += `<div class="card" style="margin:8px 0;">
      <div><strong>${today.label}</strong></div>
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
    // if not during event dates, show the next day
    const futureDay = days.find(d => toDate(data.timezone, d.date, "00:00") > now);
    if (futureDay) {
      const first = futureDay.events[0];
      html += `<div class="card" style="margin:8px 0;">
        <div><strong>Next: ${futureDay.label}</strong></div>
        <div class="muted" style="margin-top:6px;">First event · ${first.time} — ${first.title}</div>
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
}

// ---------- FULL PAGE ----------
async function renderFullSchedule(mountId, jsonUrl) {
  const el = document.getElementById(mountId);
  if (!el) return;
  const data = await fetchSchedule(jsonUrl);
  const now = new Date();

  let out = '';
  data.days.forEach(day => {
    out += `<section class="card" style="margin-top:12px;">
      <h2 style="margin:0 0 8px 0;">${day.label}</h2>
      <ul style="list-style:none;padding:0;margin:0;">`;

    day.events.forEach(ev => {
      const dt = toDate(data.timezone, day.date, ev.time);
      const isPast = dt < now;
      const isNowish = Math.abs(dt - now) < 30 * 60 * 1000; // 30min window
      out += `<li style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid #e5e7eb;">
        <div style="width:72px;font-weight:600;">${ev.time}</div>
        <div style="flex:1;">
          <div>${ev.title}</div>
          ${isNowish ? `<div class="muted" style="font-size:12px;">Happening soon</div>` : ``}
        </div>
        ${isPast ? `<span class="muted" style="font-size:12px;">done</span>` : ``}
      </li>`;
    });

    out += `</ul></section>`;
  });

  el.innerHTML = out;
}
</script>
