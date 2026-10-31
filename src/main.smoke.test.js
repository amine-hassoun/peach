// @vitest-environment jsdom
// End-to-end smoke test of the UI in jsdom: add a stay, see the numbers update,
// switch language, delete and undo. Pure-logic tests live next to each module.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { messages } from './i18n.js';

const $ = (sel) => document.querySelector(sel);
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

function submitForm({ entry = '', exit = '', ongoing = false, note = '' }) {
  const form = $('#stay-dialog form');
  form.elements.entry.value = entry;
  form.elements.ongoing.checked = ongoing;
  form.elements.exit.value = exit;
  form.elements.note.value = note;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('peach UI', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0)); // 12 Oct 2026, local
    // jsdom has no <dialog> behaviour or matchMedia.
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    window.matchMedia = () => ({ matches: false });
    document.body.innerHTML = '<div id="app"></div><div id="planner"></div><dialog id="stay-dialog"></dialog>';
    await import('./main.js');
  });

  it('puts the trip planner above the stays list', () => {
    const planner = $('#planner');
    const stays = $('[data-action="add"]').closest('.card');
    expect(planner.compareDocumentPosition(stays) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect($('.hero__next')).toBeNull(); // nothing to come back yet
  });

  it('starts empty with 90 days left', () => {
    expect($('.hero')).not.toBeNull();
    expect($('.gauge__num').textContent).toBe('90');
    expect($('.empty')).not.toBeNull();
  });

  it('shows a validation error for an empty form', () => {
    click($('[data-action="add"]'));
    submitForm({});
    expect($('.form-error').hidden).toBe(false);
    expect($('.form-error').textContent).toBe(messages.en['err.required']);
    click($('[data-action="close-form"]'));
  });

  it('adds a stay: gauge, hero date and list update; notes are escaped', () => {
    click($('[data-action="add"]'));
    submitForm({ entry: '2026-10-03', exit: '2026-10-12', note: '<b>x</b>' });
    expect($('.gauge__num').textContent).toBe('80');
    expect($('.hero').textContent).toContain('31 December 2026'); // 10 used + 80 more days
    expect($('.stay__range').textContent).toContain('3 Oct 2026');
    expect($('.stay .muted').textContent).toContain('10 days');
    expect($('.stay b')).toBeNull(); // the <b> was escaped, not rendered
  });

  it('the days-left card shows when days come back and how many', () => {
    // Oct 3-12 leave the window from 1 Apr 2027 (+10 days, one per date through 10 Apr).
    const next = $('.hero .hero__next');
    expect(next).not.toBeNull();
    expect(next.textContent).toContain('1 Apr 2027');
    expect(next.textContent).toContain('+10 days');
  });

  it('switches to Georgian and back', () => {
    click($('[data-action="toggle-lang"]'));
    const staysTitle = () => $('[data-action="add"]').closest('.card').querySelector('h2');
    click($('[data-action="toggle-lang"]'));
  });

  it('deletes with undo', () => {
    click($('[data-action="delete"]'));
    expect($('.stay')).toBeNull();
    expect($('.gauge__num').textContent).toBe('90');
    click($('[data-action="undo"]'));
    expect($('.stay')).not.toBeNull();
    expect($('.gauge__num').textContent).toBe('80');
  });

  it('an ongoing stay counts through today', () => {
    click($('[data-action="add"]'));
    submitForm({ entry: '2026-10-10', ongoing: true });
    // Oct 3-12 already counted; Oct 10-12 overlaps, so still 10 used.
    expect($('.gauge__num').textContent).toBe('80');
    expect($$('.stay').length).toBe(2);
  });

  it('leave closes the open stay today; arrive opens a new one', () => {
    expect($('[data-action="arrive"]')).toBeNull();
    click($('[data-action="leave"]'));
    expect($('[data-action="leave"]')).toBeNull();
    expect($$('.stay__range').map((e) => e.textContent)).toContain('10 Oct 2026 – 12 Oct 2026');
    click($('[data-action="arrive"]'));
    expect($('[data-action="leave"]')).not.toBeNull();
    expect($('.hero__checkin .muted').textContent).toContain('12 Oct 2026');
    expect($$('.stay').length).toBe(3);
  });
  
  it('scenery is light mode + wide screens only', () => {
    const root = document.documentElement;
    expect(root.classList.contains('scenic')).toBe(false); // narrow by default
    // Pretend the window is wide and the system is light.
    window.matchMedia = (q) => ({ matches: q.includes('min-width') });
    window.dispatchEvent(new Event('resize'));
    expect(root.classList.contains('scenic')).toBe(true);
    click($('[data-action="toggle-theme"]')); // -> dark
    expect(root.classList.contains('scenic')).toBe(false);
    click($('[data-action="toggle-theme"]')); // -> light again
    expect(root.classList.contains('scenic')).toBe(true);
    // Narrow window: no scenery even in light mode.
    window.matchMedia = () => ({ matches: false });
    window.dispatchEvent(new Event('resize'));
    expect(root.classList.contains('scenic')).toBe(false);
  });

  it('remembers the chosen theme for next time', () => {
    click($('[data-action="toggle-theme"]')); // -> dark
    expect(localStorage.getItem('peach.theme')).toBe('dark');
    click($('[data-action="toggle-theme"]')); // -> light
    expect(localStorage.getItem('peach.theme')).toBe('light');
  });
});

function $$(sel) {
  return [...document.querySelectorAll(sel)];
}
