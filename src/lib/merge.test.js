import { describe, it, expect } from 'vitest';
import { mergeStays } from './merge.js';

const s = (id, updatedAt, extra = {}) => ({ id, entry: '2026-01-01', exit: '2026-01-05', note: '', updatedAt, deleted: false, ...extra });

describe('mergeStays', () => {
  it('unions by id', () => {
    expect(mergeStays([s('a', 1)], [s('b', 1)]).map((x) => x.id).sort()).toEqual(['a', 'b']);
  });
  it('newer updatedAt wins either side', () => {
    expect(mergeStays([s('a', 5, { note: 'local' })], [s('a', 3, { note: 'remote' })])[0].note).toBe('local');
    expect(mergeStays([s('a', 3, { note: 'local' })], [s('a', 5, { note: 'remote' })])[0].note).toBe('remote');
  });
  it('tie goes to local', () => {
    expect(mergeStays([s('a', 5, { note: 'local' })], [s('a', 5, { note: 'remote' })])[0].note).toBe('local');
  });
  it('handles ISO-string updatedAt', () => {
    const r = mergeStays([s('a', '2026-01-02T00:00:00Z', { note: 'l' })], [s('a', '2026-01-03T00:00:00Z', { note: 'r' })]);
    expect(r[0].note).toBe('r');
  });
  it('a newer tombstone beats an older live stay', () => {
    const r = mergeStays([s('a', 9, { deleted: true })], [s('a', 3)], 10); // small fake timestamps: pass a matching now
    expect(r[0].deleted).toBe(true);
  });
  it('prunes tombstones older than a year, keeps recent ones', () => {
    const now = Date.now();
    const old = now - 400 * 24 * 3600 * 1000;
    const r = mergeStays([s('old', old, { deleted: true }), s('new', now - 1000, { deleted: true })], [], now);
    expect(r.map((x) => x.id)).toEqual(['new']);
  });
});
