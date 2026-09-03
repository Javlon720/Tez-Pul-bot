'use strict';

import type { Numeric, UserRow } from '../types.js';

interface CacheEntry {
  data: UserRow;
  ts: number;
}

const cache = new Map<Numeric, CacheEntry>();
const TTL   = 5 * 60 * 1000; // 5 daqiqa

export function getCached(id: Numeric): UserRow | null {
  const e = cache.get(id);
  if (!e) return null;
  if (Date.now() - e.ts > TTL) { cache.delete(id); return null; }
  return e.data;
}

export function setCached(id: Numeric, data: UserRow): void {
  cache.set(id, { data, ts: Date.now() });
}

export function invalidate(id: Numeric): void {
  cache.delete(id);
}
