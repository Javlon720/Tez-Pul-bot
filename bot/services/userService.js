'use strict';
import { query } from '../shared/db.js';
import { getCached, setCached, invalidate } from '../shared/cache.js';

export async function getUser(telegramId) {
  const cached = getCached(telegramId);
  if (cached) return cached;
  const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  if (!rows.length) return null;
  setCached(telegramId, rows[0]);
  return rows[0];
}

export async function getFreshUser(telegramId) {
  const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return rows[0] || null;
}

export async function upsertUser(telegramId, from) {
  const { rows } = await query(
    `INSERT INTO users (telegram_id, username, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id) DO UPDATE SET
       username    = EXCLUDED.username,
       first_name  = EXCLUDED.first_name,
       last_name   = EXCLUDED.last_name,
       last_active = NOW()
     RETURNING *`,
    [telegramId, from.username || null, from.first_name || 'User', from.last_name || null]
  );
  setCached(telegramId, rows[0]);
  return rows[0];
}

export function invalidateUser(telegramId) {
  invalidate(telegramId);
}

export function touchActive(telegramId) {
  query('UPDATE users SET last_active = NOW() WHERE telegram_id = $1', [telegramId]).catch(() => {});
}
