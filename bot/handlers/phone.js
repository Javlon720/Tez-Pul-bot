'use strict';
import { query } from '../shared/db.js';
import getText from '../locales/index.js';
import { invalidateUser } from '../services/userService.js';
import { isUzPhone, normalizePhone } from '../shared/utils.js';
import { showChannelCheck } from './start.js';

async function savePhone(bot, chatId, telegramId, lang, rawPhone) {
  const normalized = normalizePhone(rawPhone);
  if (!normalized || !isUzPhone(normalized)) {
    await bot.sendMessage(chatId, getText(lang, 'phone_wrong_format'));
    return;
  }
  await query('UPDATE users SET phone = $1, phone_verified = true WHERE telegram_id = $2', [normalized, telegramId]);
  invalidateUser(telegramId);
  await bot.sendMessage(chatId, getText(lang, 'phone_success'), {
    reply_markup: { remove_keyboard: true },
  });
  await showChannelCheck(bot, chatId, telegramId, lang);
}

export async function handlePhoneContact(bot, msg, user) {
  await savePhone(bot, msg.chat.id, msg.from.id, user.lang || 'uz', msg.contact?.phone_number);
}

export async function handlePhoneText(bot, msg, user) {
  await savePhone(bot, msg.chat.id, msg.from.id, user.lang || 'uz', msg.text);
}
