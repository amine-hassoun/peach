import { planTrips } from '../lib/trips.js';
import { toDay } from '../lib/schengen.js';
import { esc } from '../lib/html.js';

const KEY = 'peach.trips';

// Trip: { id, entry, exit | '', note }. Added and edited through a popup that looks
// like the "New stay" one. `dialog` is the shared <dialog> element; tests omit it.
export function mountPlanner(
  el,
  { getStays, today, t, tn, formatDate, storage = globalThis.localStorage, dialog = null },
) {
  el.classList.add('card');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    document.body.append(dialog);
  }

  let trips = [];
  try {
    const v = JSON.parse(storage.getItem(KEY));
    if (Array.isArray(v)) trips = v;
  } catch { /* first run */ }
  // Drop finished trips, and blank rows left over from the old inline-input planner.
  trips = trips.filter((x) => x.entry && (!x.exit || x.exit >= today()));

  let editingId = null;

  const save = () => {
    try { storage.setItem(KEY, JSON.stringify(trips)); } catch { /* storage full or blocked */ }
  };

  function message(r) {
    if (!r) return t('trips.hint');
    const max = r.days
      ? t('trips.max', { days: tn('stays.days', r.days), date: formatDate(r.lastDay, 'long') })
      : t('trips.blocked');
    if (r.status === 'over') return `${t('trips.over', { n: tn('stays.days', r.over) })} · ${max}`;
    if (r.status === 'ok') return `${t('trips.fits')} · ${max}`;
    return max;
  }

  function row(tr, results) {
    const r = results.get(tr.id);
    const cls = r?.status === 'over' ? 'is-over' : r?.status === 'ok' ? 'is-ok' : '';
    const from = formatDate(tr.entry, 'medium');
    const range = tr.exit ? `${from} – ${formatDate(tr.exit, 'medium')}` : t('trips.from', { date: from });
    const length = tr.exit ? tn('stays.days', toDay(tr.exit) - toDay(tr.entry) + 1) : '';
    const meta = [length, tr.note].filter(Boolean).map(esc).join(' · ');
    return `<li class="trip" data-id="${esc(tr.id)}">
      <div class="trip__main">
        <p class="trip__range">${esc(range)}</p>
        ${meta ? `<p class="muted">${meta}</p>` : ''}
        <p class="trip__result ${cls}">${esc(message(r))}</p>
      </div>
      <div class="trip__actions">
        <button class="btn btn--ghost btn--small" data-trip="edit">${esc(t('stays.edit'))}</button>
        <button class="btn btn--ghost btn--small" data-trip="remove">${esc(t('trips.remove'))}</button>
      </div>
    </li>`;
  }

  function render() {
    const results = planTrips(getStays(), trips, today());
    const sorted = [...trips].sort((a, b) => a.entry.localeCompare(b.entry));
    el.innerHTML = `<div class="card__head">
      <h2>${esc(t('trips.title'))}</h2>
      <button class="btn btn--small" data-trip="add">${esc(t('trips.add'))}</button>
    </div>
    ${
      sorted.length
        ? `<ul class="trip-list">${sorted.map((tr) => row(tr, results)).join('')}</ul>`
        : `<p class="empty">${esc(t('trips.hint'))}</p>`
    }`;
  }

  // ---------- popup ----------

  function formHtml(tr) {
    const v = tr ?? { entry: '', exit: '', note: '' };
    return `<form class="stay-form" novalidate>
      <h2>${esc(t(tr ? 'trips.editTitle' : 'trips.newTitle'))}</h2>
      <label>${esc(t('form.entry'))}<input type="date" name="entry" value="${esc(v.entry)}" required></label>
      <label>${esc(t('trips.exitOptional'))}<input type="date" name="exit" value="${esc(v.exit ?? '')}">
        <span class="hint">${esc(t('trips.exitHint'))}</span></label>
      <label>${esc(t('form.note'))}<input type="text" name="note" maxlength="200" placeholder="${esc(t('trips.notePlaceholder'))}" value="${esc(v.note ?? '')}"></label>
      <p class="form-error" role="alert" hidden></p>
      <div class="actions">
        <button type="button" class="btn btn--ghost" data-trip="cancel">${esc(t('form.cancel'))}</button>
        <button type="submit" class="btn">${esc(t('form.save'))}</button>
      </div>
    </form>`;
  }

  function openForm(id) {
    editingId = id ?? null;
    dialog.innerHTML = formHtml(id ? trips.find((x) => x.id === id) : null);
    dialog.showModal();
  }

  dialog.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const entry = String(f.get('entry') || '');
    const exit = String(f.get('exit') || '');
    const note = String(f.get('note') || '').trim().slice(0, 200);

    const errKey = !entry ? 'err.required' : exit && exit < entry ? 'err.exitBefore' : null;
    if (errKey) {
      const p = dialog.querySelector('.form-error');
      p.textContent = t(errKey);
      p.hidden = false;
      return;
    }

    const existing = editingId && trips.find((x) => x.id === editingId);
    if (existing) Object.assign(existing, { entry, exit, note });
    else trips.push({ id: crypto.randomUUID(), entry, exit, note });
    save();
    dialog.close();
    render();
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-trip="cancel"]')) dialog.close();
  });

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-trip]');
    if (!b) return;
    const action = b.dataset.trip;
    if (action === 'add') return openForm(null);
    const id = b.closest('.trip')?.dataset.id;
    if (action === 'edit') return openForm(id);
    if (action === 'remove') {
      trips = trips.filter((x) => x.id !== id);
      save();
      render();
    }
  });

  render();
  return {
    // Called after every app render (language, stays or date changed).
    refresh: render,
  };
}