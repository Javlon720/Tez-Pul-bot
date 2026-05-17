'use strict';
import { query, transaction } from '../shared/db.js';
import { invalidateUser } from './userService.js';
import { getBonusDirect } from './settingsService.js';
import getText from '../locales/index.js';
import { fmt } from '../shared/utils.js';

// Vaqtinchalik kutayotgan referallar (userId → referrerId)
const pending = new Map();

export function storePending(userId, referrerId) {
  pending.set(userId, referrerId);
  setTimeout(() => pending.delete(userId), 60 * 60 * 1000); // 1 soatdan keyin o'chadi
}

export async function processReferral(bot, userId) {
  const referrerId = pending.get(userId);
  if (!referrerId) return;
  pending.delete(userId);

  const bonus = await getBonusDirect();

  try {
    const { rows: refRows } = await query(
      'SELECT telegram_id, lang, balance FROM users WHERE telegram_id = $1 AND NOT is_blocked',
      [referrerId]
    );
    if (!refRows.length) return;

    let processed = false;
    await transaction(async (client) => {
      const existing = await client.query(
        'SELECT id FROM referrals WHERE referrer_id = $1 AND referred_id = $2',
        [referrerId, userId]
      );
      if (existing.rows.length) return;

      await client.query(
        'UPDATE users SET referred_by = $1 WHERE telegram_id = $2 AND referred_by IS NULL',
        [referrerId, userId]
      );
      await client.query(
        `INSERT INTO referrals (referrer_id, referred_id, bonus_amount)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [referrerId, userId, bonus]
      );
      await client.query(
        `UPDATE users SET balance = balance + $1, unpaid_amount = unpaid_amount + $1,
                          total_referrals = total_referrals + 1
         WHERE telegram_id = $2`,
        [bonus, referrerId]
      );
      await client.query(
        `INSERT INTO payments (user_id, amount, status, note) VALUES ($1, $2, 'pending', 'referral')`,
        [referrerId, bonus]
      );
      processed = true;
    });

    if (!processed) return;
    invalidateUser(referrerId);

    const [updRef, newUser] = await Promise.all([
      query('SELECT balance, lang FROM users WHERE telegram_id = $1', [referrerId]),
      query('SELECT first_name FROM users WHERE telegram_id = $1', [userId]),
    ]);

    if (updRef.rows.length) {
      const r = updRef.rows[0];
      bot.sendMessage(referrerId, getText(r.lang || 'uz', 'referral_notify', {
        name:    newUser.rows[0]?.first_name || 'User',
        bonus:   fmt(bonus),
        balance: fmt(r.balance),
      })).catch(() => {});
    }
  } catch (err) {
    console.error('[Referral] Xato:', err.message);
  }
}
