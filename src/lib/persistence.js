// Offline-first persistence + sync for the single-user backend.
// The app edits in memory; this module mirrors to localStorage and syncs to /api/stays.
// Wiring: call persistence.changed() at the top of render().
import { load, save, getToken, setToken, extractToken, exportJSON, parseImport } from './store.js';
import { mergeStays } from './merge.js';

const API = '/api/stays';

export function startPersistence({
  getStays,
  setStays,
  storage = globalThis.localStorage,
  fetchImpl = (...args) => globalThis.fetch(...args),
  win = globalThis.window,
  debounceMs = 800,
} = {}) {
  const state = load(storage);
  let last = JSON.stringify(state.stays);
  let timer = null;
  let busy = false;
  let again = false;
  let status = 'idle';
  const listeners = new Set();

  const setStatus = (s) => {
    status = s;
    listeners.forEach((fn) => fn(s));
  };
  const copy = (stays) => JSON.parse(JSON.stringify(stays));

  // Replace local stays without marking them dirty.
  function apply(stays) {
    state.stays = copy(stays);
    last = JSON.stringify(state.stays);
    save(state, storage);
    setStays(copy(state.stays));
  }

  function changed() {
    const ser = JSON.stringify(getStays());
    if (ser === last) return;
    last = ser;
    state.stays = JSON.parse(ser);
    state.dirty = true;
    save(state, storage);
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(syncNow, debounceMs);
  }

  async function request(method, body) {
    const token = getToken(storage);
    const res = await fetchImpl(API, {
      method,
      headers: {
        ...(token ? { 'x-peach-token': token } : {}), // open access: no token needed
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, data };
  }

  async function run() {
    if (win?.navigator?.onLine === false) return setStatus('offline');
    setStatus('syncing');
    try {
      for (let i = 0; i < 4; i++) {
        const dirty = state.dirty || (state.version === null && state.stays.length > 0);
        if (!dirty) {
          const r = await request('GET');
          if (r.status === 401) return setStatus('unauthorized');
          if (r.status === 404) {
            state.version = null;
            save(state, storage);
            return setStatus('synced');
          }
          if (r.status !== 200) throw new Error(`GET ${r.status}`);
          if (r.data.version !== state.version) {
            state.version = r.data.version;
            apply(r.data.stays);
          }
          return setStatus('synced');
        }
        const sent = JSON.stringify(state.stays);
        const r = await request('PUT', { baseVersion: state.version, stays: state.stays });
        if (r.status === 401) return setStatus('unauthorized');
        if (r.status === 200) {
          state.version = r.data.version;
          state.dirty = JSON.stringify(state.stays) !== sent; // edited while the request was in flight
          save(state, storage);
          if (!state.dirty) return setStatus('synced');
          continue;
        }
        if (r.status === 409) {
          state.version = r.data.version ?? null;
          state.dirty = true;
          apply(mergeStays(state.stays, r.data.stays ?? []));
          continue;
        }
        throw new Error(`PUT ${r.status}`);
      }
      setStatus('error');
    } catch {
      setStatus(win?.navigator?.onLine === false ? 'offline' : 'error');
    }
  }

  // Callers can await this: if a run is in flight, they wait for it (and the re-run it queues).
  let current = Promise.resolve();
  function syncNow() {
    if (busy) {
      again = true;
      return current;
    }
    busy = true;
    current = (async () => {
      try {
        do {
          again = false;
          await run();
        } while (again);
      } finally {
        busy = false;
      }
    })();
    return current;
  }

  win?.addEventListener?.('online', syncNow);
  win?.document?.addEventListener?.('visibilitychange', () => {
    if (win.document.visibilityState === 'visible') syncNow();
  });

  if (state.stays.length) setStays(copy(state.stays));
  syncNow();

  return {
    changed,
    syncNow,
    status: () => status,
    subscribe(fn) {
      listeners.add(fn);
      fn(status);
      return () => listeners.delete(fn);
    },
    hasLink: () => Boolean(getToken(storage)),
    getLink: (origin) => (getToken(storage) ? `${origin}/#k=${getToken(storage)}` : null),
    setLink(text) {
      const token = extractToken(text);
      if (!token) return false;
      setToken(token, storage);
      state.version = null;
      syncNow();
      return true;
    },
    exportJSON: () => exportJSON(state.stays),
    importJSON(text) {
      const imported = parseImport(text);
      apply(mergeStays(state.stays, imported));
      state.dirty = true;
      save(state, storage);
      schedule();
      return imported.length;
    },
  };
}