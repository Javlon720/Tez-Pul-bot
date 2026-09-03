'use strict';

import type { Numeric, UserRow } from '../types.js';

interface CacheEntry {
  data: UserRow;
  ts: number;
}

const cache = new Map<Numeric, CacheEntry>();
const TTL = 5 * 60 * 1000; // 5 min

function getCached(telegramId: Numeric): UserRow | null {
  const entry = cache.get(telegramId);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) { cache.delete(telegramId); return null; }
  return entry.data;
}

function setCached(telegramId: Numeric, data: UserRow): void {
  cache.set(telegramId, { data, ts: Date.now() });
}

function invalidate(telegramId: Numeric): void {
  cache.delete(telegramId);
}

export { getCached, setCached, invalidate };
