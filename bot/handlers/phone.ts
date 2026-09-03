'use strict';
import { query } from '../shared/db.js';
import getText from '../locales/index.js';
import { invalidateUser } from '../services/userService.js';
import { isUzPhone, normalizePhone } from '../shared/utils.js';
import { showChannelCheck } from './start.js';
import type { Bot, Lang, MessageWithFrom, UserRow } from '../types.js';

async function savePhone(
  bot: Bot,
  chatId: number,
  telegramId: number,
  lang: Lang,
  rawPhone: string | null | undefined
): Promise<void> {
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

export async function handlePhoneContact(bot: Bot, msg: MessageWithFrom, user: UserRow): Promise<void> {
  await savePhone(bot, msg.chat.id, msg.from.id, user.lang || 'uz', msg.contact?.phone_number);
}

export async function handlePhoneText(bot: Bot, msg: MessageWithFrom, user: UserRow): Promise<void> {
  await savePhone(bot, msg.chat.id, msg.from.id, user.lang || 'uz', msg.text);
}
