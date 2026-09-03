'use strict';
import { query } from '../shared/db.js';
import getText from '../locales/index.js';
import { invalidateUser } from '../services/userService.js';
import { showMainMenu } from '../helpers.js';
import { isLang } from '../shared/utils.js';
import type { Bot, CallbackQueryWithMessage, MessageWithFrom, UserRow } from '../types.js';

export async function handleLangChange(bot: Bot, msg: MessageWithFrom, user: UserRow): Promise<void> {
  const lang = user.lang || 'uz';
  await bot.sendMessage(msg.chat.id, getText(lang, 'select_lang'), {
    reply_markup: {
      inline_keyboard: [[
        { text: "🇺🇿 O'zbek", callback_data: 'lang_change:uz' },
        { text: '🇷🇺 Русский', callback_data: 'lang_change:ru' },
        { text: '🇬🇧 English', callback_data: 'lang_change:en' },
      ]],
    },
  });
}

export async function handleLangChangeCallback(bot: Bot, cbQuery: CallbackQueryWithMessage): Promise<void> {
  const chatId     = cbQuery.message.chat.id;
  const telegramId = cbQuery.from.id;
  const lang       = (cbQuery.data ?? '').split(':')[1];
  if (!isLang(lang)) { await bot.answerCallbackQuery(cbQuery.id); return; }

  await query('UPDATE users SET lang = $1 WHERE telegram_id = $2', [lang, telegramId]);
  invalidateUser(telegramId);
  await bot.deleteMessage(chatId, cbQuery.message.message_id).catch(() => {});
  await bot.answerCallbackQuery(cbQuery.id);

  const { rows } = await query<UserRow>('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  const user = rows[0];
  if (user) await showMainMenu(bot, chatId, user);
}
