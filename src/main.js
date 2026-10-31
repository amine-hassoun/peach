import './style.css';
import '@fontsource-variable/quicksand';
import '@fontsource-variable/nunito';

import { summarize, toDay, LIMIT } from './lib/schengen.js';
import { upcomingReleases } from './lib/trips.js';
import { localISO } from './lib/today.js';
import { validateStay } from './lib/validate.js';
import { esc } from './lib/html.js';
import { t, tn, setLang, getLang, detectLang, formatDate } from './i18n.js';
import { renderGauge } from './ui/gauge.js';
import { captureTokenFromHash } from './lib/store.js';
import { startPersistence } from './lib/persistence.js';
import { mountPlanner } from './ui/planner.js';
import { registerSW } from './pwa.js';
import './ui/extra.css';
import './ui/scenic.css';

const app = document.getElementById('app');
const dialog = document.getElementById('stay-dialog');
const plannerEl = document.getElementById('planner');
const tripDialog = document.getElementById('trip-dialog');
let planner = null;

// In-memory for now: Step 4 adds localStorage, Step 7 adds sync.
// Each stay: { id, entry, exit | null, note, updatedAt, deleted }
const state = { stays: [], theme: null, undoId: null };
let editingId = null;
let undoTimer = null;

const LOGO = `<svg class="logo" viewBox="0 0 48 48" aria-hidden="true">
  <path d="M24 12c-9 0-16 7-16 15 0 8 6 14 16 14s16-6 16-14c0-8-7-15-16-15z" fill="#FFB4A2"/>
  <path d="M24 12c-5 3-8 8-8 14" stroke="#E5989B" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M24 12c0-5 3-8 8-8-1 5-3 8-8 8z" fill="#7BC4A4"/>
</svg>`;

// ---------- rendering ----------

function heroCard(sum, today) {
  let eyebrow = '';
  let main;
  let hint = '';
  if (sum.used > LIMIT) {
    main = t('hero.over', { n: sum.used - LIMIT });
  } else if (sum.latestLeave === null) {
    main = t('hero.none');
    hint = t('hero.noneHint');
  } else if (sum.left === 0 && sum.presentToday) {
    eyebrow = t('hero.lastDay');
    main = formatDate(sum.latestLeave, 'long');
  } else {
    eyebrow = sum.presentToday ? t('hero.stayUntil') : t('hero.enterToday');
    main = formatDate(sum.latestLeave, 'long');
  }
  const gauge = renderGauge({
    used: sum.used,
    left: sum.left,
    label: tn('gauge.left', sum.left),
    aria: t('gauge.aria', { used: sum.used }),
  });
  return `<section class="card hero">
    <div class="hero__top">
      <div class="hero__gauge">${gauge}</div>
      <div class="hero__text">
        ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
        <p class="hero__main">${esc(main)}</p>
        ${hint ? `<p class="muted">${esc(hint)}</p>` : ''}
      </div>
    </div>
    ${checkinBlock()}
    ${releaseBlock(today)}
  </section>`;
}

function stayRow(s, today) {
  const start = toDay(s.entry);
  const end = s.exit ? toDay(s.exit) : toDay(today);
  const days = Math.max(0, end - start + 1);
  const range = `${formatDate(s.entry, 'medium')} – ${s.exit ? formatDate(s.exit, 'medium') : t('stays.ongoing')}`;
  const note = s.note ? ` · ${esc(s.note)}` : '';
  return `<li class="stay">
    <div class="stay__main">
      <p class="stay__range">${esc(range)}</p>
      <p class="muted">${esc(tn('stays.days', days))}${note}</p>
    </div>
    <div class="stay__actions">
      <button class="btn btn--ghost btn--small" data-action="edit" data-id="${esc(s.id)}">${t('stays.edit')}</button>
      <button class="btn btn--ghost btn--small" data-action="delete" data-id="${esc(s.id)}">${t('stays.delete')}</button>
    </div>
  </li>`;
}

// One-tap check-in: arriving opens a stay today, leaving closes the open one.
function checkinBlock() {
  const open = state.stays.filter((s) => !s.deleted && !s.exit);
  if (!open.length) {
    return `<div class="hero__checkin">
      <button class="btn" data-action="arrive">${esc(t('checkin.arrive'))}</button>
    </div>`;
  }
  const since = open.map((s) => s.entry).sort()[0];
  return `<div class="hero__checkin">
    <p class="muted">${esc(t('checkin.since', { date: formatDate(since, 'medium') }))}</p>
    <button class="btn" data-action="leave">${esc(t('checkin.leave'))}</button>
  </div>`;
}

// When the next days leave the 180-day window, and how many come back (assuming no new stays).
function releaseBlock(today) {
  const runs = upcomingReleases(state.stays, today, 3);
  if (!runs.length) return '';
  const items = runs
    .map((r) => {
      const when = r.from === r.to
        ? formatDate(r.from, 'long')
        : `${formatDate(r.from, 'medium')} – ${formatDate(r.to, 'medium')}`;
      return `<li><span>${esc(when)}</span><strong>+${esc(tn('stays.days', r.days))}</strong></li>`;
    })
    .join('');
  return `<div class="hero__next">
    <p class="hero__next-title">${t('rollover.title')}</p>
    <p class="muted">${t('rollover.note')}</p>
    <ul class="release-list">${items}</ul>
  </div>`;
}

function staysCard(today) {
  const visible = state.stays
    .filter((s) => !s.deleted)
    .sort((a, b) => b.entry.localeCompare(a.entry));
  const body = visible.length
    ? `<ul class="stay-list">${visible.map((s) => stayRow(s, today)).join('')}</ul>`
    : `<p class="empty">${t('stays.empty')}</p>`;
  return `<section class="card">
    <div class="card__head">
      <h2>${t('stays.title')}</h2>
      <button class="btn btn--small" data-action="add">+ ${t('stays.add')}</button>
    </div>
    ${body}
  </section>`;
}

let persistence = null;

function showFatal(err) {
  app.innerHTML = `<div class="card">
    <h2>Something went wrong</h2>
    <pre id="fatal" style="white-space:pre-wrap;font-size:12px"></pre>
    <button class="btn" id="reset-local">Reset local data</button>
  </div>`;
  document.getElementById('fatal').textContent = String(err?.stack || err);
  document.getElementById('reset-local').onclick = () => {
    localStorage.clear();
    location.reload();
  };
}

function render() {
  try {
    renderApp();
  } catch (e) {
    console.error(e);
    showFatal(e);
  }
}

window.addEventListener('error', (e) => showFatal(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showFatal(e.reason));

function renderApp() {
  persistence?.changed();
  const today = localISO();
  const sum = summarize(state.stays, today);
  document.title = `${t('app.name')} 🍑`;
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        ${LOGO}
        <div><h1>${t('app.name')}</h1><p class="muted">${t('app.tagline')}</p></div>
      </div>
      <div class="topbar__actions">
        <button class="btn btn--ghost btn--small" data-action="toggle-lang">${t('lang.switchTo')}</button>
        <button class="btn btn--ghost btn--small" data-action="toggle-theme" aria-label="${esc(t('theme.toggle'))}">◐</button>
      </div>
    </header>
    <main>
      ${heroCard(sum, today)}
      <div id="planner-slot"></div>
      ${staysCard(today)}
    </main>
    ${
      state.undoId
        ? `<div class="toast" role="status"><span>${t('stays.deleted')}</span>
           <button class="btn btn--ghost btn--small" data-action="undo">${t('stays.undo')}</button></div>`
        : ''
    }`;
  const slot = document.getElementById('planner-slot');
  if (slot && plannerEl) slot.replaceWith(plannerEl);
    planner?.refresh();
}

// ---------- add / edit form ----------

function formHtml(stay) {
  const v = stay ?? { entry: '', exit: '', note: '' };
  const open = stay ? stay.exit === null : false;
  return `<form class="stay-form" novalidate>
    <h2>${t(stay ? 'form.editTitle' : 'form.addTitle')}</h2>
    <label>${t('form.entry')}<input type="date" name="entry" value="${esc(v.entry)}" required></label>
    <label class="check"><input type="checkbox" name="ongoing" ${open ? 'checked' : ''}> ${t('form.stillThere')}</label>
    <label>${t('form.exit')}<input type="date" name="exit" value="${esc(v.exit ?? '')}" ${open ? 'disabled' : ''}></label>
    <label>${t('form.note')}<input type="text" name="note" maxlength="200" placeholder="${esc(t('form.notePlaceholder'))}" value="${esc(v.note)}"></label>
    <p class="form-error" role="alert" hidden></p>
    <div class="actions">
      <button type="button" class="btn btn--ghost" data-action="close-form">${t('form.cancel')}</button>
      <button type="submit" class="btn">${t('form.save')}</button>
    </div>
  </form>`;
}

function openForm(id) {
  editingId = id ?? null;
  const stay = id ? state.stays.find((s) => s.id === id) : null;
  dialog.innerHTML = formHtml(stay);
  dialog.showModal();
}

dialog.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const ongoing = f.get('ongoing') === 'on';
  const entry = String(f.get('entry') || '');
  const exit = ongoing ? null : String(f.get('exit') || '');
  const note = String(f.get('note') || '').trim().slice(0, 200);

  const errKey = validateStay({ entry, exit, ongoing }, localISO());
  if (errKey) {
    const p = dialog.querySelector('.form-error');
    p.textContent = t(errKey);
    p.hidden = false;
    return;
  }

  const now = new Date().toISOString();
  if (editingId) {
    Object.assign(state.stays.find((s) => s.id === editingId), { entry, exit, note, updatedAt: now });
  } else {
    state.stays.push({ id: crypto.randomUUID(), entry, exit, note, updatedAt: now, deleted: false });
  }
  dialog.close();
  render();
});

dialog.addEventListener('change', (e) => {
  if (e.target.name === 'ongoing') dialog.querySelector('[name="exit"]').disabled = e.target.checked;
});

// Click on the dim backdrop (the <dialog> element itself) closes the form.
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

// ---------- actions ----------

function arrive() {
  state.stays.push({
    id: crypto.randomUUID(),
    entry: localISO(),
    exit: null,
    note: '',
    updatedAt: new Date().toISOString(),
    deleted: false,
  });
  render();
}

function leave() {
  const today = localISO();
  const now = new Date().toISOString();
  for (const s of state.stays) {
    if (s.deleted || s.exit) continue;
    Object.assign(s, { exit: today < s.entry ? s.entry : today, updatedAt: now });
  }
  render();
}

function deleteStay(id) {
  const s = state.stays.find((x) => x.id === id);
  if (!s) return;
  s.deleted = true; // tombstone, not removal: Step 7's sync merge needs it
  s.updatedAt = new Date().toISOString();
  state.undoId = id;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    state.undoId = null;
    render();
  }, 6000);
  render();
}

function undoDelete() {
  const s = state.stays.find((x) => x.id === state.undoId);
  if (s) {
    s.deleted = false;
    s.updatedAt = new Date().toISOString();
  }
  state.undoId = null;
  clearTimeout(undoTimer);
  render();
}

function toggleTheme() {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = (state.theme ?? (systemDark ? 'dark' : 'light')) === 'dark';
  state.theme = isDark ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  syncScenic();
}

// The peach scenery is for light mode on wide screens only (see ui/scenic.css).
function syncScenic() {
  const wide = window.matchMedia('(min-width: 1100px)').matches;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = (state.theme ?? (systemDark ? 'dark' : 'light')) === 'dark';
  document.documentElement.classList.toggle('scenic', wide && !dark);
}

function toggleLang() {
  setLang(getLang() === 'en' ? 'ka' : 'en');
  render();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;
  if (action === 'add') openForm(null);
  else if (action === 'edit') openForm(id);
  else if (action === 'delete') deleteStay(id);
  else if (action === 'undo') undoDelete();
  else if (action === 'arrive') arrive();
  else if (action === 'leave') leave();
  else if (action === 'toggle-theme') toggleTheme();
  else if (action === 'toggle-lang') toggleLang();
  else if (action === 'close-form') dialog.close();
});

// Reopening the tab on a new day must not keep showing yesterday's numbers.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});

captureTokenFromHash(); // before any rendering

persistence = startPersistence({
  getStays: () => state.stays,
  setStays: (s) => { state.stays = s; render(); },
});
planner = mountPlanner(plannerEl, {
  getStays: () => state.stays, today: localISO, t, tn, formatDate, dialog: tripDialog,
});
registerSW();

window.addEventListener('resize', syncScenic);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncScenic);
syncScenic();

setLang(detectLang());
render();