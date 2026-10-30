// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { load, save, emptyState, extractToken, captureTokenFromHash, getToken, parseImport, exportJSON, normalizeStay } from './store.js';

const TOKEN = 'ab12'.repeat(16);
beforeEach(() => localStorage.clear());

describe('load/save', () => {
  it('round-trips', () => {
    save({ ...emptyState(), stays: [{ id: 'a' }], version: 3 });
    expect(load().version).toBe(3);
  });
  it('returns empty state for corrupt or foreign-schema data', () => {
    localStorage.setItem('peach.v1', '{nope');
    expect(load()).toEqual(emptyState());
    localStorage.setItem('peach.v1', JSON.stringify({ schema: 99, stays: [] }));
    expect(load()).toEqual(emptyState());
  });
  it('save reports failure instead of throwing', () => {
    expect(save(emptyState(), { setItem() { throw new Error('quota'); } })).toBe(false);
  });
});

describe('token', () => {
  it('extracts from link, fragment or bare token; rejects junk', () => {
    expect(extractToken(`https://x.on.aws/#k=${TOKEN}`)).toBe(TOKEN);
    expect(extractToken(`#k=${TOKEN}`)).toBe(TOKEN);
    expect(extractToken(` ${TOKEN} `)).toBe(TOKEN);
    expect(extractToken('hello world')).toBeNull();
    expect(extractToken('')).toBeNull();
  });
  it('captures from hash, stores it, strips the address bar', () => {
    const calls = [];
    const ok = captureTokenFromHash({ hash: `#k=${TOKEN}`, pathname: '/', search: '' }, { replaceState: (...a) => calls.push(a) });
    expect(ok).toBe(true);
    expect(getToken()).toBe(TOKEN);
    expect(calls[0][2]).toBe('/');
  });
  it('does nothing without a token', () => {
    expect(captureTokenFromHash({ hash: '', pathname: '/', search: '' }, { replaceState() { throw new Error('no'); } })).toBe(false);
  });
});

describe('import/export', () => {
  const good = { id: 'a', entry: '2026-02-01', exit: '2026-02-10', note: 'trip', updatedAt: 5 };
  it('parses an export back', () => {
    const out = parseImport(exportJSON([good, { ...good, id: 'gone', deleted: true }]));
    expect(out.map((s) => s.id)).toEqual(['a']);
  });
  it('accepts a bare array and fills missing id/updatedAt', () => {
    const [s] = parseImport(JSON.stringify([{ entry: '2026-02-01', exit: null }]));
    expect(s.id).toBeTruthy();
    expect(typeof s.updatedAt).toBe('number');
  });
  it('rejects bad input', () => {
    expect(() => parseImport('nope')).toThrow(/valid JSON/);
    expect(() => parseImport('{}')).toThrow(/No stays/);
    expect(() => parseImport(JSON.stringify([{ entry: '2026-02-30' }]))).toThrow(/entry/);
    expect(() => parseImport(JSON.stringify([{ entry: '2026-02-10', exit: '2026-02-01' }]))).toThrow(/before/);
    expect(() => parseImport(JSON.stringify(Array.from({ length: 501 }, () => good)))).toThrow(/Too many/);
  });
  it('truncates long notes', () => {
    expect(normalizeStay({ ...good, note: 'x'.repeat(500) }).note).toHaveLength(200);
  });
});
