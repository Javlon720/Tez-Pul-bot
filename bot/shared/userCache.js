'use strict';

const cache = new Map();
const TTL = 5 * 60 * 1000; // 5 min

function getCached(telegramId) {
  const entry = cache.get(telegramId);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) { cache.delete(telegramId); return null; }
  return entry.data;
}

function setCached(telegramId, data) {
  cache.set(telegramId, { data, ts: Date.now() });
}

function invalidate(telegramId) {
  cache.delete(telegramId);
}

export { getCached, setCached, invalidate };
