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
  beforeEach(() => {
    // jsdom has no <dialog> behaviour.
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  });
  const mount = (stays = [], storage = memory()) => {
    const el = document.createElement('section');
    document.body.append(el);
    mountPlanner(el, {
      getStays: () => stays,
      today: () => '2026-10-31',
      t, tn,
      formatDate: (d) => d,
      storage,
    });
    return el;
  };
  const dialog = () => document.querySelector('dialog');
  const submit = ({ entry = '', exit = '', note = '' }) => {
    const form = dialog().querySelector('form');
    form.elements.entry.value = entry;
    form.elements.exit.value = exit;
    form.elements.note.value = note;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  };

  it('starts with a hint; + opens the popup instead of adding a blank row', () => {
    const el = mount();
    expect(el.textContent).toContain('trips.hint');
    el.querySelector('[data-trip="add"]').click();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(dialog().textContent).toContain('trips.newTitle');
    expect(el.querySelectorAll('.trip').length).toBe(0);
  });

  it('requires an entry date, and rejects an exit before the entry', () => {
    const el = mount();
    el.querySelector('[data-trip="add"]').click();
    submit({});
    expect(dialog().querySelector('.form-error').textContent).toBe('err.required');
    submit({ entry: '2026-11-10', exit: '2026-11-05' });
    expect(dialog().querySelector('.form-error').textContent).toBe('err.exitBefore');
    expect(el.querySelectorAll('.trip').length).toBe(0);
  });

  it('saving with only an entry date shows the maximum stay', () => {
    const el = mount();
    el.querySelector('[data-trip="add"]').click();
    submit({ entry: '2026-11-01', note: 'Lisbon' });
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(el.querySelector('.trip__result').textContent).toContain('trips.max');
    expect(el.querySelector('.trip').textContent).toContain('Lisbon');
  });

  it('flags a trip that goes over the limit, and supports several trips', () => {
    const el = mount([{ entry: '2026-08-03', exit: '2026-10-31', deleted: false }]); // 90 days used
    el.querySelector('[data-trip="add"]').click();
    submit({ entry: '2026-11-01', exit: '2026-11-05' });
    el.querySelector('[data-trip="add"]').click();
    submit({ entry: '2027-06-01' });
    expect(el.querySelectorAll('.trip').length).toBe(2);
    expect(el.querySelector('.trip__result').textContent).toContain('trips.over');
  });

  it('edits and removes a trip, and persists to storage', () => {
    const storage = memory();
    const el = mount([], storage);
    el.querySelector('[data-trip="add"]').click();
    submit({ entry: '2026-11-01', exit: '2026-11-05' });
    el.querySelector('[data-trip="edit"]').click();
    expect(dialog().querySelector('[name="entry"]').value).toBe('2026-11-01');
    submit({ entry: '2026-11-02', exit: '2026-11-06' });
    expect(el.querySelectorAll('.trip').length).toBe(1);
    expect(JSON.parse(storage.getItem('peach.trips'))[0].entry).toBe('2026-11-02');
    el.querySelector('[data-trip="remove"]').click();
    expect(el.querySelectorAll('.trip').length).toBe(0);
    expect(JSON.parse(storage.getItem('peach.trips'))).toEqual([]);
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
