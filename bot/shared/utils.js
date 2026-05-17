'use strict';

export function fmt(num) {
  return Number(num || 0).toLocaleString('ru-RU');
}

export function isUzPhone(phone) {
  return /^\+998\d{9}$/.test(String(phone || '').trim());
}

export function normalizePhone(input) {
  if (!input) return null;
  const p = String(input).trim().replace(/\s+/g, '');
  if (p.startsWith('+998') && p.length === 13) return p;
  if (p.startsWith('998')  && p.length === 12) return '+' + p;
  if (p.length === 9) return '+998' + p;
  return null;
}
