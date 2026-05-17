'use strict';
import { query } from '../shared/db.js';

export async function getSetting(key, def = '') {
  const { rows } = await query('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0]?.value ?? def;
}

export async function setSetting(key, value) {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)]
  );
}

export async function getMinPayout()   { return parseInt(await getSetting('min_payout',    '5000')); }
export async function getBonusDirect() { return parseInt(await getSetting('bonus_direct',  '1000')); }
export async function getSpinMinBet()  { return parseInt(await getSetting('spin_min_bet',  '1000')); }
export async function getSpinMultiply(){ return parseInt(await getSetting('spin_multiply',  '2'));   }
