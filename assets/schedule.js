// assets/schedule.js (12-hour AM/PM formatting)

function toDate(tz, ymd, hm) {
  const [Y, M, D] = ymd.split("-").map(Number);
  const [h, m] = hm.split(":").map(Number);
  return new Date(Y, M - 1, D, h, m, 0, 0);
}

function fmt12(hm) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}


async function fetchSchedule(url) {
  const vurl = url + (url.includes("?") ? "&" : "?") + "v=6";
  const res = await fetch(vurl);
  if (!res.ok) throw new Error(`schedule.json fetch failed (${res.status})`);
  return res.json();
}

async function renderScheduleSummary(mountId, jsonUrl) {
  const el = document.getElementById(mountId);
  if (!el) return;
  try {
    const data = await fetchSchedule(jsonUrl);
    const now = new Date();

    const todayYMD = now.toISOString().slice(0, 10);
    const days = data.days || [];
    const today = days.find((d) => d.date === todayYMD);

    function flatten(day) {
      return day.events
        .map((ev) => ({
          ...ev,
          dt: toDate(data.timezone, day.date, ev.time),
          day,
        }))
        .sort((a, b) => a.dt - b.dt);
    }

    let html = `<h3 class="sched-heading">Today</h3>`;

    if (today) {
      const evs = flatten(today);
      const upcoming = evs.filter((e) => e.dt > now);
      const upNext = upcoming[0];
      const remaining = upcoming.slice(0, 4);

      html += `<div class="card" style="margin:8px 0;">
        <div style="font-size:14px;font-weight:700;">${today.label}</div>
        ${
          upNext
            ? `<div class="muted" style="margin-top:6px;font-size:12px;">Up Next · ${fmt12(
                upNext.time
              )} — ${upNext.title}</div>`
            : `<div class="muted" style="margin-top:6px;font-size:12px;">All scheduled items for today are complete.</div>`
        }
        ${
          remaining.length
            ? `<ul style="margin:10px 0 0 18px;font-size:14px;line-height:1.3;">${remaining
                .map(
                  (e) =>
                    `<li><strong>${fmt12(e.time)}</strong> ${e.title}</li>`
                )
                .join("")}</ul>`
            : ""
        }
        <div style="margin-top:16px;">
          <a class="pill" href="schedule.html">View Full Schedule</a>
        </div>
      </div>`;
    } else {
      const futureDay = days.find(
        (d) => toDate(data.timezone, d.date, "00:00") > now
      );
      if (futureDay && futureDay.events && futureDay.events.length) {
        const first = futureDay.events[0];
        html += `<div class="card" style="margin:8px 0;">
          <div style="font-size:14px;font-weight:700;">Next: ${futureDay.label}</div>
          <div class="muted" style="margin-top:6px;font-size:12px;">First event · ${fmt12(
            first.time
          )} — ${first.title}</div>
          <div style="margin-top:16px;"><a class="pill" href="schedule.html">View Full Schedule</a></div>
        </div>`;
      } else {
        html += `<div class="card" style="margin:8px 0;">
          <div class="muted" style="font-size:12px;">No upcoming dates.</div>
          <div style="margin-top:16px;"><a class="pill" href="schedule.html">View Full Schedule</a></div>
        </div>`;
      }
    }

    el.innerHTML = html;
  } catch (e) {
    console.error("[schedule] summary error:", e);
    el.innerHTML = `<div class="muted">Schedule unavailable.</div>`;
  }
}

async function renderFullSchedule(mountId, jsonUrl) {
  const el = document.getElementById(mountId);
  if (!el) return;
  try {
    const data = await fetchSchedule(jsonUrl);
    const now = new Date();

    let out = "";
    (data.days || []).forEach((day) => {
      out += `<section class="card" style="margin-top:12px;">
        <h4 style="margin:6px 0 4px 0;font-size:16px;font-weight:700;">${day.label}</h4>
        <ul style="list-style:none;padding:0;margin:0;">`;

      (day.events || []).forEach((ev) => {
        const dt = toDate(data.timezone, day.date, ev.time);
        const isPast = dt < now;
        const isNowish = Math.abs(dt - now) < 30 * 60 * 1000;
        out += `<li style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid #e5e7eb;">
          <div style="width:72px;font-weight:600;font-size:14px;">${fmt12(
            ev.time
          )}</div>
          <div style="flex:1;">
            <div style="font-size:14px;line-height:1.3;">${ev.title}</div>
            ${
              isNowish
                ? `<div class="muted" style="font-size:12px;">Happening soon</div>`
                : ``
            }
          </div>
          ${
            isPast
              ? `<span class="muted" style="font-size:12px;">done</span>`
              : ``
          }
        </li>`;
      });

      out += `</ul></section>`;
    });

    el.innerHTML = out || `<div class="muted">No schedule data.</div>`;
  } catch (e) {
    console.error("[schedule] full error:", e);
    el.innerHTML = `<div class="muted">Schedule unavailable.</div>`;
  }
}
