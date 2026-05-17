'use strict';
import getText from './locales/index.js';
import { getSession } from './shared/session.js';
import { upsertUser, getFreshUser, touchActive } from './services/userService.js';
import { checkSubscription, buildSubKeyboard } from './middleware/subscription.js';
import { showMainMenu } from './helpers.js';

import { handleStart, handleLangSelect, handleCheckSub }       from './handlers/start.js';
import { handlePhoneContact, handlePhoneText }                  from './handlers/phone.js';
import { handleShare }                                          from './handlers/share.js';
import { handleInfo }                                           from './handlers/info.js';
import { handleReport }                                         from './handlers/report.js';
import { handleLangChange, handleLangChangeCallback }           from './handlers/language.js';
import {
  handleSpinEntry, handleSpinGameSelect, handleSpinBetInput,
  handleSpinPlay, handleSpinAgain, handleSpinChoose, handleSpinBack,
} from './handlers/spin.js';

const SKIP_SUB = new Set(['LANG_SELECTION', 'PHONE', 'CHANNEL_CHECK']);

export async function routeMessage(bot, msg) {
  if (!msg.from) return;
  const telegramId = msg.from.id;
  const chatId     = msg.chat.id;

  const user = await upsertUser(telegramId, msg.from);
  if (!user || user.is_blocked) return;
  touchActive(telegramId);

  if (msg.text?.startsWith('/start')) return handleStart(bot, msg);

  const session = getSession(telegramId);
  const state   = session?.current_state;
  const lang    = user.lang || 'uz';

  // Telefon holati
  if (state === 'PHONE') {
    if (msg.contact)                              return handlePhoneContact(bot, msg, user);
    if (msg.text && !msg.text.startsWith('/'))   return handlePhoneText(bot, msg, user);
    return;
  }

  if (SKIP_SUB.has(state) || !user.is_verified) return;

  // Obuna tekshiruvi
  const ok = await checkSubscription(bot, telegramId);
  if (!ok) {
    const kb = await buildSubKeyboard(lang);
    await bot.sendMessage(chatId, getText(lang, 'sub_required'), { reply_markup: kb });
    return;
  }

  // Spin bet input
  if (state === 'WAITING_SPIN_BET' && msg.text && !msg.text.startsWith('/')) {
    const fresh = await getFreshUser(telegramId);
    return handleSpinBetInput(bot, msg, fresh, session);
  }

  const text = msg.text || '';
  const t    = (key) => getText(lang, key);

  if (text === t('btn_share'))  return handleShare(bot, msg, user);
  if (text === t('btn_info'))   return handleInfo(bot, msg, user);
  if (text === t('btn_report')) { const f = await getFreshUser(telegramId); return handleReport(bot, msg, f); }
  if (text === t('btn_spin'))   { const f = await getFreshUser(telegramId); return handleSpinEntry(bot, msg, f); }
  if (text === t('btn_lang'))   return handleLangChange(bot, msg, user);
}

export async function routeCallback(bot, cbQuery) {
  if (!cbQuery.from) return;
  const telegramId = cbQuery.from.id;
  const data       = cbQuery.data || '';

  const user = await getFreshUser(telegramId); // fresh — spin uchun muhim
  if (!user || user.is_blocked) { await bot.answerCallbackQuery(cbQuery.id).catch(() => {}); return; }

  const lang = user.lang || 'uz';

  if (data.startsWith('lang:'))       return handleLangSelect(bot, cbQuery);
  if (data === 'check_sub')           return handleCheckSub(bot, cbQuery);
  if (!user.is_verified) { await bot.answerCallbackQuery(cbQuery.id); return; }

  if (data.startsWith('spin:')) {
    const ok = await checkSubscription(bot, telegramId);
    if (!ok) { await bot.answerCallbackQuery(cbQuery.id, { text: getText(lang, 'sub_required'), show_alert: true }); return; }
  }

  if (data.startsWith('lang_change:')) return handleLangChangeCallback(bot, cbQuery);
  if (data.startsWith('spin:game:'))   return handleSpinGameSelect(bot, cbQuery, user);
  if (data.startsWith('spin:play:'))   return handleSpinPlay(bot, cbQuery, user);
  if (data.startsWith('spin:again:'))  return handleSpinAgain(bot, cbQuery, user);
  if (data === 'spin:choose')          return handleSpinChoose(bot, cbQuery, user);
  if (data === 'spin:back')            return handleSpinBack(bot, cbQuery, user);

  await bot.answerCallbackQuery(cbQuery.id);
}
