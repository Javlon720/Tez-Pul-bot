'use strict';
import { query } from '../../shared/db.js';
import { fmt } from '../../shared/utils.js';
import { getSession, saveSession, clearSession } from '../../shared/session.js';
import { invalidateUser } from '../../services/userService.js';
import { getMinPayout } from '../../services/settingsService.js';

function maskPhone(phone) {
  if (!phone) return '—';
  const p = String(phone).replace(/\s/g, '');
  if (p.length < 2) return '—';
  return `+998 xxx xx ${p.slice(-2)}`;
}

async function buildTollList() {
  const minPayout = await getMinPayout();
  const { rows } = await query(
    `SELECT telegram_id, first_name, username, phone, unpaid_amount, total_referrals
     FROM users
     WHERE unpaid_amount >= $1 AND NOT is_blocked
     ORDER BY unpaid_amount DESC`,
    [minPayout]
  );
  return { rows, minPayout };
}

export async function handleAdminTolls(bot, msg) {
  const { rows } = await buildTollList();

  if (!rows.length) {
    await bot.sendMessage(msg.chat.id,
      `💳 <b>To'lovlar</b>\n\n✅ To'lov kutayotgan foydalanuvchi yo'q.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const lines = rows.map((u, i) => {
    const name = u.first_name + (u.username ? ` (@${u.username})` : '');
    return `${i + 1}. <b>${name}</b>\n   👥 ${u.total_referrals} ta | 💰 ${fmt(u.unpaid_amount)} so'm`;
  }).join('\n\n');

  const inline_keyboard = rows.map(u => [
    { text: `✅ To'lash — ${u.first_name}`, callback_data: `admin:toll:start:${u.telegram_id}` },
    { text: '❌ Bekor', callback_data: `admin:toll:cancel:${u.telegram_id}` },
  ]);

  await bot.sendMessage(msg.chat.id,
    `💳 <b>Kutayotgan to'lovlar</b>\n\n${lines}\n\n<b>Jami: ${rows.length} ta</b>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard } }
  );
}

export async function handleAdminTollBack(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id);
  const { rows } = await buildTollList();

  if (!rows.length) {
    await bot.editMessageText(
      `💳 <b>To'lovlar</b>\n\n✅ To'lov kutayotgan foydalanuvchi yo'q.`,
      { chat_id: cbQuery.message.chat.id, message_id: cbQuery.message.message_id, parse_mode: 'HTML' }
    ).catch(() => {});
    return;
  }

  const lines = rows.map((u, i) => {
    const name = u.first_name + (u.username ? ` (@${u.username})` : '');
    return `${i + 1}. <b>${name}</b>\n   👥 ${u.total_referrals} ta | 💰 ${fmt(u.unpaid_amount)} so'm`;
  }).join('\n\n');

  const inline_keyboard = rows.map(u => [
    { text: `✅ To'lash — ${u.first_name}`, callback_data: `admin:toll:start:${u.telegram_id}` },
    { text: '❌ Bekor', callback_data: `admin:toll:cancel:${u.telegram_id}` },
  ]);

  await bot.editMessageText(
    `💳 <b>Kutayotgan to'lovlar</b>\n\n${lines}\n\n<b>Jami: ${rows.length} ta</b>`,
    {
      chat_id: cbQuery.message.chat.id,
      message_id: cbQuery.message.message_id,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard },
    }
  ).catch(() => {});
}

export async function handleAdminTollStart(bot, cbQuery) {
  const userId = parseInt(cbQuery.data.split(':')[3]);
  await bot.answerCallbackQuery(cbQuery.id);

  const minPayout = await getMinPayout();
  const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
  if (!rows.length) return;
  const u = rows[0];

  const name = u.first_name + (u.username ? ` (@${u.username})` : '');

  await bot.editMessageText(
    `💳 <b>To'lov tafsilotlari</b>\n\n` +
    `👤 ${name}\n` +
    `📱 ${maskPhone(u.phone)}\n` +
    `💰 To'lov: <b>${fmt(u.unpaid_amount)} so'm</b>\n` +
    `👥 Taklif qilganlar: <b>${u.total_referrals} ta</b>\n\n` +
    `💳 Minimal to'lov: <b>${fmt(minPayout)} so'm</b>`,
    {
      chat_id: cbQuery.message.chat.id,
      message_id: cbQuery.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ To'lash", callback_data: `admin:toll:pay:${userId}` },
            { text: '❌ Bekor',   callback_data: `admin:toll:cancel:${userId}` },
          ],
          [{ text: '⬅️ Ortga', callback_data: 'admin:toll:back' }],
        ],
      },
    }
  ).catch(() => {});
}

export async function handleAdminTollPay(bot, cbQuery) {
  const userId = parseInt(cbQuery.data.split(':')[3]);
  await bot.answerCallbackQuery(cbQuery.id);

  const { rows } = await query('SELECT unpaid_amount FROM users WHERE telegram_id = $1', [userId]);
  if (!rows.length) return;
  const amount = parseInt(rows[0].unpaid_amount);

  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
    chat_id: cbQuery.message.chat.id,
    message_id: cbQuery.message.message_id,
  }).catch(() => {});

  const sentMsg = await bot.sendMessage(cbQuery.message.chat.id,
    `✅ <b>${fmt(amount)} so'm</b> to'lov tasdiqlandi.\n\n📸 Endi to'lov screenshotini yuboring:`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] },
    }
  );

  saveSession(cbQuery.from.id, {
    current_state: 'ADMIN_TOLL_SCREENSHOT',
    last_message_id: sentMsg.message_id,
    state_data: { target_id: userId, amount },
  });
}

export async function handleAdminTollScreenshot(bot, msg) {
  const session = getSession(msg.from.id) || {};
  const { target_id: targetId, amount } = session.state_data || {};
  if (!targetId) return;

  const photo = msg.photo;
  const doc   = msg.document;
  if (!photo && !doc) {
    await bot.sendMessage(msg.chat.id, '❌ Faqat rasm yoki fayl yuboring.');
    return;
  }

  const fileId = photo ? photo[photo.length - 1].file_id : doc.file_id;

  const { rows } = await query('SELECT first_name, username FROM users WHERE telegram_id = $1', [targetId]);
  if (!rows.length) return;
  const u    = rows[0];
  const name = u.first_name + (u.username ? ` (@${u.username})` : '');

  const sentMsg = await bot.sendPhoto(msg.chat.id, fileId, {
    caption:
      `📸 <b>To'lov screenshoti</b>\n\n` +
      `👤 ${name}\n` +
      `💰 ${fmt(amount)} so'm\n\n` +
      `Tasdiqlaysizmi?`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Tasdiqlash', callback_data: `admin:toll:approve:${targetId}` },
        { text: '✏️ Tahrirlash', callback_data: `admin:toll:edit:${targetId}` },
      ]],
    },
  });

  saveSession(msg.from.id, {
    ...session,
    current_state: 'ADMIN_TOLL_APPROVE',
    last_message_id: sentMsg.message_id,
    state_data: { target_id: targetId, amount, file_id: fileId },
  });
}

export async function handleAdminTollApprove(bot, cbQuery) {
  const userId  = parseInt(cbQuery.data.split(':')[3]);
  const session = getSession(cbQuery.from.id) || {};
  const { amount, file_id: fileId } = session.state_data || {};
  await bot.answerCallbackQuery(cbQuery.id);

  if (!amount || !fileId) {
    await bot.sendMessage(cbQuery.message.chat.id, '❌ Xato. Qaytadan boshlang.');
    clearSession(cbQuery.from.id);
    return;
  }

  const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
  if (!rows.length) return;
  const u = rows[0];

  await query(
    `UPDATE users SET paid_amount = paid_amount + $1, unpaid_amount = 0 WHERE telegram_id = $2`,
    [amount, userId]
  );
  await query(
    `INSERT INTO payments (user_id, amount, status, note) VALUES ($1, $2, 'completed', 'admin_payout')`,
    [userId, amount]
  );
  invalidateUser(userId);

  // Kanalga yuborish
  const paymentChannelId = process.env.PAYMENT_CHANNEL_ID;
  let channelMsgId = null;
  if (paymentChannelId) {
    const chanCaption =
      `💳 <b>To'lov amalga oshirildi</b>\n\n` +
      `👤 ${u.username ? `@${u.username}` : u.first_name}\n` +
      `📱 ${maskPhone(u.phone)}\n` +
      `💰 ${fmt(amount)} so'm`;
    try {
      const chanMsg = await bot.sendPhoto(paymentChannelId, fileId, {
        caption: chanCaption,
        parse_mode: 'HTML',
      });
      channelMsgId = chanMsg.message_id;
    } catch (_) {}
  }

  // Foydalanuvchiga xabar
  const channelLink = paymentChannelId && channelMsgId
    ? `https://t.me/c/${String(paymentChannelId).replace('-100', '')}/${channelMsgId}`
    : null;

  bot.sendMessage(userId,
    `✅ <b>To'lovingiz amalga oshirildi!</b>\n\n💰 ${fmt(amount)} so'm tasdiqlandi.`,
    {
      parse_mode: 'HTML',
      reply_markup: channelLink
        ? { inline_keyboard: [[{ text: "📸 Screenshotni ko'rish", url: channelLink }]] }
        : { inline_keyboard: [] },
    }
  ).catch(() => {});

  // Admin tasdiq
  const name = u.first_name + (u.username ? ` (@${u.username})` : '');
  await bot.editMessageCaption(
    `✅ <b>To'lov tasdiqlandi!</b>\n\n` +
    `👤 ${name}\n` +
    `💰 ${fmt(amount)} so'm`,
    {
      chat_id: cbQuery.message.chat.id,
      message_id: cbQuery.message.message_id,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] },
    }
  ).catch(() => {});

  clearSession(cbQuery.from.id);
}

export async function handleAdminTollEdit(bot, cbQuery) {
  const userId  = parseInt(cbQuery.data.split(':')[3]);
  const session = getSession(cbQuery.from.id) || {};
  const { amount } = session.state_data || {};
  await bot.answerCallbackQuery(cbQuery.id);

  await bot.editMessageCaption('🗑 Screenshot o\'chirildi', {
    chat_id: cbQuery.message.chat.id,
    message_id: cbQuery.message.message_id,
    reply_markup: { inline_keyboard: [] },
  }).catch(() => {});

  const sentMsg = await bot.sendMessage(cbQuery.message.chat.id,
    `✏️ <b>Qayta yuboring</b>\n\n📸 To'lov screenshotini qaytadan yuboring:`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin:cancel' }]] },
    }
  );

  saveSession(cbQuery.from.id, {
    ...session,
    current_state: 'ADMIN_TOLL_SCREENSHOT',
    last_message_id: sentMsg.message_id,
    state_data: { target_id: userId, amount },
  });
}

export async function handleAdminTollCancel(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id, { text: '❌ Bekor qilindi' });
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
    chat_id: cbQuery.message.chat.id,
    message_id: cbQuery.message.message_id,
  }).catch(() => {});
  clearSession(cbQuery.from.id);
}
