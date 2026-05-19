'use strict';
import { query } from '../shared/db.js';
import { fmt } from '../shared/utils.js';
import { getSession, saveSession, clearSession } from '../shared/session.js';
import { getMinPayout } from '../services/settingsService.js';

function maskCard(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 16) return raw;
  return `${d.slice(0, 4)} **** **** ${d.slice(12)}`;
}

function fmtCard(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 16) return raw;
  return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)} ${d.slice(12)}`;
}

// ── Forma matnini yaratish ────────────────────────────────────────────────────
async function formText(data = {}) {
  const min = await getMinPayout();
  const cardLine   = data.card   ? `✅ 💳 ${maskCard(data.card)}`   : `⬜️ 💳 Karta raqami`;
  const nameLine   = data.name   ? `✅ 👤 ${data.name}`             : `⬜️ 👤 Ism Familiya`;
  const amountLine = data.amount ? `✅ 💰 ${fmt(data.amount)} so'm` : `⬜️ 💰 To'lov miqdori`;
  const allFilled  = data.card && data.name && data.amount;

  const kb = [
    [{ text: cardLine,   callback_data: 'pay_req:card'   }],
    [{ text: nameLine,   callback_data: 'pay_req:name'   }],
    [{ text: amountLine, callback_data: 'pay_req:amount' }],
  ];
  if (allFilled) {
    kb.push([
      { text: '✅ Tasdiqlash',  callback_data: 'pay_req:confirm' },
      { text: '✏️ Tahrirlash', callback_data: 'pay_req:edit'    },
    ]);
  }
  kb.push([{ text: '❌ Bekor', callback_data: 'pay_req:cancel' }]);

  return {
    text: `📋 <b>To'lovga murojaat</b>\n\nQuyidagi ma'lumotlarni to'ldiring:\n📌 Minimal: <b>${fmt(min)} so'm</b>`,
    reply_markup: { inline_keyboard: kb },
  };
}

// ── Forma xabarini yuborish yoki edit qilish ──────────────────────────────────
async function renderForm(bot, chatId, msgId, data) {
  const { text, reply_markup } = await formText(data);
  if (msgId) {
    const edited = await bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup,
    }).catch(() => null);
    if (edited) return msgId;
  }
  const sent = await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup });
  return sent.message_id;
}

// ── Maydon so'rash xabari (forma o'zi edit bo'ladi) ───────────────────────────
async function promptField(bot, chatId, msgId, promptText, backData) {
  await bot.editMessageText(promptText, {
    chat_id: chatId, message_id: msgId, parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '⬅️ Ortga', callback_data: backData }]] },
  }).catch(() => {});
}

// ── Entry ─────────────────────────────────────────────────────────────────────
export async function handlePaymentRequest(bot, msg, user) {
  await query(
    `UPDATE payment_requests SET status = 'cancelled' WHERE user_id = $1 AND status = 'pending'`,
    [user.telegram_id]
  );

  const session    = getSession(msg.from.id) || {};
  const existingId = session.form_msg_id || session.last_message_id;

  const newMsgId = await renderForm(bot, msg.chat.id, existingId, {});
  saveSession(msg.from.id, {
    current_state: 'PAY_REQ_FORM',
    form_msg_id:   newMsgId,
    state_data:    {},
  });
}

// ── Maydon tugmalari ──────────────────────────────────────────────────────────
export async function handlePayReqCard(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id);
  const session = getSession(cbQuery.from.id) || {};
  const msgId   = cbQuery.message.message_id;

  await promptField(bot, cbQuery.message.chat.id, msgId,
    `💳 <b>Plastik karta raqamini kiriting:</b>\n<i>Misol: 8600 0000 0000 0000</i>`,
    'pay_req:back'
  );
  saveSession(cbQuery.from.id, { ...session, current_state: 'PAY_REQ_CARD', form_msg_id: msgId });
}

export async function handlePayReqName(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id);
  const session = getSession(cbQuery.from.id) || {};
  const msgId   = cbQuery.message.message_id;

  await promptField(bot, cbQuery.message.chat.id, msgId,
    `👤 <b>Ism va familiyangizni kiriting:</b>\n<i>Misol: Abdullayev Javlonbek</i>`,
    'pay_req:back'
  );
  saveSession(cbQuery.from.id, { ...session, current_state: 'PAY_REQ_NAME', form_msg_id: msgId });
}

export async function handlePayReqAmount(bot, cbQuery, user) {
  await bot.answerCallbackQuery(cbQuery.id);
  const session = getSession(cbQuery.from.id) || {};
  const msgId   = cbQuery.message.message_id;
  const min     = await getMinPayout();
  const { rows } = await query('SELECT balance FROM users WHERE telegram_id = $1', [user.telegram_id]);
  const avail   = parseInt(rows[0]?.balance || 0);

  await promptField(bot, cbQuery.message.chat.id, msgId,
    `💰 <b>Chiqarib olmoqchi bo'lgan summani kiriting:</b>\n\n` +
    `💳 Mavjud balans: <b>${fmt(avail)} so'm</b>\n` +
    `📌 Minimal: <b>${fmt(min)} so'm</b>`,
    'pay_req:back'
  );
  saveSession(cbQuery.from.id, {
    ...session,
    current_state: 'PAY_REQ_AMOUNT',
    form_msg_id:   msgId,
    state_data:    { ...session.state_data, max_amount: avail },
  });
}

// ── Ortga ─────────────────────────────────────────────────────────────────────
export async function handlePayReqBack(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id);
  const session = getSession(cbQuery.from.id) || {};
  const msgId   = cbQuery.message.message_id;
  const data    = session.state_data || {};

  const newMsgId = await renderForm(bot, cbQuery.message.chat.id, msgId, data);
  saveSession(cbQuery.from.id, { ...session, current_state: 'PAY_REQ_FORM', form_msg_id: newMsgId });
}

// ── Tahrirlash ────────────────────────────────────────────────────────────────
export async function handlePayReqEdit(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id, { text: 'Tahrirlash uchun maydonni bosing' });
}

// ── Tasdiqlash ────────────────────────────────────────────────────────────────
export async function handlePayReqConfirm(bot, cbQuery, user) {
  const session = getSession(cbQuery.from.id) || {};
  const { card, name, amount } = session.state_data || {};
  if (!card || !name || !amount) {
    await bot.answerCallbackQuery(cbQuery.id, { text: "❌ Barcha maydonlarni to'ldiring", show_alert: true });
    return;
  }
  await bot.answerCallbackQuery(cbQuery.id);

  await query(
    `INSERT INTO payment_requests (user_id, card_number, full_name, amount) VALUES ($1, $2, $3, $4)`,
    [user.telegram_id, card, name, amount]
  );

  await bot.editMessageText(
    `✅ <b>Murojaatingiz qabul qilindi!</b>\n\n` +
    `💳 Karta: <code>${fmtCard(card)}</code>\n` +
    `👤 FIO: ${name}\n` +
    `💰 Miqdor: <b>${fmt(amount)} so'm</b>\n\n` +
    `⏳ Admin ko'rib chiqadi.`,
    {
      chat_id: cbQuery.message.chat.id,
      message_id: cbQuery.message.message_id,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] },
    }
  ).catch(() => {});

  clearSession(cbQuery.from.id);
}

// ── Bekor ─────────────────────────────────────────────────────────────────────
export async function handlePayReqCancel(bot, cbQuery) {
  await bot.answerCallbackQuery(cbQuery.id);
  await bot.editMessageText('❌ Bekor qilindi.', {
    chat_id: cbQuery.message.chat.id,
    message_id: cbQuery.message.message_id,
    reply_markup: { inline_keyboard: [] },
  }).catch(() => {});
  clearSession(cbQuery.from.id);
}

// ── Matn inputlari ────────────────────────────────────────────────────────────
export async function handlePayReqCardInput(bot, msg) {
  const session = getSession(msg.from.id) || {};
  const digits  = (msg.text || '').replace(/\D/g, '');

  await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});

  if (digits.length !== 16) {
    await bot.answerCallbackQuery?.();
    await bot.editMessageText(
      `💳 <b>Plastik karta raqamini kiriting:</b>\n<i>Misol: 8600 0000 0000 0000</i>\n\n❌ 16 ta raqam kiriting!`,
      {
        chat_id: msg.chat.id, message_id: session.form_msg_id, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Ortga', callback_data: 'pay_req:back' }]] },
      }
    ).catch(() => {});
    return;
  }

  const data     = { ...session.state_data, card: digits };
  const newMsgId = await renderForm(bot, msg.chat.id, session.form_msg_id, data);
  saveSession(msg.from.id, { ...session, current_state: 'PAY_REQ_FORM', form_msg_id: newMsgId, state_data: data });
}

export async function handlePayReqNameInput(bot, msg) {
  const session = getSession(msg.from.id) || {};
  const name    = (msg.text || '').trim();

  await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});

  if (name.length < 5 || !name.includes(' ')) {
    await bot.editMessageText(
      `👤 <b>Ism va familiyangizni kiriting:</b>\n<i>Misol: Abdullayev Javlonbek</i>\n\n❌ Ism va familiya to'liq kiriting!`,
      {
        chat_id: msg.chat.id, message_id: session.form_msg_id, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Ortga', callback_data: 'pay_req:back' }]] },
      }
    ).catch(() => {});
    return;
  }

  const data     = { ...session.state_data, name };
  const newMsgId = await renderForm(bot, msg.chat.id, session.form_msg_id, data);
  saveSession(msg.from.id, { ...session, current_state: 'PAY_REQ_FORM', form_msg_id: newMsgId, state_data: data });
}

export async function handlePayReqAmountInput(bot, msg) {
  const session   = getSession(msg.from.id) || {};
  const amount    = parseInt((msg.text || '').trim(), 10);
  const min       = await getMinPayout();
  const maxAmount = session.state_data?.max_amount || 0;

  await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});

  let errText = null;
  if (isNaN(amount) || amount <= 0) errText = '❌ Noto\'g\'ri summa!';
  else if (amount < min)            errText = `❌ Minimal: <b>${fmt(min)} so'm</b>`;
  else if (amount > maxAmount)      errText = `❌ Balansda: <b>${fmt(maxAmount)} so'm</b>`;

  if (errText) {
    await bot.editMessageText(
      `💰 <b>Summani kiriting:</b>\n💳 Mavjud: <b>${fmt(maxAmount)} so'm</b>\n\n${errText}`,
      {
        chat_id: msg.chat.id, message_id: session.form_msg_id, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Ortga', callback_data: 'pay_req:back' }]] },
      }
    ).catch(() => {});
    return;
  }

  const data     = { ...session.state_data, amount };
  const newMsgId = await renderForm(bot, msg.chat.id, session.form_msg_id, data);
  saveSession(msg.from.id, { ...session, current_state: 'PAY_REQ_FORM', form_msg_id: newMsgId, state_data: data });
}
