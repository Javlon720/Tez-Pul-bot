# TezPul Referal Bot v2

Telegram referal boti. Foydalanuvchilar do'stlarini taklif qilib pul ishlashadi va Spin o'yinida ko'paytirishadi.

## Tuzilishi

```
bot/
├── index.js               # Kirish nuqtasi, polling
├── router.js              # User xabar/callback yo'naltirish
├── helpers.js             # showMainMenu, deletePrevMsg
├── shared/
│   ├── db.js              # PostgreSQL pool, query, transaction
│   ├── session.js         # In-memory session (30 daqiqa TTL)
│   ├── cache.js           # User cache (5 daqiqa TTL)
│   └── utils.js           # fmt, isUzPhone, normalizePhone
├── middleware/
│   ├── adminAuth.js       # isAdmin() tekshiruvi
│   └── subscription.js    # Kanal obuna tekshiruvi + cache
├── services/
│   ├── userService.js     # getUser, upsertUser, invalidateUser
│   ├── settingsService.js # getSetting/setSetting + qulaylik funksiyalar
│   └── referralService.js # storePending, processReferral
├── handlers/
│   ├── admin/index.js     # Barcha admin funksiyalar
│   ├── start.js           # /start, til tanlash, obuna tekshiruvi
│   ├── phone.js           # Telefon raqam qabul qilish
│   ├── share.js           # Referal havola
│   ├── info.js            # Bot haqida + top referallar
│   ├── report.js          # Foydalanuvchi hisoboti
│   ├── language.js        # Til o'zgartirish
│   └── spin.js            # O'yinlar (slot, futbol, basketbol, zar, darts)
├── locales/index.js       # uz / ru / en tarjimalar
└── db/schema.sql          # PostgreSQL jadvallar
```

## O'rnatish

```bash
cp .env.example .env
# .env ni to'ldiring

npm install

# DB yaratish
psql -U postgres -c "CREATE DATABASE tezpulbot;"
npm run db:init

npm start
# yoki development uchun:
npm run dev
```

## .env o'zgaruvchilari

| Kalit           | Tavsif                              |
|-----------------|-------------------------------------|
| `BOT_TOKEN`     | BotFather dan olingan token         |
| `ADMIN_IDS`     | Admin Telegram IDlar (vergul bilan) |
| `DB_*`          | PostgreSQL ulanish ma'lumotlari     |
| `BONUS_DIRECT`  | Boshlang'ich referal bonusi (so'm)  |

## Admin Panel

`/admin` → Admin menyusi:

| Tugma                | Funksiya                                    |
|----------------------|---------------------------------------------|
| 📊 Statistika        | Jami users, faollar, balanslar              |
| 👥 Foydalanuvchilar  | So'nggi 20 foydalanuvchi                    |
| 💰 Bonus             | Foydalanuvchiga bonus yuborish              |
| ⚠️ Jarima            | Foydalanuvchi balansidan yechi              |
| 📢 Xabar Yuborish    | Barchaga broadcast                          |
| 📡 Kanallar          | Majburiy obuna kanallari boshqaruvi         |
| ⚙️ Sozlamalar        | Min. to'lov / Referal bonus / Spin ×        |

## Sozlamalar (DB orqali dinamik)

| Kalit           | Standart | Tavsif                    |
|-----------------|----------|---------------------------|
| `min_payout`    | 5000     | Minimal to'lov so'mda     |
| `bonus_direct`  | 1000     | Referal bonus so'mda      |
| `spin_min_bet`  | 1000     | Spin min tikish so'mda    |
| `spin_multiply` | 2        | Spin yutish ko'paytmasi   |
