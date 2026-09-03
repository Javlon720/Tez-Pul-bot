'use strict';
import { query } from '../shared/db.js';
import getText from '../locales/index.js';
import { errMessage } from '../shared/utils.js';
import type { Bot, InlineKeyboardButton, InlineKeyboardMarkup, Lang, SubscriptionChannelRow } from '../types.js';

interface SubCacheEntry {
  result: boolean;
  ts: number;
}

// 5 daqiqalik cache — har safar DB so'rovini kamaytiradi
const subCache = new Map<number, SubCacheEntry>();

export async function checkSubscription(bot: Bot, telegramId: number): Promise<boolean> {
  const cached = subCache.get(telegramId);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.result;

  const { rows } = await query<Pick<SubscriptionChannelRow, 'tg_id'>>(
    'SELECT tg_id FROM subscription_channels WHERE is_active = true'
  );
  if (!rows.length) {
    subCache.set(telegramId, { result: true, ts: Date.now() });
    return true;
  }

  for (const ch of rows) {
    try {
      const member = await bot.getChatMember(ch.tg_id, telegramId);
      if (['left', 'kicked', 'banned'].includes(member.status)) {
        subCache.set(telegramId, { result: false, ts: Date.now() });
        return false;
      }
    } catch (err) {
      // Bot kanalda admin bo'lmasa yoki kanal topilmasa — obuna yo'q deb hisobla
      console.warn(`[Sub] getChatMember xato (ch=${ch.tg_id}, user=${telegramId}):`, errMessage(err));
      subCache.set(telegramId, { result: false, ts: Date.now() });
      return false;
    }
  }

  subCache.set(telegramId, { result: true, ts: Date.now() });
  return true;
}

export function invalidateSubCache(telegramId: number): void {
  subCache.delete(telegramId);
}

export function invalidateAllSubCache(): void {
  subCache.clear();
}

export async function buildSubKeyboard(lang: Lang): Promise<InlineKeyboardMarkup> {
  const { rows } = await query<Pick<SubscriptionChannelRow, 'tg_id' | 'name' | 'url'>>(
    'SELECT tg_id, name, url FROM subscription_channels WHERE is_active = true'
  );
  const buttons: InlineKeyboardButton[][] = rows.map(ch => {
    const btn: InlineKeyboardButton = { text: `📢 ${ch.name}` };
    if (ch.url && ch.url.startsWith('http')) btn.url = ch.url;
    return [btn];
  });
  buttons.push([{ text: getText(lang, 'channel_check_button'), callback_data: 'check_sub' }]);
  return { inline_keyboard: buttons };
}
