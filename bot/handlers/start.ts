'use strict';
import { query } from '../shared/db.js';
import getText from '../locales/index.js';
import { getSession, saveSession, clearSession } from '../shared/session.js';
import { invalidateUser } from '../services/userService.js';
import { checkSubscription, buildSubKeyboard, invalidateSubCache } from '../middleware/subscription.js';
import { storePending, processReferral } from '../services/referralService.js';
import { showMainMenu, deletePrevMsg } from '../helpers.js';
import { isLang } from '../shared/utils.js';
import type {
  Bot, CallbackQueryWithMessage, InlineKeyboardButton, Lang, MessageWithFrom, UserRow,
} from '../types.js';

// ─── Captcha timer'lari (telegramId → timeoutId) ──────────────────────────
const captchaTimers = new Map<number, NodeJS.Timeout>();

interface Captcha {
  a: number;
  op: string;
  b: number;
  answer: number;
}

function genCaptcha(): Captcha {
  const ops = ['+', '-', '×'];
  const op  = ops[Math.floor(Math.random() * ops.length)] ?? '+';
  let a: number, b: number, answer: number;
  if (op === '+') {
    a = Math.floor(Math.random() * 20) + 1;
    b = Math.floor(Math.random() * 20) + 1;
    answer = a + b;
  } else if (op === '-') {
    a = Math.floor(Math.random() * 20) + 10;
    b = Math.floor(Math.random() * (a - 1)) + 1;
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 8) + 2;
    b = Math.floor(Math.random() * 8) + 2;
    answer = a * b;
  }
  return { a, op, b, answer };
}

function genChoices(answer: number): number[] {
  const used = new Set<number>([answer]);
  const wrongs: number[] = [];
  let tries = 0;
  while (wrongs.length < 3 && tries < 60) {
    tries++;
    const delta = (Math.floor(Math.random() * 8) + 1) * (Math.random() < 0.5 ? 1 : -1);
    const w = answer + delta;
    if (w > 0 && !used.has(w)) { used.add(w); wrongs.push(w); }
  }
  // Fisher-Yates shuffle
  const all = [answer, ...wrongs];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const ai = all[i] as number;
    all[i] = all[j] as number;
    all[j] = ai;
  }
  return all;
}

export function clearCaptchaTimer(telegramId: number): void {
  const id = captchaTimers.get(telegramId);
  if (id) { clearTimeout(id); captchaTimers.delete(telegramId); }
}

async function sendCaptcha(bot: Bot, chatId: number, telegramId: number, lang: Lang): Promise<void> {
  const { a, op, b, answer } = genCaptcha();
  const choices = genChoices(answer);

  // 2 × 2 inline tugmalar
  const inline_keyboard: InlineKeyboardButton[][] = [
    choices.slice(0, 2).map(n => ({ text: String(n), callback_data: `captcha:${n}` })),
    choices.slice(2, 4).map(n => ({ text: String(n), callback_data: `captcha:${n}` })),
  ];

  const sentMsg = await bot.sendMessage(
    chatId,
    getText(lang, 'captcha_prompt', { a, op, b }),
    { parse_mode: 'HTML', reply_markup: { inline_keyboard } }
  );

  saveSession(telegramId, {
    current_state:   'CAPTCHA',
    last_message_id: sentMsg.message_id,
    state_data:      { answer, lang },
  });

  const timerId = setTimeout(() => {
    captchaTimers.delete(telegramId);
    bot.editMessageText(
      getText(lang, 'captcha_expired'),
      { chat_id: chatId, message_id: sentMsg.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
    ).catch(() => {});
    saveSession(telegramId, { current_state: 'CAPTCHA_EXPIRED' });
  }, 60_000);

  captchaTimers.set(telegramId, timerId);
}

export async function handleCaptchaCallback(
  bot: Bot,
  cbQuery: CallbackQueryWithMessage,
  user: UserRow | null
): Promise<void> {
  const telegramId = cbQuery.from.id;
  const chatId     = cbQuery.message.chat.id;
  const session    = getSession(telegramId) ?? {};
  const { answer, lang: sessionLang } = session.state_data ?? {};
  const lang   = sessionLang || user?.lang || 'uz';
  const chosen = parseInt((cbQuery.data ?? '').split(':')[1] ?? '', 10);

  if (isNaN(chosen) || chosen !== answer) {
    await bot.answerCallbackQuery(cbQuery.id, { text: getText(lang, 'captcha_wrong'), show_alert: true });
    return;
  }

  clearCaptchaTimer(telegramId);
  await bot.answerCallbackQuery(cbQuery.id, { text: getText(lang, 'captcha_passed') });

  // Tugmalarni olib tashla
  bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: chatId, message_id: cbQuery.message.message_id }
  ).catch(() => {});

  // Telefon so'rash bosqichiga o'tish
  const sentMsg = await bot.sendMessage(chatId, getText(lang, 'phone_request'), {
    reply_markup: {
      keyboard: [[{ text: getText(lang, 'phone_share_button'), request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
  saveSession(telegramId, { current_state: 'PHONE', last_message_id: sentMsg.message_id });
}

export async function handleStart(bot: Bot, msg: MessageWithFrom): Promise<void> {
  const chatId     = msg.chat.id;
  const telegramId = msg.from.id;
  const from       = msg.from;

  const { rows } = await query<UserRow>(
    `INSERT INTO users (telegram_id, username, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id) DO UPDATE SET
       username = EXCLUDED.username, first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name, last_active = NOW()
     RETURNING *`,
    [telegramId, from.username || null, from.first_name || 'User', from.last_name || null]
  );
  const user = rows[0];
  if (!user) return;

  bot.deleteMessage(chatId, msg.message_id).catch(() => {});

  if (user.is_blocked) {
    await bot.sendMessage(chatId, getText(user.lang || 'uz', 'blocked'));
    return;
  }

  // Avval captcha timer'ni tozala (agar oldingi urinish bo'lsa)
  clearCaptchaTimer(telegramId);

  const session = getSession(telegramId);
  await deletePrevMsg(bot, chatId, session);

  // Referal havolani parse qil
  const payload = (msg.text || '').split(' ')[1] || '';
  if (payload.startsWith('ref_')) {
    const refId = parseInt(payload.slice(4), 10);
    if (!isNaN(refId) && refId !== telegramId && !user.referred_by && !user.is_verified) {
      const { rows: refRows } = await query<Pick<UserRow, 'telegram_id'>>(
        'SELECT telegram_id FROM users WHERE telegram_id = $1 AND NOT is_blocked', [refId]
      );
      if (refRows.length) storePending(telegramId, refId);
    }
  }

  if (user.is_verified) {
    clearSession(telegramId);
    await showMainMenu(bot, chatId, user);
    return;
  }

  // Til tanlash
  const sentMsg = await bot.sendMessage(chatId, getText('uz', 'select_lang'), {
    reply_markup: {
      inline_keyboard: [[
        { text: "🇺🇿 O'zbek", callback_data: 'lang:uz' },
        { text: '🇷🇺 Русский', callback_data: 'lang:ru' },
        { text: '🇬🇧 English', callback_data: 'lang:en' },
      ]],
    },
  });
  saveSession(telegramId, { current_state: 'LANG_SELECTION', last_message_id: sentMsg.message_id });
}

export async function handleLangSelect(bot: Bot, cbQuery: CallbackQueryWithMessage): Promise<void> {
  const chatId     = cbQuery.message.chat.id;
  const telegramId = cbQuery.from.id;
  const lang       = (cbQuery.data ?? '').split(':')[1];
  if (!isLang(lang)) { await bot.answerCallbackQuery(cbQuery.id); return; }

  await query('UPDATE users SET lang = $1 WHERE telegram_id = $2', [lang, telegramId]);
  invalidateUser(telegramId);
  await bot.answerCallbackQuery(cbQuery.id);
  await bot.deleteMessage(chatId, cbQuery.message.message_id).catch(() => {});

  // Captcha ko'rsat (keyin telefon so'raladi)
  await sendCaptcha(bot, chatId, telegramId, lang);
}

export async function handleCheckSub(bot: Bot, cbQuery: CallbackQueryWithMessage): Promise<void> {
  const chatId     = cbQuery.message.chat.id;
  const telegramId = cbQuery.from.id;

  const { rows } = await query<UserRow>('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  const user = rows[0];
  if (!user) { await bot.answerCallbackQuery(cbQuery.id); return; }
  const lang = user.lang || 'uz';

  invalidateSubCache(telegramId);
  const ok = await checkSubscription(bot, telegramId);
  if (!ok) {
    await bot.answerCallbackQuery(cbQuery.id, { text: getText(lang, 'channel_still_not_subscribed'), show_alert: true });
    return;
  }

  await query('UPDATE users SET is_verified = true WHERE telegram_id = $1', [telegramId]);
  invalidateUser(telegramId);
  await bot.deleteMessage(chatId, cbQuery.message.message_id).catch(() => {});
  clearSession(telegramId);
  await processReferral(bot, telegramId);
  await bot.answerCallbackQuery(cbQuery.id, { text: getText(lang, 'channel_subscribed') });

  const { rows: fresh } = await query<UserRow>('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  const freshUser = fresh[0];
  if (freshUser) await showMainMenu(bot, chatId, freshUser);
}

export async function showChannelCheck(bot: Bot, chatId: number, telegramId: number, lang: Lang): Promise<void> {
  const kb      = await buildSubKeyboard(lang);
  const sentMsg = await bot.sendMessage(chatId, getText(lang, 'channel_not_subscribed'), { reply_markup: kb });
  saveSession(telegramId, { current_state: 'CHANNEL_CHECK', last_message_id: sentMsg.message_id });
}
