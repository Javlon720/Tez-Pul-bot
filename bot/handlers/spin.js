'use strict';
import { query, transaction } from '../shared/db.js';
import { fmt } from '../shared/utils.js';
import getText from '../locales/index.js';
import { getSession, saveSession, clearSession } from '../shared/session.js';
import { invalidateUser } from '../services/userService.js';
import { getSpinMinBet, getSpinMultiply } from '../services/settingsService.js';
import { showMainMenu, deletePrevMsg } from '../helpers.js';

// Telegram dice o'yinlari va yutish qiymatlari
const GAMES = {
  slot:       { emoji: '🎰', wins: [1, 22, 43, 64], label: 'Slot',       waitMs: 3000 },
  football:   { emoji: '⚽', wins: [5],              label: 'Futbol',     waitMs: 2500 },
  basketball: { emoji: '🏀', wins: [4, 5],           label: 'Basketbol',  waitMs: 2500 },
  dice:       { emoji: '🎲', wins: [6],              label: 'Zar',        waitMs: 2000 },
  darts:      { emoji: '🎯', wins: [6],              label: 'Darts',      waitMs: 2500 },
};

// Bir vaqtda bir o'yin — lock
const locks = new Map();
function acquireLock(id) {
  if (locks.has(id)) return false;
  locks.set(id, true);
  setTimeout(() => locks.delete(id), 15000);
  return true;
}
function releaseLock(id) { locks.delete(id); }

async function getTop() {
  const { rows } = await query(
    'SELECT first_name, username, total_referrals FROM users WHERE NOT is_blocked ORDER BY total_referrals DESC LIMIT 5'
  );
  return rows;
}

// 1. O'yin tanlash sahifasi
export async function handleSpinEntry(bot, msg, user) {
  const chatId  = msg.chat.id;
  const lang    = user.lang || 'uz';
  const session = getSession(user.telegram_id) || {};

  await deletePrevMsg(bot, chatId, session);

  const [top, multiply] = await Promise.all([getTop(), getSpinMultiply()]);
  const medals  = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  const topText = top.length
    ? top.map((u, i) => `${medals[i]} <b>${(u.first_name||'User').slice(0,12)}</b>${u.username?` (@${u.username})`:''} — ${fmt(u.total_referrals)} ta`).join('\n')
    : '— Hali ma\'lumot yo\'q';

  const text =
`🎰 <b>Spin O'yin Markazi</b>
━━━━━━━━━━━━━━━━━━━━

💰 <b>Balansingiz:</b> ${fmt(user.balance)} so'm

<b>🎮 O'yinlar (yutsa ×${multiply}):</b>
🎰 Slot       — 3 ta bir xil (~6%)
⚽ Futbol     — Gol ursa (~20%)
🏀 Basketbol  — Savatga tushsa (~40%)
🎲 Zar        — 6 chiqsa (~17%)
🎯 Darts      — O'rtaga tushsa (~17%)

<b>📋 Qoidalar:</b>
✓ Yutsa → tikkan pul ×${multiply} qaytadi
✓ Yutqazsa → tikkan pul yo'q bo'ladi

━━━━━━━━━━━━━━━━━━━━
🏆 <b>Top 5 — Eng ko'p referal:</b>
${topText}`;

  const sentMsg = await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎰 Slot', callback_data: 'spin:game:slot' }, { text: '⚽ Futbol', callback_data: 'spin:game:football' }],
        [{ text: '🏀 Basketbol', callback_data: 'spin:game:basketball' }, { text: '🎲 Zar', callback_data: 'spin:game:dice' }, { text: '🎯 Darts', callback_data: 'spin:game:darts' }],
        [{ text: '🔙 Orqaga', callback_data: 'spin:back' }],
      ],
    },
  });
  saveSession(user.telegram_id, { current_state: 'WAITING_SPIN_GAME', last_message_id: sentMsg.message_id, state_data: {} });
}

// 2. O'yin tanlandi → bet miqdori so'ra
export async function handleSpinGameSelect(bot, cbQuery, user) {
  const chatId  = cbQuery.message.chat.id;
  const gameKey = cbQuery.data.split(':')[2];
  const game    = GAMES[gameKey];
  if (!game) { await bot.answerCallbackQuery(cbQuery.id); return; }

  await bot.answerCallbackQuery(cbQuery.id);
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: cbQuery.message.message_id }).catch(() => {});

  const [minBet, multiply] = await Promise.all([getSpinMinBet(), getSpinMultiply()]);

  const sentMsg = await bot.sendMessage(chatId,
    `${game.emoji} <b>${game.label} o'yini tanlandi!</b>\n\n` +
    `💰 Balansingiz: <b>${fmt(user.balance)} so'm</b>\n\n` +
    `<b>💵 Tikish miqdorini kiriting</b>\n` +
    `Minimum: ${fmt(minBet)} so'm\n` +
    `Yutsa: tikish × ${multiply} qaytadi\n\n` +
    `Misol: <code>5000</code>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'spin:back' }]] } }
  );
  saveSession(cbQuery.from.id, { current_state: 'WAITING_SPIN_BET', last_message_id: sentMsg.message_id, state_data: { game: gameKey } });
}

// 3. Bet miqdori matn orqali kiritildi
export async function handleSpinBetInput(bot, msg, user, session) {
  const chatId  = msg.chat.id;
  const gameKey = session?.state_data?.game || 'slot';
  const game    = GAMES[gameKey] || GAMES.slot;
  const amount  = parseInt(msg.text?.trim(), 10);

  bot.deleteMessage(chatId, msg.message_id).catch(() => {});

  const [minBet, multiply] = await Promise.all([getSpinMinBet(), getSpinMultiply()]);

  if (isNaN(amount) || amount < minBet) {
    const sentMsg = await bot.sendMessage(chatId,
      getText(user.lang || 'uz', 'spin_invalid_amount', { min: fmt(minBet) }),
      { reply_markup: { inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'spin:back' }]] } }
    );
    await deletePrevMsg(bot, chatId, session);
    saveSession(msg.from.id, { ...session, last_message_id: sentMsg.message_id });
    return;
  }

  if (amount > parseInt(user.balance || 0)) {
    const sentMsg = await bot.sendMessage(chatId,
      getText(user.lang || 'uz', 'spin_not_enough_money', { bet: fmt(amount) }),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'spin:back' }]] } }
    );
    await deletePrevMsg(bot, chatId, session);
    saveSession(msg.from.id, { ...session, last_message_id: sentMsg.message_id });
    return;
  }

  const sentMsg = await bot.sendMessage(chatId,
    `${game.emoji} <b>${game.label} o'yini</b>\n\n` +
    `💰 Tikish: <b>${fmt(amount)} so'm</b>\n` +
    `🏆 Yutsa: <b>${fmt(amount * multiply)} so'm</b> (×${multiply})\n` +
    `💳 Balans: <b>${fmt(user.balance)} so'm</b>\n\n` +
    `<b>O'ynashga tayyormisiz?</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `${game.emoji} O'ynash — ${fmt(amount)} so'm`, callback_data: `spin:play:${gameKey}:${amount}` }],
          [{ text: '🔙 Orqaga', callback_data: 'spin:back' }],
        ],
      },
    }
  );
  await deletePrevMsg(bot, chatId, session);
  saveSession(msg.from.id, { current_state: null, last_message_id: sentMsg.message_id, state_data: { game: gameKey } });
}

// 4. O'ynash tugmasi bosildi
export async function handleSpinPlay(bot, cbQuery, user) {
  const chatId     = cbQuery.message.chat.id;
  const telegramId = cbQuery.from.id;
  const lang       = user.lang || 'uz';
  const parts      = cbQuery.data.split(':');
  const gameKey    = parts[2];
  const amount     = parseInt(parts[3], 10);
  const game       = GAMES[gameKey] || GAMES.slot;

  if (isNaN(amount)) { await bot.answerCallbackQuery(cbQuery.id); return; }

  if (!acquireLock(telegramId)) {
    await bot.answerCallbackQuery(cbQuery.id, { text: getText(lang, 'spin_locked'), show_alert: true });
    return;
  }

  await bot.answerCallbackQuery(cbQuery.id);
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: cbQuery.message.message_id }).catch(() => {});

  try {
    const multiply = await getSpinMultiply();

    // Yangi balansni tekshir
    const { rows: fresh } = await query('SELECT balance FROM users WHERE telegram_id = $1', [telegramId]);
    if (parseInt(fresh[0]?.balance || 0) < amount) {
      releaseLock(telegramId);
      await bot.sendMessage(chatId, getText(lang, 'spin_not_enough_money', { bet: fmt(amount) }), { parse_mode: 'HTML' });
      return;
    }

    // Betni yechi
    await query('UPDATE users SET balance = balance - $1 WHERE telegram_id = $2', [amount, telegramId]);

    // Dice animatsiyasi
    const diceMsg = await bot.sendDice(chatId, { emoji: game.emoji });
    const diceVal = diceMsg.dice.value;
    await new Promise(r => setTimeout(r, game.waitMs));

    const isWin  = game.wins.includes(diceVal);
    const prize  = isWin ? amount * multiply : 0;

    await transaction(async (client) => {
      if (isWin) {
        await client.query('UPDATE users SET balance = balance + $1 WHERE telegram_id = $2', [prize, telegramId]);
      }
      await client.query(
        `INSERT INTO spin_sessions (user_id, game, bet_amount, result, prize_amount, dice_value)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [telegramId, gameKey, amount, isWin ? 'win' : 'lose', prize, diceVal]
      );
      await client.query('UPDATE users SET spins_used = spins_used + 1 WHERE telegram_id = $1', [telegramId]);
    });

    invalidateUser(telegramId);

    const { rows: nb } = await query('SELECT balance FROM users WHERE telegram_id = $1', [telegramId]);
    const newBal = fmt(nb[0]?.balance || 0);

    const resultText = isWin
      ? `🎉 <b>TABRIKLAYMIZ! YUTDINGIZ!</b> ${game.emoji}\n\n` +
        `<b>${game.label}</b> o'yini\n\n` +
        `💰 Tikdingiz: <b>${fmt(amount)} so'm</b>\n` +
        `🤑 Yutdingiz: <b>+${fmt(prize)} so'm</b> (×${multiply})\n` +
        `💳 Yangi balans: <b>${newBal} so'm</b>`
      : `😔 <b>Omad kelmadi!</b> ${game.emoji}\n\n` +
        `<b>${game.label}</b> o'yini\n\n` +
        `💵 Yutqazdingiz: <b>-${fmt(amount)} so'm</b>\n` +
        `💳 Yangi balans: <b>${newBal} so'm</b>\n\n` +
        `🍀 Keyingi safar omad kulib boqadi!`;

    await bot.sendMessage(chatId, resultText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `${game.emoji} Yana o'ynash`, callback_data: `spin:again:${gameKey}` }],
          [{ text: '🎮 Boshqa o\'yin',           callback_data: 'spin:choose'           }],
          [{ text: '🔙 Bosh menyu',              callback_data: 'spin:back'             }],
        ],
      },
    });
  } catch (err) {
    console.error('[Spin] Xato:', err.message);
  } finally {
    releaseLock(telegramId);
  }
}

// 5. Yana o'ynash
export async function handleSpinAgain(bot, cbQuery, user) {
  const chatId  = cbQuery.message.chat.id;
  const gameKey = cbQuery.data.split(':')[2] || 'slot';
  const game    = GAMES[gameKey] || GAMES.slot;

  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: cbQuery.message.message_id }).catch(() => {});
  await bot.answerCallbackQuery(cbQuery.id);

  const [minBet, multiply] = await Promise.all([getSpinMinBet(), getSpinMultiply()]);

  const sentMsg = await bot.sendMessage(chatId,
    `${game.emoji} <b>${game.label}</b> o'yini\n\n` +
    `💰 Balansingiz: <b>${fmt(user.balance)} so'm</b>\n\n` +
    `<b>💵 Tikish miqdorini kiriting</b>\n` +
    `Minimum: ${fmt(minBet)} so'm\n\n` +
    `Misol: <code>5000</code>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'spin:back' }]] } }
  );
  saveSession(cbQuery.from.id, { current_state: 'WAITING_SPIN_BET', last_message_id: sentMsg.message_id, state_data: { game: gameKey } });
}

// 6. Boshqa o'yin tanlash
export async function handleSpinChoose(bot, cbQuery, user) {
  const chatId = cbQuery.message.chat.id;
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: cbQuery.message.message_id }).catch(() => {});
  await bot.answerCallbackQuery(cbQuery.id);
  await handleSpinEntry(bot, { chat: { id: chatId } }, user);
}

// 7. Bosh menyuga qaytish
export async function handleSpinBack(bot, cbQuery, user) {
  const chatId = cbQuery.message.chat.id;
  await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: cbQuery.message.message_id }).catch(() => {});
  await bot.answerCallbackQuery(cbQuery.id);
  clearSession(cbQuery.from.id);
  await showMainMenu(bot, chatId, user);
}
