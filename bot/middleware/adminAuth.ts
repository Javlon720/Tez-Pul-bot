'use strict';

const ADMIN_IDS = new Set<number>(
  (process.env.ADMIN_IDS || '')
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(id => Boolean(id) && !Number.isNaN(id))
);

export function isAdmin(userId: number): boolean {
  return ADMIN_IDS.has(userId);
}
