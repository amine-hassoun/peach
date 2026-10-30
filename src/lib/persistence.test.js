// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { startPersistence } from './persistence.js';
import { setToken, load } from './store.js';

const TOKEN = 'ab12'.repeat(16);
const stay = (id, updatedAt = 1) => ({ id, entry: '2026-01-01', exit: '2026-01-05', note: '', updatedAt, deleted: false });
const res = (status, data) => ({ status, json: async () => data });

function fakeServer(token = TOKEN) {
  const srv = { item: null, calls: [] };
  srv.fetchImpl = async (_url, init = {}) => {
    srv.calls.push(init.method);
    if (init.headers['x-peach-token'] !== token) return res(401, {});
    if (init.method === 'GET') return srv.item ? res(200, srv.item) : res(404, {});
    const b = JSON.parse(init.body);
    const ok = srv.item ? b.baseVersion === srv.item.version : b.baseVersion === null;
    if (!ok) return res(409, srv.item ?? { version: null, stays: [] });
    srv.item = { version: (srv.item?.version ?? 0) + 1, stays: b.stays };
    return res(200, { version: srv.item.version });
  };
  return srv;
}

function setup(srv, { online = true } = {}) {
  const app = { stays: [] };
  const win = { navigator: { onLine: online }, addEventListener() {} };
  const p = startPersistence({
    getStays: () => app.stays,
    setStays: (s) => { app.stays = s; },
    fetchImpl: srv.fetchImpl,
    win,
    debounceMs: 0,
  });
  return { app, p, win };
}

beforeEach(() => localStorage.clear());

describe('persistence', () => {
  it('reports nolink without a token and makes no requests', async () => {
    const srv = fakeServer();
    const { p } = setup(srv);
    await p.syncNow();
    expect(p.status()).toBe('nolink');
    expect(srv.calls).toEqual([]);
  });

  it('pushes a local change and stores the version', async () => {
    setToken(TOKEN);
    const srv = fakeServer();
    const { app, p } = setup(srv);
    await p.syncNow();
    app.stays = [stay('a')];
    p.changed();
    await p.syncNow();
    expect(srv.item.stays.map((s) => s.id)).toEqual(['a']);
    expect(load().version).toBe(1);
    expect(load().dirty).toBe(false);
    expect(p.status()).toBe('synced');
  });

  it('persists to localStorage immediately, before any sync', () => {
    const srv = fakeServer();
    const { app, p } = setup(srv);
    app.stays = [stay('a')];
    p.changed();
    expect(load().stays).toHaveLength(1);
    expect(load().dirty).toBe(true);
  });

  it('resolves a 409 by merging then retrying', async () => {
    setToken(TOKEN);
    const srv = fakeServer();
    srv.item = { version: 4, stays: [stay('remote', 2)] };
    const { app, p } = setup(srv);
    await p.syncNow(); // pulls remote
    app.stays = [...app.stays, stay('local', 3)];
    p.changed();
    srv.item = { version: 5, stays: [...srv.item.stays, stay('other-device', 4)] }; // another device pushed first
    await p.syncNow();
    expect(srv.item.stays.map((s) => s.id).sort()).toEqual(['local', 'other-device', 'remote']);
    expect(app.stays.map((s) => s.id).sort()).toEqual(['local', 'other-device', 'remote']);
    expect(p.status()).toBe('synced');
  });

  it('pulls remote changes when local is clean', async () => {
    setToken(TOKEN);
    const srv = fakeServer();
    srv.item = { version: 2, stays: [stay('x')] };
    const { app, p } = setup(srv);
    await p.syncNow();
    expect(app.stays.map((s) => s.id)).toEqual(['x']);
  });

  it('keeps data and shows offline when the network is down', async () => {
    setToken(TOKEN);
    const srv = fakeServer();
    const { app, p } = setup(srv, { online: false });
    app.stays = [stay('a')];
    p.changed();
    await p.syncNow();
    expect(p.status()).toBe('offline');
    expect(load().dirty).toBe(true);
    expect(srv.calls).toEqual([]);
  });

  it('marks error (data kept) when fetch throws while online', async () => {
    setToken(TOKEN);
    const app = { stays: [] };
    const p = startPersistence({ getStays: () => app.stays, setStays: (s) => (app.stays = s), fetchImpl: async () => { throw new Error('net'); }, win: { navigator: { onLine: true }, addEventListener() {} }, debounceMs: 0 });
    app.stays = [stay('a')];
    p.changed();
    await p.syncNow();
    expect(p.status()).toBe('error');
    expect(load().stays).toHaveLength(1);
  });

  it('reports unauthorized on a wrong token', async () => {
    setToken('z'.repeat(32));
    const { p } = setup(fakeServer());
    await p.syncNow();
    expect(p.status()).toBe('unauthorized');
  });

  it('setLink accepts a full link, rejects junk', async () => {
    const srv = fakeServer();
    const { p } = setup(srv);
    expect(p.setLink('nonsense')).toBe(false);
    expect(p.setLink(`https://x.on.aws/#k=${TOKEN}`)).toBe(true);
    await p.syncNow();
    expect(p.hasLink()).toBe(true);
    expect(p.getLink('https://x.on.aws')).toBe(`https://x.on.aws/#k=${TOKEN}`);
  });

  it('import merges into existing stays and marks dirty', async () => {
    setToken(TOKEN);
    const srv = fakeServer();
    const { app, p } = setup(srv);
    app.stays = [stay('a')];
    p.changed();
    await p.syncNow();
    const n = p.importJSON(JSON.stringify([{ id: 'b', entry: '2026-03-01', exit: '2026-03-05', updatedAt: 9 }]));
    await p.syncNow();
    expect(n).toBe(1);
    expect(srv.item.stays.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });
});
