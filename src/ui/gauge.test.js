import { describe, it, expect } from 'vitest';
import { gaugeLevel, renderGauge, CIRCUMFERENCE } from './gauge.js';

describe('gaugeLevel', () => {
  it('moves ok -> warn -> low as days are used', () => {
    expect(gaugeLevel(0)).toBe('ok');
    expect(gaugeLevel(53)).toBe('ok');
    expect(gaugeLevel(54)).toBe('warn');
    expect(gaugeLevel(76)).toBe('warn');
    expect(gaugeLevel(77)).toBe('low');
    expect(gaugeLevel(95)).toBe('low');
  });
});

describe('renderGauge', () => {
  const base = { left: 30, label: 'days left', aria: '60 of 90 days used' };

  it('fills two thirds of the ring at 60 of 90 days', () => {
    const html = renderGauge({ ...base, used: 60 });
    const offset = Number(/stroke-dashoffset="([\d.]+)"/.exec(html)[1]);
    expect(offset).toBeCloseTo(CIRCUMFERENCE / 3, 1);
    expect(html).toContain('>30<');
  });

  it('draws no arc when nothing is used', () => {
    expect(renderGauge({ ...base, used: 0, left: 90 })).not.toContain('gauge__value');
  });

  it('caps the arc at a full ring when over the limit', () => {
    const html = renderGauge({ ...base, used: 100, left: 0 });
    expect(Number(/stroke-dashoffset="([\d.]+)"/.exec(html)[1])).toBe(0);
  });

  it('escapes the accessible label', () => {
    expect(renderGauge({ ...base, used: 5, aria: '"><script>' })).not.toContain('<script>');
  });
});
