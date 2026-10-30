// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountPlanner } from './planner.js';
import { mountSettings } from './settings.js';

beforeEach(() => { document.body.innerHTML = '<div id="root"></div>'; });
const root = () => document.getElementById('root');

describe('planner', () => {
  const base = { getStays: () => [], today: () => '2026-06-01', formatDate: (s) => `D(${s})` };
  it('shows a hint until a date is chosen, then the result', () => {
    const maxStay = vi.fn(() => ({ days: 42, lastDay: '2026-07-12' }));
    mountPlanner(root(), { ...base, maxStay });
    expect(root().textContent).toContain('Pick an entry date');
    const input = root().querySelector('input');
    input.value = '2026-07-01';
    input.dispatchEvent(new Event('input'));
    expect(maxStay).toHaveBeenCalledWith([], '2026-07-01', '2026-06-01');
    expect(root().querySelector('.planner-result').textContent).toBe('You can stay up to 42 days, until D(2026-07-12).');
  });
  it('shows the no-days message and refresh() recomputes', () => {
    let days = 0;
    const p = mountPlanner(root(), { ...base, maxStay: () => ({ days, lastDay: null }) });
    const input = root().querySelector('input');
    input.value = '2026-07-01';
    input.dispatchEvent(new Event('input'));
    expect(root().textContent).toContain('No days available');
    days = 5;
    p.refresh();
    expect(root().textContent).toContain('5 days');
  });
  it('uses translations when provided', () => {
    mountPlanner(root(), { ...base, maxStay: () => ({ days: 0 }), t: (k) => (k === 'planner.title' ? 'დაგეგმვა' : k) });
    expect(root().querySelector('h2').textContent).toBe('დაგეგმვა');
  });
});

describe('settings', () => {
  function fakePersistence(linked = false) {
    let cb = () => {};
    const p = {
      linked,
      subscribe: (fn) => { cb = fn; fn('idle'); return () => {}; },
      hasLink: () => p.linked,
      getLink: (o) => `${o}/#k=T`,
      setLink: vi.fn((text) => { if (text.includes('good')) { p.linked = true; return true; } return false; }),
      exportJSON: () => '{}',
      importJSON: vi.fn(() => 2),
      emit: (s) => cb(s),
    };
    return p;
  }
  it('renders status text and hides copy until linked', () => {
    const p = fakePersistence(false);
    mountSettings(root(), { persistence: p, origin: 'https://x' });
    expect(root().querySelector('.sync-status').textContent).toBe('Starting…');
    expect(root().querySelector('button').hidden).toBe(true);
    p.emit('offline');
    expect(root().querySelector('.sync-status').textContent).toContain('Offline');
  });
  it('link-this-device accepts good, rejects bad', () => {
    const p = fakePersistence(false);
    mountSettings(root(), { persistence: p, origin: 'https://x' });
    const [copyBtn, pasteBtn] = root().querySelectorAll('button');
    const input = root().querySelector('input[type=text]');
    input.value = 'bad';
    pasteBtn.click();
    expect(root().querySelector('.settings-msg').textContent).toContain('valid');
    input.value = 'good-link';
    pasteBtn.click();
    expect(root().querySelector('.settings-msg').textContent).toBe('Device linked');
    expect(copyBtn.hidden).toBe(false);
  });
  it('copy puts the link on the clipboard', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const p = fakePersistence(true);
    mountSettings(root(), { persistence: p, origin: 'https://x' });
    root().querySelector('button').click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('https://x/#k=T');
  });
});
