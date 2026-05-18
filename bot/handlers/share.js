'use strict';
import { query } from '../shared/db.js';
import getText from '../locales/index.js';
import { fmt } from '../shared/utils.js';
import { getBonusDirect } from '../services/settingsService.js';

export async function handleShare(bot, msg, user) {
  const lang  = user.lang || 'uz';
  const link  = `https://t.me/${global.BOT_USERNAME}?start=ref_${user.telegram_id}`;
  const bonus = await getBonusDirect();

  // Taklif qilinganlar ro'yxati
  const { rows: refs } = await query(
    `SELECT u.first_name, u.username
     FROM referrals r
     JOIN users u ON u.telegram_id = r.referred_id
     WHERE r.referrer_id = $1
     ORDER BY r.created_at DESC`,
    [user.telegram_id]
  );

  let refSection = '';
  if (refs.length) {
    const lines = refs.map((r, i) =>
      `${i + 1}. ${r.first_name}${r.username ? ` (@${r.username})` : ''}`
    ).join('\n');
    refSection = `\n\n👥 <b>Siz taklif qilganlar:</b>\n${lines}`;
  } else {
    refSection = `\n\n👥 <b>Siz taklif qilganlar:</b>\n  — Hali hech kim yo'q`;
  }

  const text =
    `👥 <b>Referal tizimi</b>\n\n` +
    `🔗 <b>Sizning havolangiz:</b>\n<code>${link}</code>\n\n` +
    `👫 Taklif qilganlar: <b>${fmt(user.total_referrals)} ta</b>\n` +
    `💰 Balans: <b>${fmt(user.balance)} so'm</b>\n` +
    `🎁 Har yangi a'zo: <b>+${fmt(bonus)} so'm</b>` +
    refSection;

  await bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{
        text: getText(lang, 'share_button'),
        url:  `https://t.me/share/url?url=${encodeURIComponent(link)}`,
      }]],
    },
  });
}
