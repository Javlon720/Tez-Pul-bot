'use strict';
import type TelegramBot from 'node-telegram-bot-api';

declare global {
  // eslint-disable-next-line no-var
  var BOT_USERNAME: string | undefined;
}

// ─── Telegram tiplari uchun qisqartmalar ──────────────────────────────────
export type Bot = TelegramBot;
export type Message = TelegramBot.Message;
export type CallbackQuery = TelegramBot.CallbackQuery;
export type TelegramUser = TelegramBot.User;
export type InlineKeyboardButton = TelegramBot.InlineKeyboardButton;
export type InlineKeyboardMarkup = TelegramBot.InlineKeyboardMarkup;

/** `from` maydoni kafolatlangan xabar — router narrow qiladi */
export type MessageWithFrom = Message & { from: TelegramUser };

/** `message` maydoni kafolatlangan callback — router narrow qiladi */
export type CallbackQueryWithMessage = CallbackQuery & { message: Message };

// ─── Til ──────────────────────────────────────────────────────────────────
export type Lang = 'uz' | 'ru' | 'en';

// ─── DB ustunlari ─────────────────────────────────────────────────────────
/** pg `bigint` / `numeric` ustunlarni satr ko'rinishida qaytaradi */
export type Numeric = number | string;

export interface UserRow {
  telegram_id: Numeric;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_verified: boolean;
  lang: Lang | null;
  balance: Numeric;
  paid_amount: Numeric;
  unpaid_amount: Numeric;
  total_referrals: Numeric;
  spins_used: Numeric;
  referred_by: Numeric | null;
  is_blocked: boolean;
  is_verified: boolean;
  saved_card: string | null;
  saved_full_name: string | null;
  created_at: Date | string;
  last_active: Date | string;
}

export interface SubscriptionChannelRow {
  id: number;
  tg_id: string;
  name: string;
  url: string | null;
  is_active: boolean;
}

export type PaymentRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface PaymentRequestRow {
  id: number;
  user_id: Numeric;
  card_number: string;
  full_name: string;
  amount: Numeric;
  status: PaymentRequestStatus;
  created_at: Date | string;
}

export interface SettingRow {
  key: string;
  value: string;
}

/** `SELECT COUNT(*) AS c` natijasi */
export interface CountRow {
  c: Numeric;
}

/** `SELECT SUM(...) AS s` natijasi */
export interface SumRow {
  s: Numeric;
}

// ─── Sozlamalar / o'yinlar ────────────────────────────────────────────────
export type SettingKey = 'min_payout' | 'bonus_direct' | 'spin_multiply';
export type GameKey = 'slot' | 'football' | 'basketball' | 'dice' | 'darts';

export interface Game {
  emoji: string;
  wins: number[];
  label: string;
  waitMs: number;
}

// ─── Sessiya ──────────────────────────────────────────────────────────────
export type SessionState =
  | 'CAPTCHA'
  | 'CAPTCHA_EXPIRED'
  | 'LANG_SELECTION'
  | 'PHONE'
  | 'CHANNEL_CHECK'
  | 'WAITING_SPIN_GAME'
  | 'WAITING_SPIN_BET'
  | 'PAY_REQ_FORM'
  | 'PAY_REQ_CARD'
  | 'PAY_REQ_NAME'
  | 'PAY_REQ_AMOUNT'
  | 'ADMIN_BONUS_TARGET'
  | 'ADMIN_BONUS_AMOUNT'
  | 'ADMIN_PENALTY_TARGET'
  | 'ADMIN_PENALTY_AMOUNT'
  | 'ADMIN_BROADCAST_TEXT'
  | 'ADMIN_BROADCAST_CONFIRM'
  | 'ADMIN_CHANNEL_INPUT'
  | 'ADMIN_MIN_PAYOUT'
  | 'ADMIN_TOLL_SCREENSHOT'
  | 'ADMIN_TOLL_APPROVE'
  | `ADMIN_SET_${Uppercase<SettingKey>}`;

export interface SessionStateData {
  /** captcha javobi */
  answer?: number;
  lang?: Lang;
  game?: GameKey;
  /** to'lov murojaati formasi */
  card?: string;
  name?: string;
  amount?: number;
  max_amount?: number;
  /** admin bonus / jarima nishoni */
  target_id?: Numeric;
  target_name?: string | null;
  broadcast_text?: string;
  /** admin to'lov murojaati */
  req_id?: number;
  file_id?: string;
}

export interface Session {
  current_state?: SessionState | null;
  last_message_id?: number;
  form_msg_id?: number;
  state_data?: SessionStateData;
}
