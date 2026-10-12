import { toDay, WINDOW } from '../lib/schengen.js';

// Clip every stay to the 180-day window ending today and express it as % of the strip.
export function timelineBars(stays, todayISO) {
  const today = toDay(todayISO);
  const winStart = today - (WINDOW - 1);
  const bars = [];
  for (const s of stays) {
    if (s.deleted) continue;
    const start = toDay(s.entry);
    if (!s.exit && start > today) continue; // an open stay that has not started
    const end = s.exit ? toDay(s.exit) : today;
    const from = Math.max(start, winStart);
    const to = Math.min(end, today);
    if (to < from) continue; // entirely outside the window
    bars.push({
      id: s.id,
      left: ((from - winStart) / WINDOW) * 100,
      width: ((to - from + 1) / WINDOW) * 100,
    });
  }
  return bars;
}

export function renderTimeline({ stays, todayISO, startLabel, todayLabel, aria }) {
  const bars = timelineBars(stays, todayISO)
    .map(
      (b, i) =>
        `<span class="timeline__bar timeline__bar--${i % 2}" style="left:${b.left.toFixed(2)}%;width:${b.width.toFixed(2)}%"></span>`,
    )
    .join('');
  return `<div class="timeline" role="img" aria-label="${aria}">
    <div class="timeline__track">${bars}<span class="timeline__today"></span></div>
    <div class="timeline__axis"><span>${startLabel}</span><span>${todayLabel}</span></div>
  </div>`;
}
