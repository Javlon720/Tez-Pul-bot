'use strict';

const uz = {
  // Umumiy
  error:   '❌ Xato yuz berdi. Iltimos, qayta urinib ko\'ring.',
  blocked: '🚫 Siz bloklandingiz.',

  select_lang: '🌐 Tilni tanlang:',

  // Telefon
  phone_request:      '📱 Telefon raqamingizni ulashing yoki yozing (+998XXXXXXXXX):',
  phone_share_button: '📱 Raqamimni ulashish',
  phone_wrong_format: '❌ Noto\'g\'ri format. +998XXXXXXXXX shaklida kiriting:',
  phone_success:      '✅ Telefon tasdiqlandi!',

  // Kanal
  channel_not_subscribed:       '📢 Botdan foydalanish uchun quyidagi kanallarga obuna bo\'ling:',
  channel_check_button:         '✅ Obunani tekshirish',
  channel_subscribed:           '✅ Barcha obunalar tasdiqlandi!',
  channel_still_not_subscribed: '❌ Siz hali barcha kanallarga obuna bo\'lmadingiz.',

  // Bosh menyu
  main_menu:  '👇 Asosiy menyu\n\n💰 Balansingiz: <b>{balance} so\'m</b>',
  btn_share:  '👥 Do\'stlar',
  btn_info:   'ℹ️ Ma\'lumot',
  btn_report: '📊 Hisobot',
  btn_spin:   '🎰 Spin',
  btn_lang:   '🌐 Til',

  // Referal
  referral_info:   '👥 <b>Referal tizimi</b>\n\n🔗 Sizning havolangiz:\n<code>https://t.me/{username}?start=ref_{userId}</code>\n\n👫 Taklif qilganlar: <b>{referrals} ta</b>\n💰 Balans: <b>{balance} so\'m</b>\n\n📌 Har yangi a\'zo sizga <b>+{bonus} so\'m</b> keltiradi!',
  share_button:    '📤 Do\'stlarga ulashish',
  referral_notify: '🎉 <b>{name}</b> sizning havolangiz orqali ro\'yxatdan o\'tdi!\n\n💰 +{bonus} so\'m\n💳 Balans: <b>{balance} so\'m</b>',

  // Hisobot
  report_text: '📊 <b>Sizning hisobotingiz</b>\n\n👥 Taklif qilganlar: <b>{referrals} ta</b>\n💰 Jami balans: <b>{balance} so\'m</b>\n✅ To\'langan: <b>{paid} so\'m</b>\n⏳ Kutilmoqda: <b>{unpaid} so\'m</b>\n🎰 Spin o\'yinlari: <b>{spins_used} ta</b>\n🏆 Spin yutug\'i: <b>{spin_winnings} so\'m</b>',

  // Spin
  spin_invalid_amount:   '❌ Noto\'g\'ri summa! Minimum {min} so\'m kiriting.',
  spin_not_enough_money: '❌ Balansingizda yetarli mablag\' yo\'q!\nKerakli: <b>{bet} so\'m</b>',
  spin_locked:           '⏳ Iltimos, oldingi o\'yin tugaguncha kuting...',

  sub_required: '📢 Botdan foydalanish uchun kanalga obuna bo\'ling.\n\nObuna bo\'lgach "✅ Tekshirish" tugmasini bosing.',

  // Admin
  admin_menu: '👨‍💻 <b>Admin Panel</b>\n\nQaysi bo\'limni tanlaysiz?',

  bonus_amount:       '💰 <b>{user}</b> ga necha so\'m bonus yuborasiz?',
  bonus_success:      '✅ <b>{user}</b> ga <b>{amount} so\'m</b> bonus yuborildi!\nYangi balans: <b>{balance} so\'m</b>',
  bonus_not_found:    '❌ Foydalanuvchi topilmadi.',
  bonus_invalid:      '❌ Noto\'g\'ri summa. Musbat raqam kiriting.',
  user_bonus_notify:  '🎁 Admindan sizga <b>{amount} so\'m</b> bonus!\n💳 Balans: <b>{balance} so\'m</b>',

  penalty_success:    '⚠️ <b>{user}</b> dan <b>{amount} so\'m</b> jarima yechildi!\nYangi balans: <b>{balance} so\'m</b>',
  penalty_not_enough: '❌ Foydalanuvchi balansida yetarli mablag\' yo\'q (balans: {balance} so\'m).',
  user_penalty_notify:'⚠️ Hisobingizdan <b>{amount} so\'m</b> jarima yechildi.\n💳 Yangi balans: <b>{balance} so\'m</b>',

  broadcast_prompt:  '📢 <b>Xabar Yuborish</b>\n\nBarcha foydalanuvchilarga yuboriladi.\nXabar matnini kiriting:',
  broadcast_preview: '📢 <b>Ko\'rinishi:</b>\n\n{message}\n\nYuborishga tayyormisiz?',
  broadcast_confirm: '✅ Yuborish',
  broadcast_cancel:  '❌ Bekor qilish',
  broadcast_done:    '✅ Yuborildi!\n\n📊 Jami: {total}\n✅ Yuborildi: {sent}\n❌ Xato: {failed}',

  channels_title:  '📡 <b>Majburiy obunalar:</b>\n\n{list}',
  btn_add_channel: '➕ Kanal qo\'shish',
  channel_added:   '✅ Kanal muvaffaqiyatli qo\'shildi!',
  channel_deleted: '🗑 Kanal o\'chirildi!',
  channel_invalid: '❌ Kanal topilmadi yoki bot u yerda admin emas!',
  prompt_channel:  'Kanal ID yoki username kiriting\n(@kanal_nomi yoki -100123456789):',

  min_payout_current: 'Hozirgi minimal to\'lov: <b>{min} so\'m</b>',
  min_payout_prompt:  'Yangi minimal to\'lov miqdorini kiriting:',
  min_payout_updated: '✅ Minimal to\'lov <b>{amount} so\'m</b> etib belgilandi.',
  min_payout_invalid: '❌ Noto\'g\'ri summa.',

  bonus_direct_current: 'Hozirgi referal bonus: <b>{amount} so\'m</b>',
  bonus_direct_prompt:  'Yangi referal bonus miqdorini kiriting (so\'mda):',
  bonus_direct_updated: '✅ Referal bonus <b>{amount} so\'m</b> etib belgilandi.',

  spin_multiply_current: 'Hozirgi spin ko\'paytmasi: <b>×{multiply}</b>',
  spin_multiply_prompt:  'Yangi spin ko\'paytmasini kiriting (masalan: 2 yoki 3):',
  spin_multiply_updated: '✅ Spin ko\'paytmasi <b>×{multiply}</b> etib belgilandi.',

  captcha_prompt:  '🤖 <b>Anti-bot tekshiruvi</b>\n\n<b>{a} {op} {b} = ?</b>\n\n⏱ <b>60 soniya</b> ichida to\'g\'ri javobni tanlang:',
  captcha_wrong:   '❌ Noto\'g\'ri javob! Qayta urinib ko\'ring.',
  captcha_expired: '⏰ <b>Vaqt tugadi!</b>\n\nBotdan foydalanish uchun /start yuboring.',
  captcha_passed:  '✅ To\'g\'ri!',

  action_cancelled: '❌ Bekor qilindi.',
  btn_back:         '🔙 Orqaga',
  btn_cancel:       '❌ Bekor qilish',
};

const ru = {
  ...uz,
  select_lang: '🌐 Выберите язык:',
  blocked:     '🚫 Вы заблокированы.',
  error:       '❌ Произошла ошибка. Попробуйте снова.',
  main_menu:   '👇 Главное меню\n\n💰 Ваш баланс: <b>{balance} сум</b>',
  btn_share: '👥 Друзья', btn_info: 'ℹ️ Информация', btn_report: '📊 Отчёт', btn_spin: '🎰 Спин', btn_lang: '🌐 Язык',
  captcha_prompt:  '🤖 <b>Антибот проверка</b>\n\n<b>{a} {op} {b} = ?</b>\n\n⏱ Выберите правильный ответ за <b>60 секунд</b>:',
  captcha_wrong:   '❌ Неверный ответ! Попробуйте снова.',
  captcha_expired: '⏰ <b>Время истекло!</b>\n\nОтправьте /start чтобы начать заново.',
  captcha_passed:  '✅ Верно!',
  referral_info: '👥 <b>Реферальная система</b>\n\n🔗 Ваша ссылка:\n<code>https://t.me/{username}?start=ref_{userId}</code>\n\n👫 Приглашено: <b>{referrals}</b>\n💰 Баланс: <b>{balance} сум</b>\n\n📌 За каждого нового пользователя вы получите <b>+{bonus} сум</b>!',
  share_button: '📤 Поделиться',
  referral_notify: '🎉 <b>{name}</b> зарегистрировался по вашей ссылке!\n\n💰 +{bonus} сум\n💳 Баланс: <b>{balance} сум</b>',
  report_text: '📊 <b>Ваш отчёт</b>\n\n👥 Приглашено: <b>{referrals}</b>\n💰 Баланс: <b>{balance} сум</b>\n✅ Выплачено: <b>{paid} сум</b>\n⏳ Ожидает: <b>{unpaid} сум</b>\n🎰 Игр: <b>{spins_used}</b>\n🏆 Выигрыш: <b>{spin_winnings} сум</b>',
  user_bonus_notify: '🎁 Администратор начислил вам <b>{amount} сум</b>!\n💳 Баланс: <b>{balance} сум</b>',
  user_penalty_notify: '⚠️ С вашего счёта списано <b>{amount} сум</b>.\n💳 Новый баланс: <b>{balance} сум</b>',
};

const en = {
  ...uz,
  select_lang: '🌐 Select language:',
  blocked:     '🚫 You are blocked.',
  error:       '❌ An error occurred. Please try again.',
  main_menu:   '👇 Main menu\n\n💰 Your balance: <b>{balance} UZS</b>',
  btn_share: '👥 Friends', btn_info: 'ℹ️ Info', btn_report: '📊 Report', btn_spin: '🎰 Spin', btn_lang: '🌐 Language',
  captcha_prompt:  '🤖 <b>Anti-bot check</b>\n\n<b>{a} {op} {b} = ?</b>\n\n⏱ Choose the correct answer within <b>60 seconds</b>:',
  captcha_wrong:   '❌ Wrong answer! Try again.',
  captcha_expired: '⏰ <b>Time\'s up!</b>\n\nSend /start to begin.',
  captcha_passed:  '✅ Correct!',
  referral_info: '👥 <b>Referral System</b>\n\n🔗 Your link:\n<code>https://t.me/{username}?start=ref_{userId}</code>\n\n👫 Invited: <b>{referrals}</b>\n💰 Balance: <b>{balance} UZS</b>\n\n📌 You earn <b>+{bonus} UZS</b> for each new user!',
  share_button: '📤 Share',
  referral_notify: '🎉 <b>{name}</b> joined via your link!\n\n💰 +{bonus} UZS\n💳 Balance: <b>{balance} UZS</b>',
  report_text: '📊 <b>Your Report</b>\n\n👥 Invited: <b>{referrals}</b>\n💰 Balance: <b>{balance} UZS</b>\n✅ Paid: <b>{paid} UZS</b>\n⏳ Pending: <b>{unpaid} UZS</b>\n🎰 Games: <b>{spins_used}</b>\n🏆 Winnings: <b>{spin_winnings} UZS</b>',
  user_bonus_notify: '🎁 Admin sent you <b>{amount} UZS</b> bonus!\n💳 Balance: <b>{balance} UZS</b>',
  user_penalty_notify: '⚠️ <b>{amount} UZS</b> was deducted from your account.\n💳 New balance: <b>{balance} UZS</b>',
};

const locales = { uz, ru, en };

export default function getText(lang, key, params = {}) {
  const map  = locales[lang] || locales.uz;
  let   text = map[key] !== undefined ? String(map[key]) : key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? ''));
  }
  return text;
}
