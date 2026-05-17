'use strict';

const ADMIN_IDS = new Set(
  (process.env.ADMIN_IDS || '').split(',').map(s => parseInt(s.trim())).filter(Boolean)
);

export function isAdmin(userId) {
  return ADMIN_IDS.has(userId);
}
