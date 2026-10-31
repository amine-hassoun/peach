import { planTrips } from '../lib/trips.js';
import { esc } from '../lib/html.js';

const KEY = 'peach.trips';

export function mountPlanner(el, { getStays, today, t, tn, formatDate, storage = globalThis.localStorage }) {
  el.classList.add('card');
  let trips = [];
  try {
    const v = JSON.parse(storage.getItem(KEY));
    if (Array.isArray(v)) trips = v;
  } catch { /* first run */ }
  trips = trips.filter((x) => !x.exit || x.exit >= today()); // drop finished trips

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
    return `<div class="trip" data-id="${esc(tr.id)}">
      <div class="trip__inputs">
        <label>${esc(t('trips.entry'))}<input type="date" name="entry" value="${esc(tr.entry)}"></label>
        <label>${esc(t('trips.exit'))}<input type="date" name="exit" value="${esc(tr.exit)}" min="${esc(tr.entry)}"></label>
        <button class="btn btn--ghost btn--small" data-trip="remove">${esc(t('trips.remove'))}</button>
      </div>
      <p class="trip__result ${cls}">${esc(tr.entry ? message(r) : t('trips.hint'))}</p>
    </div>`;
  }

  function render() {
    const results = planTrips(getStays(), trips, today());
    el.innerHTML = `<div class="card__head">
      <h2>${esc(t('trips.title'))}</h2>
      <button class="btn btn--small" data-trip="add">${esc(t('trips.add'))}</button>
    </div>
    ${trips.length ? trips.map((tr) => row(tr, results)).join('') : `<p class="muted">${esc(t('trips.hint'))}</p>`}`;
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-trip]');
    if (!b) return;
    if (b.dataset.trip === 'add') {
      trips.push({ id: crypto.randomUUID(), entry: '', exit: '' });
    } else {
      const id = b.closest('.trip').dataset.id;
      trips = trips.filter((x) => x.id !== id);
    }
    save();
    render();
  });

  el.addEventListener('change', (e) => {
    const input = e.target.closest('input[type="date"]');
    if (!input) return;
    const tr = trips.find((x) => x.id === input.closest('.trip').dataset.id);
    if (!tr) return;
    tr[input.name] = input.value;
    save();
    render();
  });

  render();
  return {
    // Called after every app render; skipped while she is typing in the planner.
    refresh() {
      if (!el.contains(document.activeElement)) render();
    },
  };
}