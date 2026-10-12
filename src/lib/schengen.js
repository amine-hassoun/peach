// Schengen 90/180-day engine. Pure functions: no DOM, no network, no "today" read
// from the clock. The caller always passes the date, which keeps this testable.
//
// A stay is { entry: 'YYYY-MM-DD', exit: 'YYYY-MM-DD' | null, deleted?: boolean }.
// exit === null means "still there" (ongoing).

export const WINDOW = 180; // rolling window length, in days
export const LIMIT = 90; // max days present inside any window

const MS_PER_DAY = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

// ---- Dates: ISO string <-> integer "day number" (days since 1970-01-01, UTC) ----

export function toDay(iso) {
  const m = ISO.exec(iso ?? '');
  if (!m) throw new Error(`Invalid date: ${iso}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  // Date.UTC silently rolls 2026-02-30 into March; reject anything that moved.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    throw new Error(`Invalid date: ${iso}`);
  }
  return ms / MS_PER_DAY;
}

export function toISO(day) {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

// ---- Presence: which calendar days was she inside the area? ----

// Returns a Set of day numbers. Entry and exit days both count. An ongoing stay
// (no exit) counts through `today`; one that hasn't started yet counts for nothing.
function buildPresence(stays, today) {
  const present = new Set();
  for (const s of stays) {
    if (s.deleted) continue;
    const start = toDay(s.entry);
    let end;
    if (s.exit) {
      end = toDay(s.exit);
      if (end < start) throw new Error(`Exit before entry: ${s.entry} → ${s.exit}`);
    } else {
      if (start > today) continue;
      end = today;
    }
    for (let d = start; d <= end; d++) present.add(d);
  }
  return present;
}

// Days present in the window [day-179, day], inclusive on both ends.
function usedIn(present, day) {
  let n = 0;
  for (let d = day - WINDOW + 1; d <= day; d++) if (present.has(d)) n++;
  return n;
}

// If she is present on every day from `start` onward, how many days can she
// keep that up before some day's window exceeds 90? Works on a copy of `present`.
function maxContinuous(present, start) {
  const p = new Set(present);
  let n = 0;
  while (n < WINDOW) {
    const d = start + n;
    p.add(d);
    if (usedIn(p, d) > LIMIT) break;
    n++;
  }
  return n;
}

// ---- Public API ----

export function usedDays(stays, dateISO) {
  const day = toDay(dateISO);
  return usedIn(buildPresence(stays, day), day);
}

export function daysLeft(stays, todayISO) {
  return Math.max(0, LIMIT - usedDays(stays, todayISO));
}

// Planner: if she is present every day starting `entryISO`, how long can she stay?
// Returns { days, lastDay } where lastDay is an ISO date, or null if even day one is over the limit.
export function maxStay(stays, entryISO, todayISO) {
  const present = buildPresence(stays, toDay(todayISO));
  const entry = toDay(entryISO);
  const days = maxContinuous(present, entry);
  return { days, lastDay: days > 0 ? toISO(entry + days - 1) : null };
}

// Everything the home screen needs, from one presence build.
export function summarize(stays, todayISO) {
  const today = toDay(todayISO);
  const present = buildPresence(stays, today);
  const used = usedIn(present, today);
  const run = maxContinuous(present, today);
  return {
    used,
    left: Math.max(0, LIMIT - used),
    presentToday: present.has(today),
    // Last day she may still be there if she stays continuously from today.
    // null = she cannot be there today without exceeding the limit.
    latestLeave: run > 0 ? toISO(today + run - 1) : null,
  };
}