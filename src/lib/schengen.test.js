import { describe, it, expect } from 'vitest';
import { toDay, toISO, usedDays, daysLeft, maxStay, summarize } from './schengen.js';

const stay = (entry, exit = null) => ({ entry, exit });

describe('dates', () => {
  it('round-trips ISO <-> day number', () => {
    expect(toISO(toDay('2026-10-12'))).toBe('2026-10-12');
    expect(toDay('2026-03-02') - toDay('2026-03-01')).toBe(1);
  });

  it('rejects malformed and impossible dates', () => {
    expect(() => toDay('2026-2-3')).toThrow();
    expect(() => toDay('2026-02-30')).toThrow();
    expect(() => toDay('')).toThrow();
    expect(() => toDay(undefined)).toThrow();
  });
});

describe('counting days', () => {
  it('counts a single-day stay as 1', () => {
    const s = [stay('2026-03-01', '2026-03-01')];
    expect(usedDays(s, '2026-03-01')).toBe(1);
    expect(daysLeft(s, '2026-03-01')).toBe(89);
  });

  it('counts entry and exit days both', () => {
    expect(usedDays([stay('2026-03-01', '2026-03-10')], '2026-03-10')).toBe(10);
  });

  it('does not double-count overlapping stays', () => {
    const s = [stay('2026-03-01', '2026-03-10'), stay('2026-03-05', '2026-03-15')];
    expect(usedDays(s, '2026-03-15')).toBe(15);
  });

  it('counts an ongoing stay through today, and ignores one that has not started', () => {
    expect(usedDays([stay('2026-03-01')], '2026-03-10')).toBe(10);
    expect(usedDays([stay('2026-03-20')], '2026-03-10')).toBe(0);
  });

  it('handles a leap year (2028-02-29 exists)', () => {
    expect(usedDays([stay('2028-02-27', '2028-03-02')], '2028-03-02')).toBe(5);
  });

  it('ignores deleted stays', () => {
    const s = [{ entry: '2026-03-01', exit: '2026-03-10', deleted: true }];
    expect(usedDays(s, '2026-03-10')).toBe(0);
  });

  it('throws when exit is before entry', () => {
    expect(() => usedDays([stay('2026-03-10', '2026-03-01')], '2026-03-10')).toThrow();
  });
});

describe('the 180-day window boundary', () => {
  // Stay Jan 1-10. The window ending on d is [d-179, d].
  const s = [stay('2026-01-01', '2026-01-10')];

  it('still includes the first day on day 180 of the window', () => {
    expect(usedDays(s, '2026-06-29')).toBe(10);
  });

  it('drops the first day on day 181', () => {
    expect(usedDays(s, '2026-06-30')).toBe(9);
  });
});

describe('zero days left', () => {
  // Jan 1 - Mar 31 2026 is exactly 90 days.
  const s = [stay('2026-01-01', '2026-03-31')];

  it('shows 0 left and "leave today" while still present', () => {
    const r = summarize(s, '2026-03-31');
    expect(r.used).toBe(90);
    expect(r.left).toBe(0);
    expect(r.presentToday).toBe(true);
    expect(r.latestLeave).toBe('2026-03-31');
  });

  it('shows she cannot be there at all the day after', () => {
    const r = summarize(s, '2026-04-01');
    expect(r.left).toBe(0);
    expect(r.presentToday).toBe(false);
    expect(r.latestLeave).toBeNull();
  });
});

describe('latest leave date and planner', () => {
  const s = [stay('2026-01-01', '2026-01-10')]; // 10 days used

  it('computes the last allowed day if she stays continuously from today', () => {
    // 10 used + 80 more = 90, reached on Apr 21; Apr 22 would be 91.
    expect(summarize(s, '2026-02-01').latestLeave).toBe('2026-04-21');
  });

  it('planner matches for a future entry date', () => {
    expect(maxStay(s, '2026-02-01', '2026-01-20')).toEqual({ days: 80, lastDay: '2026-04-21' });
  });

  it('planner starting inside a full window allows 0 days', () => {
    const full = [stay('2026-01-01', '2026-03-31')];
    expect(maxStay(full, '2026-04-01', '2026-04-01')).toEqual({ days: 0, lastDay: null });
  });

  it('planner recovers once old days slide out of the window', () => {
    const full = [stay('2026-01-01', '2026-03-31')];
    // Entering 2026-10-01: window start is 2026-04-05, the whole old stay is gone.
    expect(maxStay(full, '2026-10-01', '2026-04-01')).toEqual({ days: 90, lastDay: '2026-12-29' });
  });
});
