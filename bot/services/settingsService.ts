'use strict';
import { query } from '../shared/db.js';
import { toInt } from '../shared/utils.js';
import type { SettingKey, SettingRow } from '../types.js';

export const SETTING_KEYS: readonly SettingKey[] = ['min_payout', 'bonus_direct', 'spin_multiply'];

export function isSettingKey(value: string): value is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(value);
}

export async function getSetting(key: string, def = ''): Promise<string> {
  const { rows } = await query<Pick<SettingRow, 'value'>>('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0]?.value ?? def;
}

export async function setSetting(key: string, value: string | number): Promise<void> {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)]
  );
}

export async function getMinPayout():   Promise<number> { return toInt(await getSetting('min_payout',    '5000'), 5000); }
export async function getBonusDirect(): Promise<number> { return toInt(await getSetting('bonus_direct',  '1000'), 1000); }
export async function getSpinMinBet():  Promise<number> { return toInt(await getSetting('spin_min_bet',  '1000'), 1000); }
export async function getSpinMultiply(): Promise<number> { return toInt(await getSetting('spin_multiply', '2'), 2); }
