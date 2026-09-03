# TezPul Referal Bot v2

Telegram referal boti. Foydalanuvchilar do'stlarini taklif qilib pul ishlashadi va Spin o'yinida ko'paytirishadi.

## Tuzilishi

Loyiha to'liq **TypeScript** da yozilgan (`strict` rejim yoqilgan).

```
bot/
├── index.ts               # Kirish nuqtasi, polling
├── router.ts              # User xabar/callback yo'naltirish
├── helpers.ts             # showMainMenu, deletePrevMsg
├── types.ts               # Umumiy tiplar: UserRow, Session, Lang, Bot ...
├── shared/
│   ├── db.ts              # PostgreSQL pool, query<T>, transaction<T>
│   ├── session.ts         # In-memory session (30 daqiqa TTL)
│   ├── cache.ts           # User cache (5 daqiqa TTL)
│   ├── logger.ts          # Winston logger
│   └── utils.ts           # fmt, toInt, errMessage, isUzPhone, normalizePhone
├── middleware/
│   ├── adminAuth.ts       # isAdmin() tekshiruvi
│   └── subscription.ts    # Kanal obuna tekshiruvi + cache
├── services/
│   ├── userService.ts     # getUser, upsertUser, invalidateUser
│   ├── settingsService.ts # getSetting/setSetting + qulaylik funksiyalar
│   └── referralService.ts # storePending, processReferral
├── handlers/
│   ├── admin/index.ts     # Barcha admin funksiyalar
│   ├── admin/tolls.ts     # To'lov murojaatlari
│   ├── start.ts           # /start, til tanlash, captcha, obuna tekshiruvi
│   ├── phone.ts           # Telefon raqam qabul qilish
│   ├── share.ts           # Referal havola
│   ├── info.ts            # Bot haqida + top referallar
│   ├── report.ts          # Foydalanuvchi hisoboti
│   ├── language.ts        # Til o'zgartirish
│   ├── payment_request.ts # To'lovga murojaat formasi
│   └── spin.ts            # O'yinlar (slot, futbol, basketbol, zar, darts)
├── locales/index.ts       # uz / ru / en tarjimalar (TextKey tipi bilan)
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

# TypeScript ni kompilyatsiya qilib ishga tushirish
npm run build
npm start

# yoki development uchun (tsx watch, build shart emas):
npm run dev

# faqat tiplarni tekshirish
npm run typecheck
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
