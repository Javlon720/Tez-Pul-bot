'use strict';
import getText from '../locales/index.js';
import { fmt } from '../shared/utils.js';
import { getBonusDirect } from '../services/settingsService.js';

export async function handleShare(bot, msg, user) {
  const lang  = user.lang || 'uz';
  const link  = `https://t.me/${global.BOT_USERNAME}?start=ref_${user.telegram_id}`;
  const bonus = await getBonusDirect();

  await bot.sendMessage(msg.chat.id,
    getText(lang, 'referral_info', {
      username:  global.BOT_USERNAME,
      userId:    user.telegram_id,
      referrals: fmt(user.total_referrals),
      balance:   fmt(user.balance),
      bonus:     fmt(bonus),
    }),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{
          text: getText(lang, 'share_button'),
          url:  `https://t.me/share/url?url=${encodeURIComponent(link)}`,
        }]],
      },
    }
  );
}
