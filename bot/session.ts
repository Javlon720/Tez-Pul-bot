'use strict';

import { getSession, saveSession, clearSession } from './shared/session.js';
import { invalidateUser } from './services/userService.js';
import getText from './locales/index.js';
import { formatNumber } from './shared/utils.js';
import type { Bot, Message, Session, UserRow } from './types.js';

type MenuUser = Pick<UserRow, 'lang' | 'balance'>;

async function showMainMenu(bot: Bot, chatId: number, user: MenuUser): Promise<Message> {
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

async function deletePreviousMessage(bot: Bot, chatId: number, session: Session | null | undefined): Promise<void> {
  if (session?.last_message_id) {
    try {
      await bot.deleteMessage(chatId, session.last_message_id);
    } catch {
      // xabar allaqachon o'chirilgan bo'lishi mumkin
    }
  }
}

export {
  getSession, saveSession, clearSession,
  invalidateUser as invalidateUserCache,
  showMainMenu,
  deletePreviousMessage,
};
