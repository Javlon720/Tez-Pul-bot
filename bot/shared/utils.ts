'use strict';

import type { Lang, Numeric } from '../types.js';

export function fmt(num: Numeric | null | undefined): string {
  return Number(num || 0).toLocaleString('ru-RU');
}

export function isUzPhone(phone: string | null | undefined): boolean {
  return /^\+998\d{9}$/.test(String(phone || '').trim());
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const p = String(input).trim().replace(/\s+/g, '');
  if (p.startsWith('+998') && p.length === 13) return p;
  if (p.startsWith('998')  && p.length === 12) return '+' + p;
  if (p.length === 9) return '+998' + p;
  return null;
}

/** pg satr qaytaradigan `numeric` ustunlar uchun xavfsiz butun songa o'tkazish */
export function toInt(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isNaN(num) ? fallback : num;
}

/** `catch (err: unknown)` dan o'qiladigan xabar */
export function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function isLang(value: unknown): value is Lang {
  return value === 'uz' || value === 'ru' || value === 'en';
}

export const formatNumber = fmt;

export const timeAgo = (value: Date | string | number | null | undefined): string =>
  value ? new Date(value).toLocaleString('ru-RU') : '';

export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};
