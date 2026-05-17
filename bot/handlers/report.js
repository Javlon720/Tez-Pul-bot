'use strict';
import { query } from '../shared/db.js';
import getText from '../locales/index.js';
import { fmt } from '../shared/utils.js';
import { getSession, saveSession } from '../shared/session.js';
import { deletePrevMsg } from '../helpers.js';

export async function handleReport(bot, msg, user) {
  const chatId  = msg.chat.id;
  const lang    = user.lang || 'uz';
  const session = getSession(user.telegram_id) || {};

  const { rows } = await query(
    'SELECT COALESCE(SUM(prize_amount), 0) AS total FROM spin_sessions WHERE user_id = $1',
    [user.telegram_id]
  );

  await deletePrevMsg(bot, chatId, session);
  const sentMsg = await bot.sendMessage(chatId,
    getText(lang, 'report_text', {
      referrals:    fmt(user.total_referrals),
      balance:      fmt(user.balance),
      paid:         fmt(user.paid_amount),
      unpaid:       fmt(user.unpaid_amount),
      spins_used:   fmt(user.spins_used),
      spin_winnings:fmt(rows[0]?.total || 0),
    }),
    { parse_mode: 'HTML' }
  );
  saveSession(user.telegram_id, { ...session, last_message_id: sentMsg.message_id });
}
