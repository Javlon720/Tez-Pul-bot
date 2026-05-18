'use strict';
export {
  handleAdminTolls,
  handleAdminTollStart,
  handleAdminTollPay,
  handleAdminTollScreenshot,
  handleAdminTollApprove,
  handleAdminTollEdit,
  handleAdminTollCancel,
  handleAdminTollBack,
} from './tolls.js';

import { query, transaction } from '../../shared/db.js';
import getText from '../../locales/index.js';
import { fmt } from '../../shared/utils.js';
import { getSession, saveSession, clearSession } from '../../shared/session.js';
import { invalidateUser } from '../../services/userService.js';
import { invalidateAllSubCache } from '../../middleware/subscription.js';
import { getSetting, setSetting, getMinPayout } from '../../services/settingsService.js';

// ─── Yordamchi: foydalanuvchini qidirish ──────────────────────────────────
async function findUser(input) {
  if (/^\d+$/.test(input)) {
    const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [parseInt(input)]);
    return rows[0] || null;
  }
  if (input.startsWith('@')) {
    const { rows } = await query('SELECT * FROM users WHERE username = $1', [input.slice(1)]);
    return rows[0] || null;
  }
  return null;
}

// ─── Admin menyu ──────────────────────────────────────────────────────────
export async function handleAdminMenu(bot, msg) {
  clearSession(msg.from.id);
  await bot.sendMessage(msg.chat.id, getText('uz', 'admin_menu'), {
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [
        [{ text: '📊 Statistika' },    { text: '👥 Foydalanuvchilar' }],
        [{ text: '💰 Bonus' },         { text: '⚠️ Jarima' }],
        [{ text: '📢 Xabar Yuborish' },{ text: '📡 Kanallar' }],
        [{ text: "💳 To'lovlar" },     { text: '⚙️ Sozlamalar' }],
      ],
      resize_keyboard: true,
    },
  });
}

// ─── Statistika ───────────────────────────────────────────────────────────
export async function handleAdminStats(bot, msg) {
  const [total, active, today, bal, paid] = await Promise.all([
    query('SELECT COUNT(*) AS c FROM users'),
    query('SELECT COUNT(*) AS c FROM users WHERE last_active > NOW() - INTERVAL \'24 hours\''),
    query('SELECT COUNT(*) AS c FROM users WHERE created_at > NOW() - INTERVAL \'24 hours\''),
    query('SELECT COALESCE(SUM(balance), 0) AS s FROM users'),
    query('SELECT COALESCE(SUM(paid_amount), 0) AS s FROM users'),
  ]);
  await bot.sendMessage(msg.chat.id,
    `📊 <b>Umumiy Statistika</b>\n\n` +
    `👥 Jami: <b>${total.rows[0].c}</b>\n` +
    `🟢 Faol (24s): <b>${active.rows[0].c}</b>\n` +
    `📅 Bugun yangi: <b>${today.rows[0].c}</b>\n\n` +
    `💰 Jami balanslar: <b>${fmt(bal.rows[0].s)} so'm</b>\n` +
    `✅ To'langan: <b>${fmt(paid.rows[0].s)} so'm</b>`,
    { parse_mode: 'HTML' }
  );
}

// ─── Foydalanuvchilar ro'yxati (inline buttons) ───────────────────────────
export async function handleAdminUsers(bot, msg) {
  const { rows } = await query(
    'SELECT telegram_id, first_name, username, is_blocked FROM users ORDER BY created_at DESC LIMIT 30'
  );
  if (!rows.length) { await bot.sendMessage(msg.chat.id, '— Foydalanuvchilar yo\'q.'); return; }

  const inline_keyboard = rows.map(u => [{
    text: `${u.is_blocked ? '🚫 ' : '👤 '}${u.first_name}${u.username ? ` (@${u.username})` : ''}`,
    callback_data: `admin:user:${u.telegram_id}`,
  }]);

  await bot.sendMessage(msg.chat.id, `👥 <b>So'nggi 30 foydalanuvchi:</b>`, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard },
  });
}

// ─── Foydalanuvchilar ro'yxatiga inline qaytish ───────────────────────────
export async function handleAdminUsersList(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id);
  const { rows } = await query(
    'SELECT telegram_id, first_name, username, is_blocked FROM users ORDER BY created_at DESC LIMIT 30'
  );
  const inline_keyboard = rows.length
    ? rows.map(u => [{
        text: `${u.is_blocked ? '🚫 ' : '👤 '}${u.first_name}${u.username ? ` (@${u.username})` : ''}`,
        callback_data: `admin:user:${u.telegram_id}`,
      }])
    : [[{ text: '— Bo\'sh', callback_data: 'admin:cancel' }]];

  await bot.editMessageText(`👥 <b>So'nggi 30 foydalanuvchi:</b>`, {
    chat_id: cbQuery.message.chat.id,
    message_id: cbQuery.message.message_id,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard },
  });
}

// ─── Foydalanuvchi to'liq ma'lumoti ──────────────────────────────────────
export async function handleAdminUserDetail(bot, cbQuery) {
  const telegramId = parseInt(cbQuery.data.split(':')[2]);
  await bot.answerCallbackQuery(cbQuery.id);

  const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  if (!rows.length) { await bot.answerCallbackQuery(cbQuery.id, { text: '❌ Foydalanuvchi topilmadi', show_alert: true }); return; }
  const u = rows[0];

  const { rows: refs } = await query(
    `SELECT u.telegram_id, u.first_name, u.username
     FROM referrals r
     JOIN users u ON u.telegram_id = r.referred_id
     WHERE r.referrer_id = $1
     ORDER BY r.created_at DESC`,
    [telegramId]
  );

  const refList = refs.length
    ? refs.map(r => `  • ${r.first_name}${r.username ? ` (@${r.username})` : ` (ID: ${r.telegram_id})`}`).join('\n')
    : '  — Hech kim yo\'q';

  const statusIcon = u.is_blocked ? '🚫' : '✅';
  const text =
    `${statusIcon} <b>${u.first_name}${u.last_name ? ' ' + u.last_name : ''}</b>\n\n` +
    `🆔 <b>ID:</b> <code>${u.telegram_id}</code>\n` +
    `👤 <b>Ism:</b> ${u.first_name}${u.last_name ? ' ' + u.last_name : ''}\n` +
    `🔗 <b>Username:</b> ${u.username ? `@${u.username}` : '—'}\n` +
    `📱 <b>Telefon:</b> ${u.phone || '—'}\n` +
    `💰 <b>Balans:</b> ${fmt(u.balance)} so'm\n` +
    `📅 <b>Ro'yxatdan:</b> ${new Date(u.created_at).toLocaleDateString('ru-RU')}\n` +
    `🕐 <b>So'nggi faollik:</b> ${new Date(u.last_active).toLocaleDateString('ru-RU')}\n\n` +
    `👥 <b>Qo'shgan odamlar:</b> ${u.total_referrals}\n${refList}`;

  const blockBtn = u.is_blocked
    ? { text: '✅ Blockdan olish', callback_data: `admin:block:${telegramId}` }
    : { text: '🚫 Block qilish',   callback_data: `admin:block:${telegramId}` };

  await bot.editMessageText(text, {
    chat_id: cbQuery.message.chat.id,
    message_id: cbQuery.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '⬅️ Ortga', callback_data: 'admin:users_list' },
        blockBtn,
      ]],
    },
  });
}

// ─── Foydalanuvchini block / unblock ─────────────────────────────────────
export async function handleAdminUserBlock(bot, cbQuery) {
  const telegramId = parseInt(cbQuery.data.split(':')[2]);

  const { rows } = await query('SELECT is_blocked FROM users WHERE telegram_id = $1', [telegramId]);
  if (!rows.length) { await bot.answerCallbackQuery(cbQuery.id, { text: '❌ Topilmadi' }); return; }

  const newBlocked = !rows[0].is_blocked;
  await query('UPDATE users SET is_blocked = $1 WHERE telegram_id = $2', [newBlocked, telegramId]);
  invalidateUser(telegramId);

  await bot.answerCallbackQuery(cbQuery.id, {
    text: newBlocked ? '🚫 Foydalanuvchi bloklandi' : '✅ Foydalanuvchi blockdan olindi',
  });

  // Detail sahifasini yangilash uchun data ni o'zgartirib chaqiramiz
  await handleAdminUserDetail(bot, {
    ...cbQuery,
    data: `admin:user:${telegramId}`,
  });
}

// ─── Bonus: step 1 ────────────────────────────────────────────────────────
export async function handleAdminBonusStart(bot, msg) {
  const sentMsg = await bot.sendMessage(msg.chat.id,
    '💰 <b>Bonus Yuborish</b>\n\nFoydalanuvchi ID yoki @username kiriting:',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] } }
  );
  saveSession(msg.from.id, { current_state: 'ADMIN_BONUS_TARGET', last_message_id: sentMsg.message_id });
}

export async function handleAdminBonusTargetInput(bot, msg) {
  const target = await findUser(msg.text?.trim());
  if (!target) { await bot.sendMessage(msg.chat.id, getText('uz', 'bonus_not_found')); return; }

  const name    = target.first_name + (target.username ? ` @${target.username}` : '');
  const sentMsg = await bot.sendMessage(msg.chat.id,
    getText('uz', 'bonus_amount', { user: name }),
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] } }
  );
  const session = getSession(msg.from.id) || {};
  saveSession(msg.from.id, { ...session, current_state: 'ADMIN_BONUS_AMOUNT', last_message_id: sentMsg.message_id, state_data: { target_id: target.telegram_id, target_name: target.first_name } });
}

export async function handleAdminBonusAmountInput(bot, msg) {
  const session  = getSession(msg.from.id) || {};
  const amount   = parseInt(msg.text?.trim(), 10);
  if (isNaN(amount) || amount <= 0) { await bot.sendMessage(msg.chat.id, getText('uz', 'bonus_invalid')); return; }

  const { target_id: targetId, target_name: targetName } = session.state_data || {};
  if (!targetId) { await bot.sendMessage(msg.chat.id, '❌ Xato. Qaytadan boshlang.'); clearSession(msg.from.id); return; }

  await query('UPDATE users SET balance = balance + $1, unpaid_amount = unpaid_amount + $1 WHERE telegram_id = $2', [amount, targetId]);
  await query(`INSERT INTO payments (user_id, amount, status, note) VALUES ($1, $2, 'completed', 'admin_bonus')`, [targetId, amount]);
  invalidateUser(targetId);

  const { rows } = await query('SELECT balance, lang FROM users WHERE telegram_id = $1', [targetId]);
  const upd = rows[0];

  await bot.sendMessage(msg.chat.id, getText('uz', 'bonus_success', { user: targetName, amount: fmt(amount), balance: fmt(upd?.balance || 0) }), { parse_mode: 'HTML' });
  bot.sendMessage(targetId, getText(upd?.lang || 'uz', 'user_bonus_notify', { amount: fmt(amount), balance: fmt(upd?.balance || 0) })).catch(() => {});
  clearSession(msg.from.id);
}

// ─── Jarima ───────────────────────────────────────────────────────────────
export async function handleAdminPenaltyStart(bot, msg) {
  const sentMsg = await bot.sendMessage(msg.chat.id,
    '⚠️ <b>Jarima Berish</b>\n\nFoydalanuvchi ID yoki @username kiriting:',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] } }
  );
  saveSession(msg.from.id, { current_state: 'ADMIN_PENALTY_TARGET', last_message_id: sentMsg.message_id });
}

export async function handleAdminPenaltyTargetInput(bot, msg) {
  const target = await findUser(msg.text?.trim());
  if (!target) { await bot.sendMessage(msg.chat.id, getText('uz', 'bonus_not_found')); return; }

  const name    = target.first_name + (target.username ? ` @${target.username}` : '');
  const sentMsg = await bot.sendMessage(msg.chat.id,
    `⚠️ <b>${name}</b> dan necha so'm jarima olinadi?\n\nHozirgi balans: <b>${fmt(target.balance)} so'm</b>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] } }
  );
  const session = getSession(msg.from.id) || {};
  saveSession(msg.from.id, { ...session, current_state: 'ADMIN_PENALTY_AMOUNT', last_message_id: sentMsg.message_id, state_data: { target_id: target.telegram_id, target_name: target.first_name } });
}

export async function handleAdminPenaltyAmountInput(bot, msg) {
  const session = getSession(msg.from.id) || {};
  const amount  = parseInt(msg.text?.trim(), 10);
  if (isNaN(amount) || amount <= 0) { await bot.sendMessage(msg.chat.id, getText('uz', 'bonus_invalid')); return; }

  const { target_id: targetId, target_name: targetName } = session.state_data || {};
  if (!targetId) { await bot.sendMessage(msg.chat.id, '❌ Xato. Qaytadan boshlang.'); clearSession(msg.from.id); return; }

  const { rows } = await query('SELECT balance, lang FROM users WHERE telegram_id = $1', [targetId]);
  const user = rows[0];
  if (!user || parseInt(user.balance) < amount) {
    await bot.sendMessage(msg.chat.id, getText('uz', 'penalty_not_enough', { balance: fmt(user?.balance || 0) }), { parse_mode: 'HTML' });
    return;
  }

  await query('UPDATE users SET balance = balance - $1 WHERE telegram_id = $2', [amount, targetId]);
  invalidateUser(targetId);

  const { rows: upd } = await query('SELECT balance FROM users WHERE telegram_id = $1', [targetId]);
  await bot.sendMessage(msg.chat.id, getText('uz', 'penalty_success', { user: targetName, amount: fmt(amount), balance: fmt(upd[0]?.balance || 0) }), { parse_mode: 'HTML' });
  bot.sendMessage(targetId, getText(user.lang || 'uz', 'user_penalty_notify', { amount: fmt(amount), balance: fmt(upd[0]?.balance || 0) })).catch(() => {});
  clearSession(msg.from.id);
}

// ─── Broadcast ────────────────────────────────────────────────────────────
export async function handleAdminBroadcastStart(bot, msg) {
  const sentMsg = await bot.sendMessage(msg.chat.id, getText('uz', 'broadcast_prompt'), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] },
  });
  saveSession(msg.from.id, { current_state: 'ADMIN_BROADCAST_TEXT', last_message_id: sentMsg.message_id });
}

export async function handleAdminBroadcastInput(bot, msg) {
  const text = msg.text;
  if (!text) { await bot.sendMessage(msg.chat.id, '❌ Faqat matn qabul qilinadi.'); return; }

  const sentMsg = await bot.sendMessage(msg.chat.id,
    getText('uz', 'broadcast_preview', { message: text }),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: getText('uz', 'broadcast_confirm'), callback_data: 'admin:broadcast_confirm' }],
          [{ text: getText('uz', 'broadcast_cancel'),  callback_data: 'admin:cancel' }],
        ],
      },
    }
  );
  const session = getSession(msg.from.id) || {};
  saveSession(msg.from.id, { ...session, current_state: 'ADMIN_BROADCAST_CONFIRM', last_message_id: sentMsg.message_id, state_data: { broadcast_text: text } });
}

export async function handleAdminBroadcastConfirm(bot, cbQuery) {
  const chatId  = cbQuery.message.chat.id;
  const session = getSession(cbQuery.from.id) || {};
  const text    = session.state_data?.broadcast_text;
  if (!text) { await bot.answerCallbackQuery(cbQuery.id); clearSession(cbQuery.from.id); return; }

  await bot.answerCallbackQuery(cbQuery.id);
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: cbQuery.message.message_id }).catch(() => {});

  const { rows: users } = await query('SELECT telegram_id FROM users WHERE NOT is_blocked AND is_verified = true');
  let sent = 0, failed = 0;
  const statusMsg = await bot.sendMessage(chatId, `⏳ Yuborilmoqda... 0/${users.length}`);

  for (let i = 0; i < users.length; i++) {
    try { await bot.sendMessage(users[i].telegram_id, text, { parse_mode: 'HTML' }); sent++; }
    catch (_) { failed++; }
    if ((i + 1) % 20 === 0) {
      await bot.editMessageText(`⏳ Yuborilmoqda... ${i+1}/${users.length}`, { chat_id: chatId, message_id: statusMsg.message_id }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    }
  }

  await bot.editMessageText(
    getText('uz', 'broadcast_done', { total: users.length, sent, failed }),
    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
  ).catch(() => {});
  clearSession(cbQuery.from.id);
}

// ─── Kanallar ─────────────────────────────────────────────────────────────
export async function handleAdminChannels(bot, msg) {
  const { rows } = await query('SELECT * FROM subscription_channels WHERE is_active = true');
  const list = rows.length
    ? rows.map((ch, i) => `${i+1}. <b>${ch.name}</b> — <code>${ch.tg_id}</code>`).join('\n')
    : '— Kanal yo\'q';

  await bot.sendMessage(msg.chat.id,
    getText('uz', 'channels_title', { list }),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          ...rows.map(ch => [{ text: `❌ ${ch.name}`, callback_data: `admin:ch_del:${ch.id}` }]),
          [{ text: getText('uz', 'btn_add_channel'), callback_data: 'admin:ch_add' }],
        ],
      },
    }
  );
  clearSession(msg.from.id);
}

export async function handleAdminChannelAdd(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id);
  const sentMsg = await bot.sendMessage(cbQuery.message.chat.id, getText('uz', 'prompt_channel'), {
    reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] },
  });
  saveSession(cbQuery.from.id, { current_state: 'ADMIN_CHANNEL_INPUT', last_message_id: sentMsg.message_id });
}

export async function handleAdminChannelInput(bot, msg) {
  const input = msg.text?.trim();
  try {
    const chat = await bot.getChat(input);
    const url  = chat.username ? `https://t.me/${chat.username}` : input;
    await query('INSERT INTO subscription_channels (tg_id, name, url) VALUES ($1, $2, $3)', [String(chat.id), chat.title || chat.username || input, url]);
    invalidateAllSubCache();
    await bot.sendMessage(msg.chat.id, getText('uz', 'channel_added'));
  } catch (_) {
    await bot.sendMessage(msg.chat.id, getText('uz', 'channel_invalid'));
  }
  clearSession(msg.from.id);
}

export async function handleAdminChannelDel(bot, cbQuery) {
  const id = parseInt(cbQuery.data.split(':')[2]);
  await query('DELETE FROM subscription_channels WHERE id = $1', [id]);
  await bot.answerCallbackQuery(cbQuery.id, { text: getText('uz', 'channel_deleted') });
  await handleAdminChannels(bot, cbQuery.message);
}

// ─── Sozlamalar menyusi ───────────────────────────────────────────────────
export async function handleAdminSettings(bot, msg) {
  const [minPayout, bonusDirect, spinMultiply] = await Promise.all([
    getSetting('min_payout', '5000'),
    getSetting('bonus_direct', '1000'),
    getSetting('spin_multiply', '2'),
  ]);
  await bot.sendMessage(msg.chat.id,
    `⚙️ <b>Sozlamalar</b>\n\n` +
    `💳 Minimal to'lov: <b>${fmt(minPayout)} so'm</b>\n` +
    `🎁 Referal bonus: <b>${fmt(bonusDirect)} so'm</b>\n` +
    `🎰 Spin ko'paytmasi: <b>×${spinMultiply}</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "💳 Min. To'lov",     callback_data: 'admin:set:min_payout'    }],
          [{ text: '🎁 Referal Bonus',   callback_data: 'admin:set:bonus_direct'  }],
          [{ text: '🎰 Spin ×',          callback_data: 'admin:set:spin_multiply' }],
        ],
      },
    }
  );
}

export async function handleAdminSettingSelect(bot, cbQuery) {
  const key     = cbQuery.data.split(':')[2];
  const userId  = cbQuery.from.id;
  const chatId  = cbQuery.message.chat.id;
  await bot.answerCallbackQuery(cbQuery.id);

  const prompts = {
    min_payout:    { text_key: 'min_payout_prompt',    cur_key: 'min_payout_current',    cur_fmt: 'min' },
    bonus_direct:  { text_key: 'bonus_direct_prompt',  cur_key: 'bonus_direct_current',  cur_fmt: 'amount' },
    spin_multiply: { text_key: 'spin_multiply_prompt', cur_key: 'spin_multiply_current', cur_fmt: 'multiply' },
  };
  const p = prompts[key];
  if (!p) return;

  const cur     = await getSetting(key);
  const param   = { [p.cur_fmt]: key === 'spin_multiply' ? cur : fmt(cur) };
  const sentMsg = await bot.sendMessage(chatId,
    getText('uz', p.cur_key, param) + '\n\n' + getText('uz', p.text_key),
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] } }
  );
  saveSession(userId, { current_state: `ADMIN_SET_${key.toUpperCase()}`, last_message_id: sentMsg.message_id });
}

export async function handleAdminSettingInput(bot, msg, key) {
  const val = parseInt(msg.text?.trim(), 10);
  if (isNaN(val) || val <= 0) { await bot.sendMessage(msg.chat.id, getText('uz', 'min_payout_invalid')); return; }

  await setSetting(key, val);
  const updates = {
    min_payout:    getText('uz', 'min_payout_updated',    { amount: fmt(val) }),
    bonus_direct:  getText('uz', 'bonus_direct_updated',  { amount: fmt(val) }),
    spin_multiply: getText('uz', 'spin_multiply_updated', { multiply: val   }),
  };
  await bot.sendMessage(msg.chat.id, updates[key] || '✅ Saqlandi.', { parse_mode: 'HTML' });
  clearSession(msg.from.id);
}

// ─── Bekor qilish ─────────────────────────────────────────────────────────
export async function handleAdminCancel(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id);
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: cbQuery.message.chat.id, message_id: cbQuery.message.message_id }).catch(() => {});
  clearSession(cbQuery.from.id);
  await bot.sendMessage(cbQuery.message.chat.id, getText('uz', 'action_cancelled'));
}
