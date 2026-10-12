import { describe, it, expect } from 'vitest';
import { esc } from './html.js';

describe('esc', () => {
  it('escapes HTML-significant characters', () => {
    expect(esc('<img src=x onerror="a()">')).toBe('&lt;img src=x onerror=&quot;a()&quot;&gt;');
    expect(esc(`Tom & Jerry's`)).toBe('Tom &amp; Jerry&#39;s');
  });

  it('turns null and undefined into an empty string', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});
