'use strict';

import { query } from '../shared/db.js';
import { getSession, saveSession, clearSession } from '../shared/session.js';
import { invalidateUser } from '../services/userService.js';
import getText from '../locales/index.js';
import { formatNumber } from '../shared/utils.js';

async function showMainMenu(bot, chatId, user) {
  const lang = user.lang || 'uz';
  return bot.sendMessage(
    chatId,
    getText(lang, 'main_menu', { balance: formatNumber(user.balance || 0) }),
    {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: getText(lang, 'btn_share') }, { text: getText(lang, 'btn_info') }],
          [{ text: getText(lang, 'btn_report') }, { text: getText(lang, 'btn_spin') }],
          [{ text: getText(lang, 'btn_lang') }],
        ],
        resize_keyboard: true,
      },
    }
  );
}

async function deletePreviousMessage(bot, chatId, session) {
  if (session?.last_message_id) {
    try {
      await bot.deleteMessage(chatId, session.last_message_id);
    } catch (_) {}
  }
}

export {
  getSession, saveSession, clearSession,
  invalidateUser as invalidateUserCache,
  showMainMenu,
  deletePreviousMessage,
};
