'use strict';
import { query } from '../../shared/db.js';
import { fmt } from '../../shared/utils.js';
import { getSession, saveSession, clearSession } from '../../shared/session.js';
import { invalidateUser } from '../../services/userService.js';

function maskPhone(phone) {
  if (!phone) return '—';
  const p = String(phone).replace(/\s/g, '');
  return `+998 xxx xx ${p.slice(-2)}`;
}

// ── To'lovlar ro'yxati (pending payment requests) ─────────────────────────────
export async function handleAdminTolls(bot, msg) {
  const { rows } = await query(
    `SELECT pr.id, pr.amount, u.first_name, u.username
     FROM payment_requests pr
     JOIN users u ON u.telegram_id = pr.user_id
     WHERE pr.status = 'pending'
     ORDER BY pr.created_at ASC`
  );

  if (!rows.length) {
    await bot.sendMessage(msg.chat.id,
      `💳 <b>To'lovlar</b>\n\n✅ Kutayotgan murojaat yo'q.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const inline_keyboard = rows.map(r => [{
    text: `${r.first_name}${r.username ? ` (@${r.username})` : ''} — ${fmt(r.amount)} so'm`,
    callback_data: `admin:toll:req:${r.id}`,
  }]);

  await bot.sendMessage(msg.chat.id,
    `💳 <b>Kutayotgan to'lovlar</b> — ${rows.length} ta`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard } }
  );
}

// ── Bitta murojaat tafsiloti ──────────────────────────────────────────────────
export async function handleAdminTollReq(bot, cbQuery) {
  const reqId = parseInt(cbQuery.data.split(':')[3]);
  await bot.answerCallbackQuery(cbQuery.id);

  const { rows } = await query(
    `SELECT pr.*, u.first_name, u.last_name, u.username, u.phone,
            u.balance, u.unpaid_amount, u.paid_amount, u.total_referrals
     FROM payment_requests pr
     JOIN users u ON u.telegram_id = pr.user_id
     WHERE pr.id = $1`,
    [reqId]
  );
  if (!rows.length) return;
  const r = rows[0];

  const { rows: refs } = await query(
    `SELECT u.first_name, u.username
     FROM referrals rf JOIN users u ON u.telegram_id = rf.referred_id
     WHERE rf.referrer_id = $1 ORDER BY rf.created_at DESC`,
    [r.user_id]
  );

  const refList = refs.length
    ? refs.map((u, i) => `  ${i + 1}. ${u.first_name}${u.username ? ` (@${u.username})` : ''}`).join('\n')
    : '  — hech kim yo\'q';

  const name = r.first_name + (r.last_name ? ' ' + r.last_name : '');
  const card = r.card_number.replace(/\D/g, '').replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
  const text =
    `💳 <b>To'lov murojaat #${reqId}</b>\n\n` +
    `👤 ${name}${r.username ? ` (@${r.username})` : ''}\n\n` +
    `📊 <b>Statistika:</b>\n` +
    `👥 Qo'shgan odamlar: <b>${r.total_referrals} ta</b>\n` +
    `${refList}\n\n` +
    `✅ Jami to'langan: <b>${fmt(r.paid_amount)} so'm</b>\n` +
    `⏳ Qolgan balans: <b>${fmt(r.unpaid_amount)} so'm</b>\n\n` +
    `💰 So'ralgan summa: <b>${fmt(r.amount)} so'm</b>\n` +
    `💳 Karta: <code>${card}</code>\n` +
    `👤 FIO: ${r.full_name}`;

  await bot.editMessageText(text, {
    chat_id: cbQuery.message.chat.id,
    message_id: cbQuery.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ To'lash",    callback_data: `admin:toll:pay:${reqId}` },
          { text: '🚫 Block',     callback_data: `admin:toll:block:${reqId}` },
        ],
        [{ text: '⬅️ Ortga', callback_data: 'admin:toll:back' }],
      ],
    },
  }).catch(() => {});
}

// ── To'lash — screenshot so'rash ─────────────────────────────────────────────
export async function handleAdminTollPay(bot, cbQuery) {
  const reqId = parseInt(cbQuery.data.split(':')[3]);
  await bot.answerCallbackQuery(cbQuery.id);

  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
    chat_id: cbQuery.message.chat.id,
    message_id: cbQuery.message.message_id,
  }).catch(() => {});

  const sentMsg = await bot.sendMessage(cbQuery.message.chat.id,
    `📸 To'lov screenshotini yuboring:`,
    { reply_markup: { inline_keyboard: [[{ text: '⬅️ Ortga', callback_data: `admin:toll:req:${reqId}` }]] } }
  );

  saveSession(cbQuery.from.id, {
    current_state: 'ADMIN_TOLL_SCREENSHOT',
    last_message_id: sentMsg.message_id,
    state_data: { req_id: reqId },
  });
}

// ── Screenshot qabul ─────────────────────────────────────────────────────────
export async function handleAdminTollScreenshot(bot, msg) {
  const session = getSession(msg.from.id) || {};
  const { req_id: reqId } = session.state_data || {};
  if (!reqId) return;

  const photo = msg.photo;
  const doc   = msg.document;
  if (!photo && !doc) {
    await bot.sendMessage(msg.chat.id, '❌ Faqat rasm yoki fayl yuboring.');
    return;
  }
  const fileId = photo ? photo[photo.length - 1].file_id : doc.file_id;

  const { rows } = await query(
    `SELECT pr.*, u.first_name, u.username
     FROM payment_requests pr JOIN users u ON u.telegram_id = pr.user_id
     WHERE pr.id = $1`, [reqId]
  );
  if (!rows.length) return;
  const r = rows[0];
  const name = r.first_name + (r.username ? ` (@${r.username})` : '');

  const sentMsg = await bot.sendPhoto(msg.chat.id, fileId, {
    caption:
      `📸 <b>To'lov screenshoti</b>\n\n` +
      `👤 ${name}\n💰 ${fmt(r.amount)} so'm\n\nTasdiqlaysizmi?`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Tasdiqlash', callback_data: `admin:toll:approve:${reqId}` },
        { text: '✏️ Tahrirlash', callback_data: `admin:toll:edit:${reqId}` },
        { text: '⬅️ Ortga',    callback_data: `admin:toll:req:${reqId}` },
      ]],
    },
  });

  saveSession(msg.from.id, {
    ...session,
    current_state: 'ADMIN_TOLL_APPROVE',
    state_data: { req_id: reqId, file_id: fileId },
  });
}

// ── Tasdiqlash ────────────────────────────────────────────────────────────────
export async function handleAdminTollApprove(bot, cbQuery) {
  const reqId   = parseInt(cbQuery.data.split(':')[3]);
  const session = getSession(cbQuery.from.id) || {};
  const { file_id: fileId } = session.state_data || {};
  await bot.answerCallbackQuery(cbQuery.id);

  const { rows } = await query(
    `SELECT pr.*, u.first_name, u.username, u.phone, u.lang
     FROM payment_requests pr JOIN users u ON u.telegram_id = pr.user_id
     WHERE pr.id = $1`, [reqId]
  );
  if (!rows.length) return;
  const r = rows[0];

  await query(`UPDATE payment_requests SET status = 'approved' WHERE id = $1`, [reqId]);
  await query(
    `UPDATE users SET paid_amount = paid_amount + $1, unpaid_amount = GREATEST(unpaid_amount - $1, 0), balance = GREATEST(balance - $1, 0) WHERE telegram_id = $2`,
    [r.amount, r.user_id]
  );
  await query(
    `INSERT INTO payments (user_id, amount, status, note) VALUES ($1, $2, 'completed', 'payout')`,
    [r.user_id, r.amount]
  );
  invalidateUser(r.user_id);

  // Kanalga yuborish
  const channelId = process.env.PAYMENT_CHANNEL_ID;
  let channelMsgId = null;
  if (channelId && fileId) {
    const cap =
      `💳 <b>To'lov amalga oshirildi</b>\n\n` +
      `👤 ${r.username ? `@${r.username}` : r.first_name}\n` +
      `📱 ${maskPhone(r.phone)}\n` +
      `💰 ${fmt(r.amount)} so'm`;
    try {
      const m = await bot.sendPhoto(channelId, fileId, { caption: cap, parse_mode: 'HTML' });
      channelMsgId = m.message_id;
    } catch (_) {}
  }

  // Userga xabar
  const link = channelId && channelMsgId
    ? `https://t.me/c/${String(channelId).replace('-100', '')}/${channelMsgId}`
    : null;

  bot.sendMessage(r.user_id,
    `✅ <b>To'lovingiz amalga oshirildi!</b>\n💰 ${fmt(r.amount)} so'm`,
    {
      parse_mode: 'HTML',
      reply_markup: link
        ? { inline_keyboard: [[{ text: "📸 Ko'rish", url: link }]] }
        : { inline_keyboard: [] },
    }
  ).catch(() => {});

  const uname = r.first_name + (r.username ? ` (@${r.username})` : '');
  await bot.editMessageCaption(
    `✅ <b>Tasdiqlandi!</b>\n👤 ${uname}\n💰 ${fmt(r.amount)} so'm`,
    { chat_id: cbQuery.message.chat.id, message_id: cbQuery.message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
  ).catch(() => {});

  clearSession(cbQuery.from.id);
}

// ── Tahrirlash ────────────────────────────────────────────────────────────────
export async function handleAdminTollEdit(bot, cbQuery) {
  const reqId   = parseInt(cbQuery.data.split(':')[3]);
  const session = getSession(cbQuery.from.id) || {};
  await bot.answerCallbackQuery(cbQuery.id);

  await bot.editMessageCaption('🗑 Screenshot o\'chirildi', {
    chat_id: cbQuery.message.chat.id,
    message_id: cbQuery.message.message_id,
    reply_markup: { inline_keyboard: [] },
  }).catch(() => {});

  const sentMsg = await bot.sendMessage(cbQuery.message.chat.id,
    `📸 Yangi screenshot yuboring:`,
    { reply_markup: { inline_keyboard: [[{ text: '⬅️ Ortga', callback_data: `admin:toll:req:${reqId}` }]] } }
  );
  saveSession(cbQuery.from.id, { ...session, current_state: 'ADMIN_TOLL_SCREENSHOT', last_message_id: sentMsg.message_id, state_data: { req_id: reqId } });
}

// ── Block ─────────────────────────────────────────────────────────────────────
export async function handleAdminTollBlock(bot, cbQuery) {
  const reqId = parseInt(cbQuery.data.split(':')[3]);
  await bot.answerCallbackQuery(cbQuery.id, { text: '🚫 Foydalanuvchi bloklandi' });

  const { rows } = await query(
    `SELECT pr.user_id, u.first_name, u.username
     FROM payment_requests pr JOIN users u ON u.telegram_id = pr.user_id
     WHERE pr.id = $1`, [reqId]
  );
  if (!rows.length) return;
  const { user_id: userId, first_name, username } = rows[0];

  await query(`UPDATE users SET is_blocked = true WHERE telegram_id = $1`, [userId]);
  await query(`UPDATE payment_requests SET status = 'rejected' WHERE id = $1`, [reqId]);
  invalidateUser(userId);

  const name = first_name + (username ? ` (@${username})` : '');
  await bot.editMessageText(
    `🚫 <b>${name}</b> bloklandi.\nMurojaat rad etildi.`,
    {
      chat_id: cbQuery.message.chat.id,
      message_id: cbQuery.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Blockdan ochish', callback_data: `admin:toll:unblock:${userId}` }],
          [{ text: '⬅️ Ortga',          callback_data: 'admin:toll:back' }],
        ],
      },
    }
  ).catch(() => {});
}

// ── Unblock ───────────────────────────────────────────────────────────────────
export async function handleAdminTollUnblock(bot, cbQuery) {
  const userId = parseInt(cbQuery.data.split(':')[3]);
  await bot.answerCallbackQuery(cbQuery.id, { text: '✅ Blockdan ochildi' });

  await query(`UPDATE users SET is_blocked = false WHERE telegram_id = $1`, [userId]);
  invalidateUser(userId);

  const { rows } = await query('SELECT first_name, username FROM users WHERE telegram_id = $1', [userId]);
  const u    = rows[0] || {};
  const name = (u.first_name || 'User') + (u.username ? ` (@${u.username})` : '');

  await bot.editMessageText(
    `✅ <b>${name}</b> blockdan ochildi.`,
    {
      chat_id: cbQuery.message.chat.id,
      message_id: cbQuery.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚫 Qayta block',  callback_data: `admin:toll:reblock:${userId}` }],
          [{ text: '⬅️ Ortga',        callback_data: 'admin:toll:back' }],
        ],
      },
    }
  ).catch(() => {});
}

// ── Qayta block (unblock dan keyin) ───────────────────────────────────────────
export async function handleAdminTollReblock(bot, cbQuery) {
  const userId = parseInt(cbQuery.data.split(':')[3]);
  await bot.answerCallbackQuery(cbQuery.id, { text: '🚫 Qayta bloklandi' });

  await query(`UPDATE users SET is_blocked = true WHERE telegram_id = $1`, [userId]);
  invalidateUser(userId);

  const { rows } = await query('SELECT first_name, username FROM users WHERE telegram_id = $1', [userId]);
  const u    = rows[0] || {};
  const name = (u.first_name || 'User') + (u.username ? ` (@${u.username})` : '');

  await bot.editMessageText(
    `🚫 <b>${name}</b> qayta bloklandi.`,
    {
      chat_id: cbQuery.message.chat.id,
      message_id: cbQuery.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Blockdan ochish', callback_data: `admin:toll:unblock:${userId}` }],
          [{ text: '⬅️ Ortga',          callback_data: 'admin:toll:back' }],
        ],
      },
    }
  ).catch(() => {});
}

// ── Ortga (ro'yxatga) ─────────────────────────────────────────────────────────
export async function handleAdminTollBack(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id);
  clearSession(cbQuery.from.id);

  const { rows } = await query(
    `SELECT pr.id, pr.amount, u.first_name, u.username
     FROM payment_requests pr JOIN users u ON u.telegram_id = pr.user_id
     WHERE pr.status = 'pending' ORDER BY pr.created_at ASC`
  );

  if (!rows.length) {
    await bot.editMessageText(
      `💳 <b>To'lovlar</b>\n\n✅ Kutayotgan murojaat yo'q.`,
      { chat_id: cbQuery.message.chat.id, message_id: cbQuery.message.message_id, parse_mode: 'HTML' }
    ).catch(() => {});
    return;
  }

  const inline_keyboard = rows.map(r => [{
    text: `${r.first_name}${r.username ? ` (@${r.username})` : ''} — ${fmt(r.amount)} so'm`,
    callback_data: `admin:toll:req:${r.id}`,
  }]);

  await bot.editMessageText(
    `💳 <b>Kutayotgan to'lovlar</b> — ${rows.length} ta`,
    { chat_id: cbQuery.message.chat.id, message_id: cbQuery.message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard } }
  ).catch(() => {});
}
