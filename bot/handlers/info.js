'use strict';
import { query } from '../shared/db.js';
import { fmt } from '../shared/utils.js';
import { getMinPayout, getBonusDirect, getSpinMultiply } from '../services/settingsService.js';
import { getSession, saveSession } from '../shared/session.js';
import { deletePrevMsg } from '../helpers.js';

export async function handleInfo(bot, msg, user) {
  const chatId  = msg.chat.id;
  const session = getSession(user.telegram_id) || {};

  const [bonus, minPayout, multiply] = await Promise.all([
    getBonusDirect(), getMinPayout(), getSpinMultiply(),
  ]);

  const { rows: top } = await query(
    'SELECT first_name, username, total_referrals FROM users WHERE NOT is_blocked ORDER BY total_referrals DESC LIMIT 5'
  );
  const medals   = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  const topLines = top.length
    ? top.map((u, i) => {
        const name = (u.first_name || 'User').slice(0, 14);
        const uname = u.username ? ` @${u.username}` : '';
        return `${medals[i]} <b>${name}</b>${uname} — ${fmt(u.total_referrals)} ta`;
      }).join('\n')
    : '— Hali ma\'lumot yo\'q';

  const text =
`ℹ️ <b>Bot haqida to'liq ma'lumot</b>
━━━━━━━━━━━━━━━━━━━━

📌 <b>Qanday ishlaydi?</b>
1️⃣ Do'stingizni havolangiz orqali taklif qiling
2️⃣ Do'stingiz botga kirganida siz <b>+${fmt(bonus)} so'm</b> olasiz
3️⃣ Balansdagi pulni <b>Spin</b> o'yinida ishlating
4️⃣ Yutgan bo'lsa pul <b>×${multiply}</b> qaytadi!

━━━━━━━━━━━━━━━━━━━━
🎰 <b>Spin o'yinlari (yutsa ×${multiply}):</b>
🎰 Slot       — 3 ta bir xil (~6% ehtimol)
⚽ Futbol     — Gol ursa (~20% ehtimol)
🏀 Basketbol  — Savatga tushsa (~40% ehtimol)
🎲 Zar        — 6 chiqsa (~17% ehtimol)
🎯 Darts      — O'rtaga tushsa (~17% ehtimol)

━━━━━━━━━━━━━━━━━━━━
💳 <b>To'lovlar:</b>
• Minimal to'lov: <b>${fmt(minPayout)} so'm</b>
• To'lovlar admin orqali amalga oshiriladi

━━━━━━━━━━━━━━━━━━━━
🏆 <b>Top 5 — Eng ko'p referal:</b>
${topLines}`;

  await deletePrevMsg(bot, chatId, session);
  const sentMsg = await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  saveSession(user.telegram_id, { ...session, last_message_id: sentMsg.message_id });
}
