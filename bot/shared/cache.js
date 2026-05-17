'use strict';

const cache = new Map();
const TTL   = 5 * 60 * 1000; // 5 daqiqa

export function getCached(id) {
  const e = cache.get(id);
  if (!e) return null;
  if (Date.now() - e.ts > TTL) { cache.delete(id); return null; }
  return e.data;
}

export function setCached(id, data) {
  cache.set(id, { data, ts: Date.now() });
}

export function invalidate(id) {
  cache.delete(id);
}
