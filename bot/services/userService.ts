'use strict';
import { query } from '../shared/db.js';
import { getCached, setCached, invalidate } from '../shared/cache.js';
import type { Numeric, TelegramUser, UserRow } from '../types.js';

export async function getUser(telegramId: number): Promise<UserRow | null> {
  const cached = getCached(telegramId);
  if (cached) return cached;
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  const user = rows[0];
  if (!user) return null;
  setCached(telegramId, user);
  return user;
}

export async function getFreshUser(telegramId: number): Promise<UserRow | null> {
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return rows[0] ?? null;
}

export async function upsertUser(telegramId: number, from: TelegramUser): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
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
  const user = rows[0];
  if (!user) return null;
  setCached(telegramId, user);
  return user;
}

export function invalidateUser(telegramId: Numeric): void {
  invalidate(telegramId);
}

export function touchActive(telegramId: number): void {
  query('UPDATE users SET last_active = NOW() WHERE telegram_id = $1', [telegramId]).catch(() => {});
}
