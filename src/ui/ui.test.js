// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountPlanner } from './planner.js';
import { mountSettings } from './settings.js';

beforeEach(() => { document.body.innerHTML = '<div id="root"></div>'; });
const root = () => document.getElementById('root');

describe('planner', () => {
  const t = (k) => k;
  const tn = (k, n) => `${n}`;
  const memory = () => {
    const m = {};
    return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } };
  };
  const mount = (stays = []) => {
    const el = document.createElement('section');
    document.body.append(el);
    mountPlanner(el, {
      getStays: () => stays,
      today: () => '2026-10-31',
      t, tn,
      formatDate: (d) => d,
      storage: memory(),
    });
    return el;
  };
  const setEntry = (el, value, name = 'entry') => {
    const input = el.querySelector(`input[name="${name}"]`);
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('starts with a hint, and + adds a trip row', () => {
    const el = mount();
    expect(el.textContent).toContain('trips.hint');
    el.querySelector('[data-trip="add"]').click();
    expect(el.querySelectorAll('.trip').length).toBe(1);
  });

  it('shows the maximum stay once an entry date is set', () => {
    const el = mount();
    el.querySelector('[data-trip="add"]').click();
    setEntry(el, '2026-11-01');
    expect(el.querySelector('.trip__result').textContent).toContain('trips.max');
  });

  it('flags a trip that goes over the limit, and supports several trips', () => {
    const el = mount([{ entry: '2026-08-03', exit: '2026-10-31', deleted: false }]); // 90 days used
    el.querySelector('[data-trip="add"]').click();
    el.querySelector('[data-trip="add"]').click();
    expect(el.querySelectorAll('.trip').length).toBe(2);
    setEntry(el, '2026-11-01');
    setEntry(el, '2026-11-05', 'exit');
    expect(el.querySelector('.trip__result').textContent).toContain('trips.over');
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
