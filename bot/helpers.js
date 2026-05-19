'use strict';
import getText from './locales/index.js';
import { fmt } from './shared/utils.js';

export async function showMainMenu(bot, chatId, user) {
  const lang = user.lang || 'uz';
  return bot.sendMessage(chatId,
    getText(lang, 'main_menu', { balance: fmt(user.balance || 0) }),
    {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: getText(lang, 'btn_share') },   { text: getText(lang, 'btn_info') }],
          [{ text: getText(lang, 'btn_report') },  { text: getText(lang, 'btn_spin') }],
          [{ text: getText(lang, 'btn_pay_req') }],
          [{ text: getText(lang, 'btn_lang') }],
        ],
        resize_keyboard: true,
      },
    }
  );
}

export async function deletePrevMsg(bot, chatId, session) {
  if (session?.last_message_id) {
    await bot.deleteMessage(chatId, session.last_message_id).catch(() => {});
  }
}
