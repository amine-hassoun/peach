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
    document.body.innerHTML = '<div id="app"></div><div id="planner"></div><div id="settings"></div><dialog id="stay-dialog"></dialog>';
    await import('./main.js');
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

  it('switches to Georgian and back', () => {
    click($('[data-action="toggle-lang"]'));
    expect($('.card__head h2').textContent).toBe(messages.ka['stays.title']);
    click($('[data-action="toggle-lang"]'));
    expect($('.card__head h2').textContent).toBe(messages.en['stays.title']);
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
});

function $$(sel) {
  return [...document.querySelectorAll(sel)];
}
