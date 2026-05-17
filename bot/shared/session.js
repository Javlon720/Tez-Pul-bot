'use strict';

const store = new Map();
const TTL   = 30 * 60 * 1000; // 30 daqiqa

export function getSession(id) {
  const e = store.get(id);
  if (!e) return null;
  if (Date.now() - e.ts > TTL) { store.delete(id); return null; }
  return e.data;
}

export function saveSession(id, data) {
  store.set(id, { data, ts: Date.now() });
}

export function clearSession(id) {
  store.delete(id);
}

// Har 10 daqiqada eskiganlarini tozala
setInterval(() => {
  const now = Date.now();
  for (const [id, e] of store) {
    if (now - e.ts > TTL) store.delete(id);
  }
}, 10 * 60 * 1000);
