// Local persistence: one versioned JSON blob in localStorage. The sync token lives under
// its own key so it can never end up inside an export file.
export const SCHEMA = 1;
export const MAX_STAYS = 500;
const KEY = 'peach.v1';
const TOKEN_KEY = 'peach.token';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const emptyState = () => ({ schema: SCHEMA, stays: [], version: null, dirty: false });

const ls = () => globalThis.localStorage;

export function load(storage = ls()) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptyState();
    const s = JSON.parse(raw);
    if (s.schema !== SCHEMA || !Array.isArray(s.stays)) return emptyState(); // migration hook for future schemas
    return { ...emptyState(), ...s };
  } catch {
    return emptyState();
  }
}

export function save(state, storage = ls()) {
  try {
    storage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // quota or private mode: the app keeps working in memory
  }
}

export const getToken = (storage = ls()) => storage.getItem(TOKEN_KEY);
export const setToken = (token, storage = ls()) => storage.setItem(TOKEN_KEY, token);

// Accepts the full personal link or the bare token.
export function extractToken(text) {
  const s = String(text ?? '').trim();
  const m = s.match(/[#&?]k=([A-Za-z0-9_-]{16,128})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{16,128}$/.test(s) ? s : null;
}

// The token rides in the URL fragment, which browsers never send to a server.
// Store it, then strip it from the address bar.
export function captureTokenFromHash(loc = globalThis.location, hist = globalThis.history, storage = ls()) {
  const token = extractToken(loc.hash);
  if (!token) return false;
  setToken(token, storage);
  hist.replaceState(null, '', loc.pathname + loc.search);
  return true;
}

const isRealDate = (s) =>
  typeof s === 'string' && ISO.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

export function normalizeStay(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') throw new Error('Stay must be an object');
  if (!isRealDate(raw.entry)) throw new Error('Invalid entry date');
  const exit = raw.exit ?? null;
  if (exit !== null && !isRealDate(exit)) throw new Error('Invalid exit date');
  if (exit !== null && exit < raw.entry) throw new Error('Exit is before entry');
  const note = typeof raw.note === 'string' ? raw.note.slice(0, 200) : '';
  const id = typeof raw.id === 'string' && raw.id && raw.id.length <= 64 ? raw.id : newId();
  const updatedAt = typeof raw.updatedAt === 'number' || typeof raw.updatedAt === 'string' ? raw.updatedAt : now;
  return { id, entry: raw.entry, exit, note, updatedAt, deleted: Boolean(raw.deleted) };
}

export function exportJSON(stays) {
  return JSON.stringify(
    { app: 'peach', schema: SCHEMA, exportedAt: new Date().toISOString(), stays: stays.filter((s) => !s.deleted) },
    null,
    2,
  );
}

export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file');
  }
  const list = Array.isArray(data) ? data : data?.stays;
  if (!Array.isArray(list)) throw new Error('No stays found in file');
  if (list.length > MAX_STAYS) throw new Error(`Too many stays (max ${MAX_STAYS})`);
  return list.map((s) => normalizeStay(s));
}
