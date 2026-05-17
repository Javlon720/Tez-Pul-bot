'use strict';

import { query, transaction } from '../shared/db.js';
import getText from '../locales/index.js';
import { formatNumber, timeAgo, chunk } from '../shared/utils.js';
import { getSession, saveSession, clearSession } from '../shared/session.js';
import { getMinPayout, setSetting } from '../services/settingsService.js';
import { invalidateUser } from '../services/userService.js';
import logger from '../shared/logger.js';

// ─── Show main admin menu ──────────────────────────────────────────────────
export async function handleAdminMenu(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  await bot.sendMessage(chatId, getText('uz', 'admin_menu'), {
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [
        [{ text: '📊 Statistika' }, { text: '👥 Foydalanuvchilar' }],
        [{ text: '💰 Bonus Yuborish' }, { text: '📢 Xabar Yuborish' }],
        [{ text: '📡 Kanallar' }, { text: '⚙️ Min. To\'lov' }],
      ],
      resize_keyboard: true,
    },
  });
  clearSession(userId);
}

// ─── Stats ─────────────────────────────────────────────────────────────────
export async function handleAdminStats(bot, msg) {
  const chatId = msg.chat.id;

  const [totalRes, activeRes, todayRes, balRes, paidRes] = await Promise.all([
    query('SELECT COUNT(*) AS c FROM users'),
    query('SELECT COUNT(*) AS c FROM users WHERE last_active > NOW() - INTERVAL \'24 hours\''),
    query('SELECT COUNT(*) AS c FROM users WHERE created_at > NOW() - INTERVAL \'24 hours\''),
    query('SELECT COALESCE(SUM(balance), 0) AS s FROM users'),
    query('SELECT COALESCE(SUM(paid_amount), 0) AS s FROM users'),
  ]);

  await bot.sendMessage(chatId,
    `📊 <b>Umumiy Statistika</b>\n\n` +
    `👥 Jami foydalanuvchilar: <b>${totalRes.rows[0].c}</b>\n` +
    `🟢 Faol (24s): <b>${activeRes.rows[0].c}</b>\n` +
    `📅 Bugun yangi: <b>${todayRes.rows[0].c}</b>\n\n` +
    `💰 Jami balanslar: <b>${formatNumber(balRes.rows[0].s)} so'm</b>\n` +
    `✅ To'langan: <b>${formatNumber(paidRes.rows[0].s)} so'm</b>`,
    { parse_mode: 'HTML' }
  );
}

// ─── Bonus: step 1 – ask who ───────────────────────────────────────────────
export async function handleAdminBonusStart(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const sentMsg = await bot.sendMessage(chatId,
    '💰 <b>Bonus Yuborish</b>\n\nFoydalanuvchi ID (raqam) yoki @username kiriting:',
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] },
    }
  );
  saveSession(userId, { current_state: 'ADMIN_BONUS_TARGET', last_message_id: sentMsg.message_id });
}

export async function handleAdminBonusTargetInput(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text   = msg.text?.trim();

  let targetRes;
  if (/^\d+$/.test(text)) {
    targetRes = await query('SELECT * FROM users WHERE telegram_id = $1', [parseInt(text)]);
  } else if (text.startsWith('@')) {
    targetRes = await query('SELECT * FROM users WHERE username = $1', [text.slice(1)]);
  } else {
    await bot.sendMessage(chatId, '❌ ID (raqam) yoki @username kiriting.');
    return;
  }

  if (!targetRes.rows.length) {
    await bot.sendMessage(chatId, getText('uz', 'bonus_not_found'));
    return;
  }

  const target   = targetRes.rows[0];
  const sentMsg  = await bot.sendMessage(chatId,
    getText('uz', 'bonus_amount', { user: target.first_name + (target.username ? ` @${target.username}` : '') }),
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] },
    }
  );

  const session = getSession(userId) || {};
  saveSession(userId, {
    ...session,
    current_state:   'ADMIN_BONUS_AMOUNT',
    last_message_id: sentMsg.message_id,
    state_data:      { target_id: target.telegram_id, target_name: target.first_name },
  });
}

export async function handleAdminBonusAmountInput(bot, msg) {
  const chatId  = msg.chat.id;
  const userId  = msg.from.id;
  const session = getSession(userId) || {};
  const amount  = parseInt(msg.text?.trim(), 10);

  if (isNaN(amount) || amount <= 0) {
    await bot.sendMessage(chatId, getText('uz', 'bonus_invalid'));
    return;
  }

  const targetId   = session.state_data?.target_id;
  const targetName = session.state_data?.target_name || 'User';
  if (!targetId) { await bot.sendMessage(chatId, '❌ Xato. Qaytadan boshlang.'); clearSession(userId); return; }

  await query(
    'UPDATE users SET balance = balance + $1, unpaid_amount = unpaid_amount + $1 WHERE telegram_id = $2',
    [amount, targetId]
  );
  await query(
    `INSERT INTO payments (user_id, amount, status, note) VALUES ($1, $2, 'completed', 'admin_bonus')`,
    [targetId, amount]
  );
  invalidateUser(targetId);

  const updRes = await query('SELECT balance, lang FROM users WHERE telegram_id = $1', [targetId]);
  const upd    = updRes.rows[0];

  await bot.sendMessage(chatId,
    getText('uz', 'bonus_success', {
      user:    targetName,
      amount:  formatNumber(amount),
      balance: formatNumber(upd?.balance || 0),
    }),
    { parse_mode: 'HTML' }
  );

  // Notify the user
  bot.sendMessage(targetId,
    getText(upd?.lang || 'uz', 'user_bonus_notify', {
      amount:  formatNumber(amount),
      balance: formatNumber(upd?.balance || 0),
    })
  ).catch(() => {});

  clearSession(userId);
}

// ─── Broadcast ─────────────────────────────────────────────────────────────
export async function handleAdminBroadcastStart(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const sentMsg = await bot.sendMessage(chatId, getText('uz', 'broadcast_prompt'), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] },
  });
  saveSession(userId, { current_state: 'ADMIN_BROADCAST_TEXT', last_message_id: sentMsg.message_id });
}

export async function handleAdminBroadcastInput(bot, msg) {
  const chatId  = msg.chat.id;
  const userId  = msg.from.id;
  const text    = msg.text;
  if (!text) { await bot.sendMessage(chatId, '❌ Faqat matn qabul qilinadi.'); return; }

  const sentMsg = await bot.sendMessage(chatId,
    getText('uz', 'broadcast_preview', { message: text }),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: getText('uz', 'broadcast_confirm'), callback_data: 'admin:broadcast_confirm' }],
          [{ text: getText('uz', 'broadcast_cancel'),  callback_data: 'admin:cancel'             }],
        ],
      },
    }
  );

  const session = getSession(userId) || {};
  saveSession(userId, {
    ...session,
    current_state:   'ADMIN_BROADCAST_CONFIRM',
    last_message_id: sentMsg.message_id,
    state_data:      { broadcast_text: text },
  });
}

export async function handleAdminBroadcastConfirm(bot, cbQuery) {
  const chatId  = cbQuery.message.chat.id;
  const userId  = cbQuery.from.id;
  const session = getSession(userId) || {};
  const text    = session.state_data?.broadcast_text;

  if (!text) { await bot.answerCallbackQuery(cbQuery.id); clearSession(userId); return; }

  await bot.answerCallbackQuery(cbQuery.id);
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
    chat_id: chatId, message_id: cbQuery.message.message_id,
  }).catch(() => {});

  const usersRes = await query('SELECT telegram_id FROM users WHERE NOT is_blocked AND is_verified = true');
  const users    = usersRes.rows;
  let sent = 0, failed = 0;

  const statusMsg = await bot.sendMessage(chatId, `⏳ Yuborilmoqda... 0/${users.length}`);

  for (let i = 0; i < users.length; i++) {
    try {
      await bot.sendMessage(users[i].telegram_id, text, { parse_mode: 'HTML' });
      sent++;
    } catch (_) {
      failed++;
    }
    if ((i + 1) % 20 === 0) {
      await bot.editMessageText(`⏳ Yuborilmoqda... ${i + 1}/${users.length}`, {
        chat_id: chatId, message_id: statusMsg.message_id,
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    }
  }

  await bot.editMessageText(
    getText('uz', 'broadcast_done', { total: users.length, sent, failed }),
    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
  ).catch(() => {});

  clearSession(userId);
}

// ─── Channels management ───────────────────────────────────────────────────
export async function handleAdminChannels(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const chRes  = await query('SELECT * FROM subscription_channels WHERE is_active = true');
  const list   = chRes.rows.length
    ? chRes.rows.map((ch, i) => `${i + 1}. <b>${ch.name}</b> — ${ch.tg_id}`).join('\n')
    : '— Kanal yo\'q';

  const delButtons = chRes.rows.map(ch => [
    { text: `❌ ${ch.name}`, callback_data: `admin:ch_del:${ch.id}` },
  ]);

  await bot.sendMessage(chatId,
    getText('uz', 'channels_title', { list }),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          ...delButtons,
          [{ text: getText('uz', 'btn_add_channel'), callback_data: 'admin:ch_add' }],
        ],
      },
    }
  );
  clearSession(userId);
}

export async function handleAdminChannelAdd(bot, cbQuery) {
  const chatId = cbQuery.message.chat.id;
  const userId = cbQuery.from.id;
  await bot.answerCallbackQuery(cbQuery.id);

  const sentMsg = await bot.sendMessage(chatId, getText('uz', 'prompt_channel'), {
    reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] },
  });
  saveSession(userId, { current_state: 'ADMIN_CHANNEL_INPUT', last_message_id: sentMsg.message_id });
}

export async function handleAdminChannelInput(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input  = msg.text?.trim();

  try {
    const chat = await bot.getChat(input);
    const url  = chat.username ? `https://t.me/${chat.username}` : input;
    const name = chat.title || chat.username || input;
    const tgId = String(chat.id);

    await query(
      'INSERT INTO subscription_channels (tg_id, name, url) VALUES ($1, $2, $3)',
      [tgId, name, url]
    );
    await bot.sendMessage(chatId, getText('uz', 'channel_added'));
  } catch (_) {
    await bot.sendMessage(chatId, getText('uz', 'channel_invalid'));
  }

  clearSession(userId);
}

export async function handleAdminChannelDel(bot, cbQuery) {
  const id = parseInt(cbQuery.data.split(':')[2]);
  await query('DELETE FROM subscription_channels WHERE id = $1', [id]);
  await bot.answerCallbackQuery(cbQuery.id, { text: getText('uz', 'channel_deleted') });
  // Refresh channels list
  await handleAdminChannels(bot, cbQuery.message);
}

// ─── Min payout ────────────────────────────────────────────────────────────
export async function handleAdminMinPayout(bot, msg) {
  const chatId  = msg.chat.id;
  const userId  = msg.from.id;
  const current = await getMinPayout();

  const sentMsg = await bot.sendMessage(chatId,
    getText('uz', 'min_payout_current', { min: formatNumber(current) }) + '\n\n' +
    getText('uz', 'min_payout_prompt'),
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] },
    }
  );
  saveSession(userId, { current_state: 'ADMIN_MIN_PAYOUT', last_message_id: sentMsg.message_id });
}

export async function handleAdminMinPayoutInput(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const amount = parseInt(msg.text?.trim(), 10);

  if (isNaN(amount) || amount <= 0) {
    await bot.sendMessage(chatId, getText('uz', 'min_payout_invalid'));
    return;
  }

  await setSetting('min_payout', amount);
  await bot.sendMessage(chatId,
    getText('uz', 'min_payout_updated', { amount: formatNumber(amount) }),
    { parse_mode: 'HTML' }
  );
  clearSession(userId);
}

// ─── Cancel ────────────────────────────────────────────────────────────────
export async function handleAdminCancel(bot, cbQuery) {
  const userId = cbQuery.from.id;
  const chatId = cbQuery.message.chat.id;
  await bot.answerCallbackQuery(cbQuery.id);
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
    chat_id: chatId, message_id: cbQuery.message.message_id,
  }).catch(() => {});
  clearSession(userId);
  await bot.sendMessage(chatId, getText('uz', 'action_cancelled'));
}
