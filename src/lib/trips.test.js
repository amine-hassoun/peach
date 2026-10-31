import { describe, it, expect } from 'vitest';
import { upcomingReleases, planTrips } from './trips.js';

describe('trips', () => {
  it('a 7-day stay returns as one run 180 days later', () => {
    const stays = [{ entry: '2026-10-14', exit: '2026-10-20', deleted: false }];
    expect(upcomingReleases(stays, '2026-10-31')).toEqual([
      { from: '2027-04-12', to: '2027-04-18', days: 7 },
    ]);
  });
  it('no stays: 90 days from entry', () => {
    const r = planTrips([], [{ id: 'a', entry: '2026-11-01', exit: '' }], '2026-10-31').get('a');
    expect(r).toMatchObject({ days: 90, lastDay: '2027-01-29' });
  });
});