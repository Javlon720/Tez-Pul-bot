'use strict';
import { query } from '../shared/db.js';
import getText from '../locales/index.js';
import { invalidateUser } from '../services/userService.js';
import { showMainMenu } from '../helpers.js';

export async function handleLangChange(bot, msg, user) {
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

export async function handleLangChangeCallback(bot, cbQuery) {
  const chatId     = cbQuery.message.chat.id;
  const telegramId = cbQuery.from.id;
  const lang       = cbQuery.data.split(':')[1];
  if (!['uz', 'ru', 'en'].includes(lang)) { await bot.answerCallbackQuery(cbQuery.id); return; }

  await query('UPDATE users SET lang = $1 WHERE telegram_id = $2', [lang, telegramId]);
  invalidateUser(telegramId);
  await bot.deleteMessage(chatId, cbQuery.message.message_id).catch(() => {});
  await bot.answerCallbackQuery(cbQuery.id);

  const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  await showMainMenu(bot, chatId, rows[0]);
}
