'use strict';
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { connectWithRetry } from './shared/db.js';
import { isAdmin } from './middleware/adminAuth.js';
import { getSession } from './shared/session.js';
import { routeMessage, routeCallback } from './router.js';

import {
  handleAdminMenu, handleAdminStats, handleAdminUsers,
  handleAdminUsersList, handleAdminUsersPage, handleAdminUserDetail, handleAdminUserBlock,
  handleAdminBonusStart, handleAdminBonusTargetInput, handleAdminBonusAmountInput,
  handleAdminPenaltyStart, handleAdminPenaltyTargetInput, handleAdminPenaltyAmountInput,
  handleAdminBroadcastStart, handleAdminBroadcastInput, handleAdminBroadcastConfirm,
  handleAdminChannels, handleAdminChannelAdd, handleAdminChannelInput, handleAdminChannelDel,
  handleAdminSettings, handleAdminSettingSelect, handleAdminSettingInput,
  handleAdminCancel,
  handleAdminTolls,
  handleAdminTollReq, handleAdminTollPay, handleAdminTollScreenshot,
  handleAdminTollApprove, handleAdminTollEdit,
  handleAdminTollBlock, handleAdminTollUnblock, handleAdminTollReblock,
  handleAdminTollBack,
} from './handlers/admin/index.js';

import {
  handlePaymentRequest,
  handlePayReqCard, handlePayReqName, handlePayReqAmount,
  handlePayReqBack, handlePayReqEdit, handlePayReqConfirm, handlePayReqCancel,
  handlePayReqCardInput, handlePayReqNameInput, handlePayReqAmountInput,
} from './handlers/payment_request.js';

async function main() {
  await connectWithRetry();

  const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: {
      interval: 300,
      autoStart: false,
      params: { timeout: 30, allowed_updates: ['message', 'callback_query'] },
    },
  });

  bot.on('polling_error', (err) => {
    if (['ETIMEDOUT', 'ECONNRESET', 'EFATAL'].includes(err.code)) return;
    console.error('[Bot] Polling xato:', err.message);
  });

  // ── Xabarlar ─────────────────────────────────────────────────────────────
  bot.on('message', async (msg) => {
    try {
      if (!msg.from) return;
      const userId = msg.from.id;
      const text   = msg.text || '';

      if (isAdmin(userId)) {
        // Admin buyruqlar
        if (text === '/admin')              { await handleAdminMenu(bot, msg); return; }
        if (text === '📊 Statistika')       { await handleAdminStats(bot, msg); return; }
        if (text === '👥 Foydalanuvchilar') { await handleAdminUsers(bot, msg); return; }
        if (text === '💰 Bonus')            { await handleAdminBonusStart(bot, msg); return; }
        if (text === '⚠️ Jarima')           { await handleAdminPenaltyStart(bot, msg); return; }
        if (text === '📢 Xabar Yuborish')   { await handleAdminBroadcastStart(bot, msg); return; }
        if (text === '📡 Kanallar')         { await handleAdminChannels(bot, msg); return; }
        if (text === "💳 To'lovlar")        { await handleAdminTolls(bot, msg); return; }
        if (text === '⚙️ Sozlamalar')       { await handleAdminSettings(bot, msg); return; }

        // Admin holat mashinalari
        const state = getSession(userId)?.current_state;
        if (state === 'ADMIN_BONUS_TARGET')    { await handleAdminBonusTargetInput(bot, msg); return; }
        if (state === 'ADMIN_BONUS_AMOUNT')    { await handleAdminBonusAmountInput(bot, msg); return; }
        if (state === 'ADMIN_PENALTY_TARGET')  { await handleAdminPenaltyTargetInput(bot, msg); return; }
        if (state === 'ADMIN_PENALTY_AMOUNT')  { await handleAdminPenaltyAmountInput(bot, msg); return; }
        if (state === 'ADMIN_BROADCAST_TEXT')  { await handleAdminBroadcastInput(bot, msg); return; }
        if (state === 'ADMIN_CHANNEL_INPUT')   { await handleAdminChannelInput(bot, msg); return; }
        if (state === 'ADMIN_TOLL_SCREENSHOT') { await handleAdminTollScreenshot(bot, msg); return; }
        if (state === 'ADMIN_TOLL_APPROVE')    { await handleAdminTollScreenshot(bot, msg); return; }
        if (state?.startsWith('ADMIN_SET_'))   {
          const key = state.replace('ADMIN_SET_', '').toLowerCase();
          await handleAdminSettingInput(bot, msg, key);
          return;
        }
      }

      await routeMessage(bot, msg);
    } catch (err) {
      console.error('[Bot] Xabar xatosi:', err.message);
    }
  });

  // ── Callback tugmalar ─────────────────────────────────────────────────────
  bot.on('callback_query', async (cbQuery) => {
    try {
      if (!cbQuery.from) return;
      const userId = cbQuery.from.id;
      const data   = cbQuery.data || '';

      if (isAdmin(userId)) {
        if (data === 'admin:cancel')             { await handleAdminCancel(bot, cbQuery); return; }
        if (data === 'admin:broadcast_confirm')  { await handleAdminBroadcastConfirm(bot, cbQuery); return; }
        if (data === 'admin:ch_add')             { await handleAdminChannelAdd(bot, cbQuery); return; }
        if (data.startsWith('admin:ch_del:'))    { await handleAdminChannelDel(bot, cbQuery); return; }
        if (data.startsWith('admin:set:'))       { await handleAdminSettingSelect(bot, cbQuery); return; }
        if (data === 'admin:users_list')         { await handleAdminUsersList(bot, cbQuery); return; }
        if (data.startsWith('admin:user:'))      { await handleAdminUserDetail(bot, cbQuery); return; }
        if (data.startsWith('admin:block:'))     { await handleAdminUserBlock(bot, cbQuery); return; }
        if (data === 'admin:toll:back')                  { await handleAdminTollBack(bot, cbQuery); return; }
        if (data.startsWith('admin:toll:req:'))          { await handleAdminTollReq(bot, cbQuery); return; }
        if (data.startsWith('admin:toll:pay:'))          { await handleAdminTollPay(bot, cbQuery); return; }
        if (data.startsWith('admin:toll:approve:'))      { await handleAdminTollApprove(bot, cbQuery); return; }
        if (data.startsWith('admin:toll:edit:'))         { await handleAdminTollEdit(bot, cbQuery); return; }
        if (data.startsWith('admin:toll:block:'))         { await handleAdminTollBlock(bot, cbQuery); return; }
        if (data.startsWith('admin:toll:unblock:'))       { await handleAdminTollUnblock(bot, cbQuery); return; }
        if (data.startsWith('admin:toll:reblock:'))       { await handleAdminTollReblock(bot, cbQuery); return; }
        if (data.startsWith('admin:users_page:'))        { await handleAdminUsersPage(bot, cbQuery); return; }
      }

      await routeCallback(bot, cbQuery);
    } catch (err) {
      console.error('[Bot] Callback xatosi:', err.message);
    }
  });

  bot.startPolling();

  const me = await bot.getMe();
  global.BOT_USERNAME = me.username;
  console.log(`[Bot] Ishga tushdi: @${me.username}`);
}

main();
