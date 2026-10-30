// Union by id; the newer updatedAt wins; ties go to the local copy.
// Tombstones (deleted: true) are kept so a delete on one device reaches the others,
// then pruned once they are old enough that no device can still be holding the stay.
const ts = (v) => (typeof v === 'number' ? v : Date.parse(v) || 0);
const TOMBSTONE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function mergeStays(local, remote, now = Date.now()) {
  const byId = new Map();
  for (const s of remote) byId.set(s.id, s);
  for (const s of local) {
    const cur = byId.get(s.id);
    if (!cur || ts(s.updatedAt) >= ts(cur.updatedAt)) byId.set(s.id, s);
  }
  return [...byId.values()].filter((s) => !(s.deleted && now - ts(s.updatedAt) > TOMBSTONE_TTL_MS));
}
