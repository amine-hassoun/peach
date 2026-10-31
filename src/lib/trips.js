import { toDay, toISO, WINDOW, LIMIT } from './schengen.js';

function presentDays(stays, todayISO) {
  const today = toDay(todayISO);
  const set = new Set();
  for (const s of stays) {
    if (s.deleted) continue;
    const end = s.exit ? toDay(s.exit) : today;
    for (let d = toDay(s.entry); d <= end; d++) set.add(d);
  }
  return set;
}

// When days leave the 180-day window and become available again (assuming no new stays).
// A day p is out of the window from p + 180. Consecutive release dates merge into one run.
export function upcomingReleases(stays, todayISO, limit = 3) {
  const today = toDay(todayISO);
  const start = today - (WINDOW - 1);
  const byDate = new Map();
  for (const p of presentDays(stays, todayISO)) {
    if (p < start || p > today) continue;
    byDate.set(p + WINDOW, (byDate.get(p + WINDOW) || 0) + 1);
  }
  const runs = [];
  for (const d of [...byDate.keys()].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && d === last.to + 1) {
      last.to = d;
      last.days += byDate.get(d);
    } else {
      runs.push({ from: d, to: d, days: byDate.get(d) });
    }
  }
  return runs.slice(0, limit).map((r) => ({ from: toISO(r.from), to: toISO(r.to), days: r.days }));
}

// Longest continuous stay starting on entryISO without ever exceeding 90 days in a 180-day window.
export function maxStayFrom(stays, entryISO, todayISO) {
  const present = presentDays(stays, todayISO);
  const e = toDay(entryISO);
  let days = 0;
  for (let d = e; d < e + WINDOW; d++) {
    let used = 0;
    for (let x = d - (WINDOW - 1); x <= d; x++) if (x >= e || present.has(x)) used++;
    if (used > LIMIT) break;
    days++;
  }
  return { days, lastDay: days ? toISO(e + days - 1) : null };
}

// Plans trips in date order. A trip with an exit date counts as a stay for the trips after it.
export function planTrips(stays, trips, todayISO) {
  const virtual = [...stays];
  const out = new Map();
  const sorted = trips.filter((t) => t.entry).sort((a, b) => a.entry.localeCompare(b.entry));
  for (const tr of sorted) {
    const { days, lastDay } = maxStayFrom(virtual, tr.entry, todayISO);
    let status = 'max';
    let over = 0;
    if (tr.exit && tr.exit >= tr.entry) {
      const want = toDay(tr.exit) - toDay(tr.entry) + 1;
      over = Math.max(0, want - days);
      status = over ? 'over' : 'ok';
      virtual.push({ entry: tr.entry, exit: tr.exit, deleted: false });
    }
    out.set(tr.id, { days, lastDay, status, over });
  }
  return out;
}