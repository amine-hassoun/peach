import { describe, it, expect } from 'vitest';
import { localISO } from './today.js';

describe('localISO', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(localISO(new Date(2026, 9, 12))).toBe('2026-10-12');
    expect(localISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('uses the local calendar day even late in the evening', () => {
    expect(localISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});
