import { describe, it, expect } from 'vitest';
import { loadTheme, saveTheme } from './theme.js';

const fake = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
};

describe('theme memory', () => {
  it('returns null when nothing is stored (follow the system)', () => {
    expect(loadTheme(fake())).toBeNull();
  });
  it('remembers light and dark', () => {
    const s = fake();
    saveTheme('light', s);
    expect(loadTheme(s)).toBe('light');
    saveTheme('dark', s);
    expect(loadTheme(s)).toBe('dark');
  });
  it('ignores garbage values', () => {
    const s = fake();
    s.setItem('peach.theme', 'purple');
    expect(loadTheme(s)).toBeNull();
  });
  it('never throws when storage is blocked', () => {
    const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(loadTheme(bad)).toBeNull();
    expect(() => saveTheme('dark', bad)).not.toThrow();
  });
});
