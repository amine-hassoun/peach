import { describe, it, expect, beforeEach } from 'vitest';
import { messages, t, tn, setLang, formatDate } from './i18n.js';

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('Georgian has exactly the same keys as English', () => {
    expect(Object.keys(messages.ka).sort()).toEqual(Object.keys(messages.en).sort());
  });

  it('every key has the same {placeholders} in both languages', () => {
    for (const key of Object.keys(messages.en)) {
      expect(placeholders(messages.ka[key]), key).toEqual(placeholders(messages.en[key]));
    }
  });

  it('has no empty strings', () => {
    for (const lang of Object.keys(messages)) {
      for (const [key, value] of Object.entries(messages[lang])) {
        expect(value.trim().length, `${lang}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('every .one plural has a matching .other', () => {
    for (const key of Object.keys(messages.en).filter((k) => k.endsWith('.one'))) {
      expect(messages.en[key.replace(/\.one$/, '.other')]).toBeDefined();
    }
  });
});

describe('t / tn / formatDate', () => {
  beforeEach(() => setLang('en'));

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('hero.over', { n: 4 })).toBe('Over the limit by 4 days');
    expect(t('hero.over')).toBe('Over the limit by {n} days');
  });

  it('falls back to the key itself when missing', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('picks singular and plural', () => {
    expect(tn('stays.days', 1)).toBe('1 day');
    expect(tn('stays.days', 5)).toBe('5 days');
  });

  it('switches language', () => {
    setLang('ka');
    expect(t('stays.add')).toBe(messages.ka['stays.add']);
  });

  it('formats an ISO date in UTC without shifting the day', () => {
    expect(formatDate('2026-10-12', 'long')).toBe('12 October 2026');
    expect(formatDate('2026-03-01', 'medium')).toBe('1 Mar 2026');
  });
});
