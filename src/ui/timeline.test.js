import { describe, it, expect } from 'vitest';
import { timelineBars } from './timeline.js';

const today = '2026-10-12'; // window = 2026-04-16 .. 2026-10-12

describe('timelineBars', () => {
  it('places a stay inside the window as a percentage of 180 days', () => {
    const [b] = timelineBars([{ id: 'a', entry: '2026-10-03', exit: '2026-10-12' }], today);
    expect(b.width).toBeCloseTo((10 / 180) * 100, 5); // 10 days
    expect(b.left + b.width).toBeCloseTo(100, 5); // ends at today, the right edge
  });

  it('clips a stay that started before the window', () => {
    const [b] = timelineBars([{ id: 'a', entry: '2026-03-01', exit: '2026-04-20' }], today);
    expect(b.left).toBe(0);
    expect(b.width).toBeCloseTo((5 / 180) * 100, 5); // Apr 16-20
  });

  it('draws an ongoing stay through today', () => {
    const [b] = timelineBars([{ id: 'a', entry: '2026-10-10', exit: null }], today);
    expect(b.width).toBeCloseTo((3 / 180) * 100, 5);
  });

  it('skips deleted, out-of-window and not-yet-started stays', () => {
    const stays = [
      { id: 'd', entry: '2026-09-01', exit: '2026-09-05', deleted: true },
      { id: 'o', entry: '2025-01-01', exit: '2025-01-10' },
      { id: 'f', entry: '2026-11-01', exit: null },
    ];
    expect(timelineBars(stays, today)).toEqual([]);
  });
});
