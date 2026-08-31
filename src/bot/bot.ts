import { Bot, InlineKeyboard } from 'grammy';
import { config } from '../config/config.js';
import { getOrCreateUser, getUserById, updateUserBalance, getAuthSessionByCode, confirmAuthSession, isUserAdmin, setUserBlocked, getSegmentCounts } from '../database/db.js';
import { fazerCardsService } from '../services/fazercards.service.js';
import { orderService } from '../services/order.service.js';
import { paymentService } from '../services/payment.service.js';
import { settingsService } from '../services/settings.service.js';
import { notificationService, escapeTgHtml } from '../services/notification.service.js';
import { adminOtpService } from '../services/admin-otp.service.js';
import { loggerService } from '../services/logger.service.js';
import { steganographyService } from '../services/steganography.service.js';
import {
  handleStart,
  renderMainMenu,
  renderProfile,
  renderOrders,
  renderSupport,
  renderPaymentMenu,
  renderGamesMenu,
  renderPubgSubMenu,
  renderTelegramServicesMenu,
  renderWebAppInfo,
  renderReviews,
  renderLanguageSelect,
  renderReferralMenu,
  renderFaqMenu,
  renderGameSearchPrompt,
  handleGameSearchResult,
  renderInfoCommand,
  getUserState,
  setUserState,
  clearUserState
} from './handlers.js';
import {
  createReview,
  updateLatestUserReviewComment,
  getCustomCategoryById,
  getCustomProductsByCategory,
  getCustomProductById,
  getAvailableStockCount,
  popAvailableStockCode,
  getCustomOfferPrice,
  getUserApiKeys,
  revokeApiKey,
  createApiKey,
  db
} from '../database/db.js';
import { setUserLanguage, getUserLanguage, translations, getT } from '../i18n/index.js';
import {
  getGamesMenuKeyboard,
  getOffersKeyboard,
  getPaymentMenuKeyboard,
  getOrderConfirmKeyboard,
  formatPrice,
  formatBalance,
  makeBtn,
  makeUrlBtn,
} from './menus.js';
import { EMOJIS, getCategoryEmoji, getCustomEmojiId } from './emojis.js';
import {
  handleAdminCommand,
  handleAdminCallbacks,
  handleBroadcastMessage,
  handleAdminUserSearch,
  handleAdminOrderSearch,
  handleAdminToggleCommand
} from './admin.js';
import { backupService } from '../services/backup.service.js';

export function isGiftcardCategory(categoryId: string): boolean {
  if (!categoryId) return false;

  // 1. api_categories verilənlər bazası cədvəlində konfiqurasiya edilib-edilmədiyini yoxla
  try {
    const row = db.prepare(`SELECT type FROM api_categories WHERE category_id = ?`).get(categoryId) as { type: string } | undefined;
    if (row && row.type) {
      return row.type ==='giftcard';
    }
  } catch (e) {}

  // Xüsusi topup kateqoriyaları — heç vaxt giftcard (hədiyyə kartı) kimi qəbul etmə
  if (
    categoryId === 'pubg_mobile_auto' ||
    categoryId === 'pubg_mobile_web' ||
    categoryId === 'free_fire_cis' ||
    categoryId === 'mobile_legends_direct' ||
    categoryId.includes('brawl')
  ) return false;

  // Xüsusi giftcard/e-pin kateqoriyaları — həmişə giftcard kimi qəbul et
  if (
    categoryId === 'pubg_mobile_epin' ||
    categoryId === 'pubg_mobile'         // pubg_mobile_epin üçün köhnə ad (alias)
  ) return true;

  return (
    categoryId.includes('giftcard') ||
    categoryId.includes('wallet') ||
    categoryId.includes('epin') ||
    categoryId.includes('voucher') ||
    categoryId.includes('steam') ||
    categoryId.includes('netflix') ||
    categoryId.includes('valorant') ||
    categoryId.includes('roblox') ||
    categoryId.includes('premium') ||
    categoryId.includes('stars')
  );
}

export function createBot(): Bot {
  if (!config.botToken || config.botToken === 'YOUR_BOT_TOKEN_HERE') {
    console.warn('⚠️ BOT_TOKEN təyin edilməyib. Bot işə düşməyəcək, lakin Vebsayt və API aktivdir.');
    return new Bot('123456789:AAFakeDummyTokenForBuildValidationOnly12345');
  }

  const bot = new Bot(config.botToken);

  bot.catch((err) => {
    console.error('Telegram Bot Xətası:', err.error || err.message);
    try {
      const ctx = err.ctx;
      loggerService.sendErrorAlert('Telegram Bot Error Catch', err.error || err, {
        update_id: ctx?.update?.update_id,
        user_id: ctx?.from?.id,
        username: ctx?.from?.username ? `@${ctx.from.username}` : 'Yoxdur',
        payload: ctx?.message?.text || ctx?.callbackQuery?.data || 'N/A'
      });
    } catch (e) {}
  });

  // ⏳ Offline Update Discard Middleware: Bot sönülü olanda gələn köhnə komandaları icra etmə!
  const botStartTime = Math.floor(Date.now() / 1000) - 2;
  bot.use(async (ctx, next) => {
    const updateDate = ctx.message?.date || ctx.callbackQuery?.message?.date;
    if (updateDate && updateDate < botStartTime) {
      if (ctx.callbackQuery) {
        try { await ctx.answerCallbackQuery(); } catch (e) {}
      }
      return; // Bot oflayn olarkən göndərilən yeniləmələri (mesajları) məhəl qoyma
    }
    return await next();
  });

  // ⛔ Bloklanmış İstifadəçi Tutucu Ara Proqramı
  bot.use(async (ctx, next) => {
    const from = ctx.from;
    if (!from) return await next();

    const tid = from.id.toString();
    const user = getUserById(tid);
    if (user && user.is_blocked === 1) {
      const reason = user.block_reason || 'Qaydaların pozulması və ya şübhəli fəaliyyət.';
      const blockMsg =
        `🚫 <b>HESABINIZ BLOKLANMIŞDIR!</b>\n\n` +
        `Hörmətli <b>${from.first_name || 'İstifadəçi'}</b>, sizin bu bot və mağaza üzərindəki fəaliyyətiniz idarəçi tərəfindən məhdudlaşdırılmışdır.\n\n` +
        `⚠️ <b>Blok Səbəbi:</b> ${reason}\n\n` +
        `🔓 <b>Hesabınızın açılması üçün rəsmi adminlə əlaqə saxlayın:</b>\n` +
        `👉 <b>Admin:</b> <a href="https://t.me/HusnuTech">@HusnuTech</a>`;

      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({
            text: '⛔ Hesabınız bloklanıb! Açılması üçün adminlə əlaqə saxlayın: @HusnuTech',
            show_alert: true
          });
        } catch (e) {}
      }

      try {
        await ctx.reply(blockMsg, {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().url('💬 Admin ilə Əlaqə (@HusnuTech)', 'https://t.me/HusnuTech')
        });
      } catch (e) {}
      return; // Bloklanmış istifadəçi üçün hər hansı əlavə emalı dayandır!
    }

    await next();
  });

  notificationService.setBot(bot);
  backupService.setBot(bot);
  backupService.startAutoBackupSchedule();

  const binanceTimers = new Map<string, NodeJS.Timeout>();

  function startBinanceOrderTimer(telegramId: string | number) {
    const idStr = telegramId.toString();
    if (binanceTimers.has(idStr)) {
      clearTimeout(binanceTimers.get(idStr)!);
      binanceTimers.delete(idStr);
    }

    const timer = setTimeout(async () => {
      const cur = getUserState(idStr);
      if (cur.step === 'awaiting_binance_id') {
        clearUserState(idStr);
        try {
          await bot.api.sendMessage(
            idStr,
            `⏳ <b>BİNANCE SİFARİŞİNİZİN VAXTI BİTDİ (10 DƏQİQƏ)</b>\n\n` +
            `⚠️ 10 dəqiqə ərzində Sifariş ID-si daxil edilmədiyi üçün sifariş avtomatik ləğv edildi.\n\n` +
            `💳 Yenidən balans artırmaq üçün aşağıdakı düymədən istifadə edin:`,
            {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard()
                .text('💳 Yenidən Balans Artır', 'pay_binance')
                .text('🏠 Əsas Menyu', 'menu_main'),
            }
          );
        } catch (err) {
          console.error('Timeout message error:', err);
        }
      }
      binanceTimers.delete(idStr);
    }, 10 * 60 * 1000);

    binanceTimers.set(idStr, timer);
  }

  function clearBinanceOrderTimer(telegramId: string | number) {
    const idStr = telegramId.toString();
    if (binanceTimers.has(idStr)) {
      clearTimeout(binanceTimers.get(idStr)!);
      binanceTimers.delete(idStr);
    }
  }

  function getCryptoAmountPicker(method: 'binance' | 'usdt_trc20' | 'usdt_bep20' = 'binance', lang: any = 'az'): { text: string; markup: InlineKeyboard } {
    const t = translations[lang as keyof typeof translations] || translations.az;
    const rate = settingsService.getUsdAznRate();
    const prefix = method === 'usdt_trc20' ? 'trc' : (method === 'usdt_bep20' ? 'bep' : 'bin');
    let title = `${EMOJIS.BINANCE} <b>${t.paymentBinancePayTitle}</b>`;
    if (method === 'usdt_trc20') title = `${EMOJIS.USDT_TRC20} <b>${t.paymentTrc20Title}</b>`;
    if (method === 'usdt_bep20') title = `${EMOJIS.USDT_BEP20} <b>${t.paymentBep20Title}</b>`;

    const rateMsg = t.paymentExchangeRate.replace('{rate}', rate.toFixed(2));
    const text = `${title}\n\n` +
      `${t.paymentSelectAmount}\n\n` +
      `💵 <i>${rateMsg}</i>\n\n` +
      `${EMOJIS.WRITE} <b>${t.paymentTypeAmountUsd}</b>`;

    const markup = new InlineKeyboard()
      .text(`💵 5 $ (${(5 * rate).toFixed(2)} ₼)`, `${prefix}_amt_5`)
      .text(`💵 10 $ (${(10 * rate).toFixed(2)} ₼)`, `${prefix}_amt_10`).row()
      .text(`💵 20 $ (${(20 * rate).toFixed(2)} ₼)`, `${prefix}_amt_20`)
      .text(`💵 50 $ (${(50 * rate).toFixed(2)} ₼)`, `${prefix}_amt_50`).row()
      .text(t.paymentBtnChangeAmount, 'menu_payment')
      .text(t.home, 'menu_main');

    return { text, markup };
  }

  function getCryptoInstruction(
    method: 'binance' | 'usdt_trc20' | 'usdt_bep20',
    amountUsd: number,
    amountAzn: number,
    lang: any = 'az'
  ): { text: string; markup: InlineKeyboard } {
    const t = translations[lang as keyof typeof translations] || translations.az;
    let header = '';
    let addressBlock = '';
    let steps = '';
    let example = '';

    if (method === 'usdt_trc20') {
      const addr = settingsService.getUsdtTrc20Address();
      header = `${EMOJIS.USDT_TRC20} <b>${t.paymentTrc20Title}</b>`;
      addressBlock = `🌐 <b>${t.paymentNetwork}</b> <b>TRON (TRC20)</b>\n` +
        `📋 <b>${t.paymentWalletAddress}</b>\n` +
        `<code>${addr}</code>\n\n`;
      steps = `${t.paymentCryptoStep1}\n` +
        `${t.paymentCryptoStep2Trc}\n` +
        `${t.paymentCryptoStep3.replace('{amount}', amountUsd.toFixed(2))}\n` +
        `${t.paymentCryptoStep4}\n\n`;
      example = `<i>${t.paymentCryptoExample}</i>`;
    } else if (method === 'usdt_bep20') {
      const addr = settingsService.getUsdtBep20Address();
      header = `${EMOJIS.USDT_BEP20} <b>${t.paymentBep20Title}</b>`;
      addressBlock = `🌐 <b>${t.paymentNetwork}</b> <b>BNB Smart Chain (BEP20)</b>\n` +
        `📋 <b>${t.paymentWalletAddress}</b>\n` +
        `<code>${addr}</code>\n\n`;
      steps = `${t.paymentCryptoStep1}\n` +
        `${t.paymentCryptoStep2Bep}\n` +
        `${t.paymentCryptoStep3.replace('{amount}', amountUsd.toFixed(2))}\n` +
        `${t.paymentCryptoStep4}\n\n`;
      example = `<i>${t.paymentCryptoExample}</i>`;
    } else {
      const payId = settingsService.getBinancePayId();
      header = `${EMOJIS.BINANCE} <b>${t.paymentBinancePayTitle}</b>`;
      addressBlock = `🆔 <b>${t.paymentBinancePayId}</b>\n` +
        `<code>${payId}</code>\n\n`;
      steps = `${t.paymentBinanceStep1}\n` +
        `${t.paymentBinanceStep2.replace('{payId}', payId)}\n` +
        `${t.paymentBinanceStep3.replace('{amount}', amountUsd.toFixed(2))}\n` +
        `${t.paymentBinanceStep4}\n\n`;
      example = `<i>${t.paymentBinanceExample}</i>`;
    }

    const text = `${header}\n\n` +
      `💰 <b>${t.paymentAmountToPay}</b> <b>${amountUsd.toFixed(2)} USDT</b>\n` +
      `💳 <b>${t.paymentBalanceCredit}</b> <b>+${amountAzn.toFixed(2)} ₼</b>\n\n` +
      addressBlock +
      `⏳ <b>${t.paymentSessionExpiry}</b>\n\n` +
      steps +
      example + `\n\n` +
      `${EMOJIS.WRITE} <b>${t.paymentSendTxIdPrompt}</b>`;

    const backCb = method === 'usdt_trc20' ? 'pay_usdt_trc20' : (method === 'usdt_bep20' ? 'pay_usdt_bep20' : 'pay_binance');

    const markup = new InlineKeyboard()
      .text(t.paymentBtnCancel, 'bin_cancel').row()
      .text(t.paymentBtnChangeAmount, backCb)
      .text(t.home, 'menu_main');

    return { text, markup };
  }

  // Komanda icraçıları
  bot.command('start', handleStart);
  bot.command('menu', (ctx) => renderMainMenu(ctx, false));
  bot.command('profil', (ctx) => renderProfile(ctx, false));
  bot.command('sifarisler', (ctx) => renderOrders(ctx, false));
  bot.command('balans', (ctx) => renderPaymentMenu(ctx, false));
  bot.command('oyunlar', (ctx) => renderGamesMenu(ctx, false));
  bot.command('destek', (ctx) => renderSupport(ctx, false));
  bot.command('reyler', (ctx) => renderReviews(ctx, false));
  bot.command('dil', (ctx) => renderLanguageSelect(ctx, false));
  bot.command('ref', (ctx) => renderReferralMenu(ctx, false));
  bot.command('faq', (ctx) => renderFaqMenu(ctx, false));
  bot.command('info', (ctx) => renderInfoCommand(ctx, false));
  bot.command('about', (ctx) => renderInfoCommand(ctx, false));
  bot.command('developer', (ctx) => renderInfoCommand(ctx, false));
  bot.command('dev', (ctx) => renderInfoCommand(ctx, false));
  bot.command('husnu', (ctx) => renderInfoCommand(ctx, false));

  // Steqanoqrafiya və Su Nişanı Şifrə Açıcı (/verify və ya /decode)
  bot.command(['verify', 'decode', 'inspect', 'dna'], async (ctx) => {
    let textToInspect = (ctx.match || '').toString().trim();
    if (!textToInspect && ctx.message?.reply_to_message) {
      textToInspect = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption || '';
    }

    if (!textToInspect) {
      await ctx.reply(
        `🔬 <b>RƏQƏMSAL STEQANOQRAFİYA & DNT DEKODERİ</b>\n\n` +
        `Bu əmr botun göndərdiyi mesajlarda gizlədilmiş 0-enli rəqəmsal müəlliflik imzasını açır.\n\n` +
        `📖 <b>İstifadə qaydası:</b>\n` +
        `1. Botun hər hansı bir mesajına <code>/verify</code> yazıb reply (cavab) verin.\n` +
        `2. Və ya: <code>/verify &lt;kopyalanmış mətn&gt;</code>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const decoded = steganographyService.decodeFromInvisible(textToInspect);
    if (decoded) {
      await ctx.reply(
        `🛡 <b>RƏQƏMSAL SU NİŞANI TƏSDİQLƏNDİ (100% MATCH)</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🧬 <b>Gizli DNT İmzası:</b>\n<code>${escapeTgHtml(decoded)}</code>\n\n` +
        `👑 <b>Müəlliflik Sertifikatı:</b> Bu sistemin və mühərrikin rəsmi memarı <b>@HUSNUTECH</b> tərəfindən təsdiq edilmişdir.`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(
        `🔍 <b>Analiz Nəticəsi:</b> Bu mətndə heç bir gizli su nişanı aşkar edilmədi.`,
        { parse_mode: 'HTML' }
      );
    }
  });

  bot.command('admin', handleAdminCommand);
  bot.command('statistika', handleAdminCommand);

  const checkAdminAuth = (ctx: any, cmd: string): boolean => {
    if (!ctx.from) return false;
    if (!isUserAdmin(ctx.from.id)) {
      const rawUserLabel = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || String(ctx.from.id));
      loggerService.sendSecurityAlert('UNAUTHORIZED_ADMIN_ACCESS', {
        ip: `TG:${ctx.from.id}`,
        endpoint: `${cmd} (Telegram Bot)`,
        userAgent: `Telegram User: ${rawUserLabel} (ID: ${ctx.from.id})`,
        reason: `İcazəsiz istifadəçi (${rawUserLabel}, ID: ${ctx.from.id}) botda ${cmd} komandasına cəhd etdi.`,
        actionTaken: 'Giriş rədd edildi'
      });
      return false;
    }
    return true;
  };

  // Admin kütləvi mesaj komandası: /broadcast və ya /broadcast <mesaj>
  bot.command(['broadcast', 'elan'], async (ctx) => {
    if (!checkAdminAuth(ctx, '/broadcast')) return;
    const text = ctx.message?.text?.replace(/^\/(broadcast|elan)/i, '').trim();
    if (!text) {
      const counts = getSegmentCounts();
      const kb = new InlineKeyboard()
        .text(`👥 Bütün İstifadəçilər (${counts.all})`, 'adm_bc_seg_all').row()
        .text(`💰 Balansı 0 Olanlar (${counts.zero_balance})`, 'adm_bc_seg_zero_balance').row()
        .text(`🛍️ Aktiv Alıcılar (${counts.active_buyers})`, 'adm_bc_seg_active_buyers').row()
        .text(`💎 VIP Müştərilər (${counts.vip})`, 'adm_bc_seg_vip').row()
        .text(`⏳ 7+ Gün Qeyri-Aktiv (${counts.inactive_7d})`, 'adm_bc_seg_inactive_7d').row()
        .text('❌ İmtina Et', 'adm_bc_cancel');

      await ctx.reply(
        `📢 <b>HƏDƏFLİ TOPLU BİLDİRİŞ (SMART BROADCAST)</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Zəhmət olmasa bildiriş göndərmək istədiyiniz <b>hədəf müştəri qrupunu (seqmenti)</b> seçin:\n\n` +
        `• <b>👥 Hamı:</b> Bütün istifadəçilərə elan\n` +
        `• <b>💰 Balansı 0:</b> Depozit və balans artırma təşviqi\n` +
        `• <b>🛍️ Aktiv Alıcılar:</b> Sadiq müştərilərə yeni məhsul xəbəri\n` +
        `• <b>💎 VIP:</b> Böyük alıcılara xüsusi B2B endirimlər\n` +
        `• <b>⏳ Qeyri-Aktiv:</b> Köhnə müştəriləri geri qazanmaq\n\n` +
        `<i>ℹ️ Və ya birbaşa hamıya göndərmək üçün: <code>/broadcast Mesajınız</code></i>`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
      return;
    }

    const waitMsg = await ctx.reply('⏳ Bildirişlər bütün istifadəçilərə göndərilir...');
    const res = await notificationService.broadcastSegmented({ segment: 'all', text });
    await ctx.api.editMessageText(
      ctx.chat.id,
      waitMsg.message_id,
      `✅ <b>Toplu Mesaj Göndərildi!</b>\n\n👥 Hədəf: Bütün İstifadəçilər (${res.total})\n📨 Çatdı: ${res.sent}\n❌ Xəta: ${res.failed}`,
      { parse_mode: 'HTML' }
    );
  });

  // Admin balans artırma komandası: /addbalance <tg_id> <məbləğ>
  bot.command('addbalance', async (ctx) => {
    if (!checkAdminAuth(ctx, '/addbalance')) return;
    const parts = (ctx.message?.text || '').split(' ').filter(Boolean);
    if (parts.length < 3) {
      await ctx.reply('⚠️ Format: <code>/addbalance TELEGRAM_ID MƏBLƏĞ</code>\nMəsələn: <code>/addbalance 123456789 20</code>', { parse_mode: 'HTML' });
      return;
    }

    const targetTgId = parts[1];
    const amount = parseFloat(parts[2]);
    if (isNaN(amount) || amount === 0) {
      await ctx.reply('⚠️ Yanlış məbləğ!');
      return;
    }

    const targetUser = getUserById(targetTgId);
    if (!targetUser) {
      await ctx.reply(`⚠️ ${targetTgId} ID-li istifadəçi bazada tapılmadı.`);
      return;
    }

    const newBal = updateUserBalance(targetTgId, amount);
    await notificationService.notifyUserPaymentApproved(targetTgId, amount, newBal);
    await ctx.reply(`✅ <b>Balans Yeniləndi!</b>\nİstifadəçi: <code>${targetTgId}</code>\nƏlavə olunan: ${amount > 0 ? '+' : ''}${amount} ₼\nYeni Balans: <b>${newBal.toFixed(2)} ₼</b>`, { parse_mode: 'HTML' });
  });

  // Admin parametrlər komandaları
  bot.command('setrate', async (ctx) => {
    if (!checkAdminAuth(ctx, '/setrate')) return;
    const rateStr = ctx.message?.text?.replace('/setrate', '').trim();
    const rate = parseFloat(rateStr || '');
    if (isNaN(rate) || rate <= 0) {
      await ctx.reply(`Cari USD/AZN məzənnəsi: <b>${settingsService.getUsdAznRate()}</b>. Dəyişmək üçün: <code>/setrate 1.70</code>`, { parse_mode: 'HTML' });
      return;
    }
    settingsService.updateSettings({ usd_azn_rate: rate.toString() });
    await ctx.reply(`✅ USD/AZN məzənnəsi <b>${rate} AZN</b> olaraq təyin edildi.`, { parse_mode: 'HTML' });
  });

  bot.command('setmargin', async (ctx) => {
    if (!checkAdminAuth(ctx, '/setmargin')) return;
    const marginStr = ctx.message?.text?.replace('/setmargin', '').trim();
    const margin = parseFloat(marginStr || '');
    if (isNaN(margin) || margin < 0) {
      await ctx.reply(`Cari qazanc marjası: <b>+${settingsService.getMarginPercent()}%</b>. Dəyişmək üçün: <code>/setmargin 12</code>`, { parse_mode: 'HTML' });
      return;
    }
    settingsService.updateSettings({ margin_percent: margin.toString() });
    await ctx.reply(`✅ Məhsul qazanc marjası <b>+${margin}%</b> olaraq təyin edildi.`, { parse_mode: 'HTML' });
  });

  // Admin Loq Kanalı Test Komandası: /testlog və ya /logtest
  bot.command(['testlog', 'logtest', 'testlogger'], async (ctx) => {
    if (!checkAdminAuth(ctx, '/testlog')) return;
    const target = settingsService.getLogChannelId();
    await ctx.reply(`🔄 Loq kanalına (<code>${escapeTgHtml(target || 'Yoxdur')}</code>) test mesajı göndərilir...`, { parse_mode: 'HTML' });
    const result = await loggerService.sendTestMessage();
    if (result.ok) {
      await ctx.reply(`✅ <b>UĞURLU!</b> Test bildirişi Loq Kanalına (<code>${escapeTgHtml(target)}</code>) göndərildi.`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`❌ <b>XƏTA:</b> ${escapeTgHtml(result.error || 'Naməlum xəta')}`, { parse_mode: 'HTML' });
    }
  });

  // Tək istifadəlik 2FA şifrəsi yaratmaq üçün Admin /key və ya /otp komandası
  bot.command(['key', 'otp', 'keys', 'apikeys'], async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    if (isUserAdmin(from.id)) {
      const res = await adminOtpService.generateAndSendOtp(from.id.toString());
      if (!res.ok) {
        await ctx.reply(`⚠️ ${res.error || 'Şifrə yaradıla bilmədi.'}`, { parse_mode: 'HTML' });
        return;
      }
      await ctx.reply(
        `🔑 <b>WINNERS ADMIN — API AÇARLARI 2FA TƏHLÜKƏSİZLİK ŞİFRƏSİ</b>\n\n` +
        `Yuxarıdakı birdəfəlik təhlükəsizlik şifrəsini Admin Paneldə daxil edərək <b>FazerCards</b> və <b>PlayPin</b> API açarlarını aça bilərsiniz.\n\n` +
        `⏱️ <i>Şifrə 5 dəqiqə ərzində etibarlıdır və yalnız 1 dəfə istifadə oluna bilər.</i>`,
        { parse_mode: 'HTML' }
      );
    } else {
      const label = `${from.first_name || ''} (@${from.username || 'yoxdur'})`;
      const attemptRes = adminOtpService.recordUnauthorizedAttempt(from.id, label);

      if (attemptRes.isBanned) {
        setUserBlocked(from.id, true, 'İcazəsiz 3 dəfə Admin API açarı almaq cəhdi.');
        await notificationService.sendAdminSecurityAlert(
          `🚨 <b>İCAZƏSİZ GİRİŞ CƏHDİ VƏ BOT BLOKU!</b>\n\n` +
          `Aşağıdakı istifadəçi bot vasitəsilə 3 dəfə icazəsiz Admin API açarı almağa cəhd etdi və bot tərəfindən <b>TAM BLOKLANDI</b>:\n\n` +
          `👤 <b>İstifadəçi:</b> ${escapeTgHtml(label)}\n` +
          `🆔 <b>Telegram ID:</b> <code>${from.id}</code>\n` +
          `🛑 <b>Status:</b> Bloklandı (bütün əmrlər və mesajlar dayandırıldı)`
        );

        await ctx.reply(
          `🚫 <b>GİRİŞ BLOKLANDI!</b>\n\n` +
          `Siz bu sistemin admini deyilsiniz. 3 dəfə icazəsiz şifrə tələb etdiyiniz üçün hesabınız bot tərəfindən tam bloklandı.`,
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.reply(
          `⛔ <b>İCAZƏ VERİLMƏDİ!</b>\n\n` +
          `Siz bu sistemin admini deyilsiniz. Bu icazəsiz cəhd qeydə alındı (<b>${attemptRes.attempts}/3</b>).\n` +
          `3-cü cəhddən sonra hesabınız avtomatik bloklanacaqdır.`,
          { parse_mode: 'HTML' }
        );
      }
    }
  });

  // 1. Admin İstifadəçi Axtarışı və İdarəedilməsi: /user <tg_id və ya @username>
  bot.command(['user', 'istifadeci', 'musteri'], async (ctx) => {
    if (!ctx.from || !isUserAdmin(ctx.from.id)) return;
    let query = (ctx.match || '').toString().trim();
    if (!query || query.toLowerCase().includes('və ya') || query.toLowerCase() === 'id' || query.toLowerCase() === '@username') {
      setUserState(ctx.from.id, { step: 'awaiting_admin_user_search' });
      await ctx.reply(
        `🔍 <b>İSTİFADƏÇİ AXTARIŞI</b>\n\n` +
        `Axtarmaq istədiyiniz müştərinin <b>Telegram ID</b> və ya <b>@istifadəçi_adı</b>-nı bu çata göndərin:\n\n` +
        `<i>Məsələn: <code>1108583389</code> və ya <code>@username</code></i>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('❌ Ləğv Et', 'adm_refresh_stats')
        }
      );
      return;
    }
    return handleAdminUserSearch(ctx, query);
  });

  // 2. Admin Sifariş Axtarışı və İdarəedilməsi: /order <order_id>
  bot.command(['order', 'sifaris', 'sifariş'], async (ctx) => {
    if (!ctx.from || !isUserAdmin(ctx.from.id)) return;
    let query = (ctx.match || '').toString().trim();
    if (!query || query.toLowerCase().includes('sifariş_id') || query.toLowerCase().includes('sifaris_id')) {
      setUserState(ctx.from.id, { step: 'awaiting_admin_order_search' });
      await ctx.reply(
        `🧾 <b>SİFARİŞ AXTARIŞI</b>\n\n` +
        `Axtarmaq istədiyiniz <b>Sifariş ID</b>-ni bu çata göndərin:\n\n` +
        `<i>Məsələn: <code>ORD-195336</code> və ya <code>#ORD-195336</code></i>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('❌ Ləğv Et', 'adm_refresh_stats')
        }
      );
      return;
    }
    return handleAdminOrderSearch(ctx, query);
  });

  // 3. Admin Oyun / Xidmət Baxım Keçidi: /toggle <kateqoriya_id>
  bot.command(['toggle', 'game', 'oyun_admin'], async (ctx) => {
    if (!ctx.from || !isUserAdmin(ctx.from.id)) return;
    const match = (ctx.match || '').toString().trim();
    return handleAdminToggleCommand(ctx, match || undefined);
  });

  // 5. Admin Gündəlik Maliyyə Qazanc Hesabatı: /report
  bot.command(['report', 'hesabat', 'gelir', 'qazanc'], async (ctx) => {
    if (!ctx.from || !isUserAdmin(ctx.from.id)) return;
    const dateStr = (ctx.match || '').toString().trim() || undefined;
    await notificationService.sendDailyFinancialReportToAdmin(ctx.chat.id, dateStr);
  });

  // Admin nüsxəçıxarma (backup) komandası
  bot.command('backup', async (ctx) => {
    if (!ctx.from || !isUserAdmin(ctx.from.id)) {
      await ctx.reply('⛔ Bu komanda yalnız Winners Store administratorları üçündür.');
      return;
    }
    const waitMsg = await ctx.reply('🛡️ <i>Məlumat bazasının nüsxəsi (Backup) hazırlanır və göndərilir...</i>', { parse_mode: 'HTML' });
    const res = await backupService.createAndSendBackup(ctx.chat.id);
    if (res.ok) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
      } catch (e) {}
    } else {
      await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Backup xətası: ${res.error}`);
    }
  });

  // İstifadəçi Oyun Axtarış Komandaları
  bot.command(['search', 'axtar', 'oyun'], async (ctx) => {
    const query = (ctx.match || '').toString().trim();
    if (query) {
      return handleGameSearchResult(ctx, query);
    }
    return renderGameSearchPrompt(ctx, false);
  });

  // Vəziyyətlər üçün mətn daxiletmə dinləyicisi (Oyunçu ID, Binance ID, OTP kodları)
  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    const state = getUserState(ctx.from.id);

    // Sleş komandalarını kəsmə
    if (text.startsWith('/')) {
      return next();
    }

    // Admin İstifadəçi Axtarışı Mətni
    if (state.step === 'awaiting_admin_user_search' && isUserAdmin(ctx.from.id)) {
      clearUserState(ctx.from.id);
      return handleAdminUserSearch(ctx, text);
    }

    // Admin Sifariş Axtarışı Mətni
    if (state.step === 'awaiting_admin_order_search' && isUserAdmin(ctx.from.id)) {
      clearUserState(ctx.from.id);
      return handleAdminOrderSearch(ctx, text);
    }

    // Admindən İstifadəçiyə Birbaşa Mesaj
    if (state.step === 'awaiting_user_direct_msg' && isUserAdmin(ctx.from.id)) {
      const targetTgId = state.extra?.targetTgId;
      clearUserState(ctx.from.id);
      if (targetTgId) {
        try {
          await bot.api.sendMessage(targetTgId, `📩 <b>WINNERS STORE ADMINISTRATORUNDAN MESAJ:</b>\n\n${escapeTgHtml(text)}\n\n<i>(Suallarınız varsa "💬 Dəstək" bölməsindən əlaqə saxlaya bilərsiniz)</i>`, { parse_mode: 'HTML' });
          await ctx.reply(`✅ Mesaj <code>${targetTgId}</code> nömrəli istifadəçiyə uğurla çatdırıldı!`, { parse_mode: 'HTML' });
        } catch (e: any) {
          await ctx.reply(`❌ Mesaj çatdırılmadı (istifadəçi botu dayandırmış ola bilər): ${e.message}`, { parse_mode: 'HTML' });
        }
      }
      return;
    }

    // Xüsusi / Premium Emoji Detektoru (YALNIZ Adminlər üçün)
    const customEntities = (ctx.message.entities || []).filter(e => e.type === 'custom_emoji');

    if (customEntities.length > 0 && state.step === 'idle' && isUserAdmin(ctx.from.id)) {
      let report = `💎 <b>PREMİUM EMOJİ AŞKARLANDI!</b>\n\n`;
      customEntities.forEach((ent, i) => {
        const customId = (ent as any).custom_emoji_id;
        report += `<b>${i + 1}. Emoji:</b> <tg-emoji emoji-id="${customId}">⭐️</tg-emoji>\n` +
          `• <b>Emoji ID:</b> <code>${customId}</code>\n` +
          `• <b>HTML Kodu:</b> <code>&lt;tg-emoji emoji-id="${customId}"&gt;⭐️&lt;/tg-emoji&gt;</code>\n\n`;
      });
      report += `<i>İstədiyiniz menyu və ya başlıq üçün bu kodu/ID-ni çatda mənə göndərin, dərhal bota yerləşdirim!</i>`;
      await ctx.reply(report, { parse_mode: 'HTML' });
      return;
    }

    // Sürətli Mətnə əsaslanan Naviqasiya / Cavab Klaviaturası Geri Dönüşü
    if (state.step === 'idle') {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('əsas menyu') || lowerText.includes('esas menyu') || lowerText.includes('main menu') || lowerText.includes('главное') || lowerText === 'menyu' || lowerText === 'menu') {
        return renderMainMenu(ctx, false);
      }
      if (lowerText.includes('yeni sifariş') || lowerText.includes('yeni sifaris') || lowerText.includes('oyunlar') || lowerText.includes('games') || lowerText.includes('игры')) {
        return renderGamesMenu(ctx, false);
      }
      if (lowerText.includes('balans') || lowerText.includes('artır') || lowerText.includes('artir') || lowerText.includes('balance') || lowerText.includes('пополнить')) {
        return renderPaymentMenu(ctx, false);
      }
      if (lowerText.includes('profil') || lowerText.includes('profile')) {
        return renderProfile(ctx, false);
      }
      if (lowerText.includes('sifariş') || lowerText.includes('sifaris') || lowerText.includes('orders') || lowerText.includes('заказы')) {
        return renderOrders(ctx, false);
      }
    }

    // 1. İstifadəçinin giriş OTP kodu göndərib-göndərmədiyini dərhal yoxla (məs. 555162 və ya auth_555162)
    const codeMatch = text.match(/^(?:auth_)?([A-Za-z0-9]{4,10})$/i);
    if (codeMatch && codeMatch[1]) {
      const candidateCode = codeMatch[1].toUpperCase();
      const session = getAuthSessionByCode(candidateCode);
      if (session && session.status === 'pending') {
        const confirmed = confirmAuthSession(candidateCode, ctx.from.id.toString(), ctx.from.username, ctx.from.first_name);
        if (confirmed) {
          const user = getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
          const kb = new InlineKeyboard().text('🎮 Oyunlar Menyusu', 'menu_games').text('🏠 Əsas Menyu', 'menu_main');
          if (config.server.webAppUrl && config.server.webAppUrl.startsWith('https://')) {
            kb.row().url('🌐 Veb Mağazaya Keç', config.server.webAppUrl);
          }

          await ctx.reply(
            `🎉 <b>QEYDİYYAT VƏ SAYTA GİRİŞİNİZ TƏSDİQLƏNDİ!</b>\n\n` +
            `👤 <b>İstifadəçi:</b> ${ctx.from.first_name || 'Oyunçu'}\n` +
            `🆔 <b>Telegram ID:</b> <code>${ctx.from.id}</code>\n` +
            `🔗 <b>İstifadəçi adı:</b> ${ctx.from.username ? `@${ctx.from.username}` : 'Yoxdur'}\n` +
            `💳 <b>Cari Balansınız:</b> <b>${user.balance.toFixed(2)} AZN</b>\n\n` +
            `🌐 <b>Winners Shop</b> vebsaytında hesabınız aktivləşdirildi. İndi sayta qayıdıb birbaşa alış-veriş edə bilərsiniz! 🚀`,
            {
              parse_mode: 'HTML',
              reply_markup: kb
            }
          );
          return;
        }
      }
    }

    // Əgər Admin Toplu Bildiriş mətni gözləyirsə
    if (state.step === 'awaiting_broadcast_text' && isUserAdmin(ctx.from.id)) {
      const segment = (state.extra?.segment || (state.data as any)?.segment || 'all') as any;
      return handleBroadcastMessage(ctx, text, undefined, segment);
    }

    // Əgər Oyun Axtarış mətni gözləyirsə
    if (state.step === 'awaiting_game_search') {
      return handleGameSearchResult(ctx, text);
    }

    // Əgər Rəy şərhi mətni gözləyirsə
    if (state.step === 'awaiting_review_comment') {
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;
      updateLatestUserReviewComment(ctx.from.id, text.trim());
      clearUserState(ctx.from.id);
      return ctx.reply(
        `🎉 <b>${t.reviewsThanksTitle}</b>\n\n` +
        `${t.commentSaved} 🌟`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text(t.reviewsBtnAllReviews, 'menu_reviews').text(t.home, 'menu_main'),
        }
      );
    }

    // Əgər sifariş üçün Oyunçu ID-si gözləyirsə
    if (state.step === 'awaiting_player_id' && state.data) {
      const playerId = text.trim();
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;

      if (playerId.length < 3 || playerId.length > 32) {
        await ctx.reply(`${EMOJIS.WARNING} ${t.invalidPlayerIdPrompt || 'Zəhmət olmasa düzgün Oyunçu ID-si daxil edin (3-32 simvol):'}`);
        return;
      }

      state.data.playerId = playerId;
      const rate = settingsService.getUsdAznRate() || 1.70;

      const custom = state.data.categoryId && state.data.offerId 
        ? getCustomOfferPrice(state.data.categoryId, state.data.offerId) 
        : undefined;

      const aznPrice = custom && typeof custom.custom_price_azn === 'number' && custom.custom_price_azn > 0
        ? custom.custom_price_azn
        : (state.data.priceAzn && state.data.priceAzn > 0 
            ? state.data.priceAzn 
            : settingsService.calculateAznPrice(state.data.priceUsd || 0));

      const usdPrice = custom && typeof custom.custom_price_usd === 'number' && custom.custom_price_usd > 0
        ? custom.custom_price_usd
        : (state.data.priceUsd && state.data.priceUsd > 0 && !custom 
            ? state.data.priceUsd 
            : Number((aznPrice / rate).toFixed(2)));

      state.data.priceAzn = aznPrice;
      state.data.priceUsd = usdPrice;

      const priceDisplay = formatPrice(aznPrice, usdPrice, lang);
      const isWebPurchase = state.data.categoryId === 'pubg_mobile_web';

      const confirmText = `${EMOJIS.CONFIRM} <b>${t.orderConfirmTitle || 'SİFARİŞİNİZİN TƏSDİQİ'}</b>\n\n` +
        `${EMOJIS.GAMES} <b>${t.fieldGame || 'Oyun / Xidmət:'}</b> ${state.data.categoryName}\n` +
        `${EMOJIS.PACKAGE} <b>${t.fieldPackage || 'Paket:'}</b> ${state.data.offerName}\n` +
        `${EMOJIS.TG_ID} <b>${t.fieldPlayerId || 'Oyunçu ID:'}</b> <code>${playerId}</code>\n` +
        `${EMOJIS.MONEY} <b>${t.fieldAmountToPay || 'Ödəniləcək Məbləğ:'}</b> <b>${priceDisplay}</b>\n\n` +
        (isWebPurchase
          ? `👑 <i>${t.noteWebPurchase}</i>\n\n`
          : `⚡ <i>${t.noteTopup}</i>\n\n`) +
        `<i>${t.confirmPrompt || 'Məlumatların düzgünlüyünə əminsinizsə, "Təsdiqlə və Yüklə" düyməsini basın:'}</i>`;

      const orderKey = `${state.data.categoryId}:::${state.data.offerId}:::${encodeURIComponent(playerId)}`;
      await ctx.reply(confirmText, {
        parse_mode: 'HTML',
        reply_markup: getOrderConfirmKeyboard(orderKey, lang),
      });

      clearUserState(ctx.from.id);
      return;
    }

    // Əgər mətn kimi yazılmış Binance / Kripto Məbləği gözləyirsə
    if (state.step === 'awaiting_binance_amount') {
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;
      const cleanNum = text.replace('$', '').replace('₼', '').replace('USD', '').trim();
      const amountUsd = parseFloat(cleanNum);
      if (isNaN(amountUsd) || amountUsd <= 0 || amountUsd > 10000) {
        await ctx.reply(`${EMOJIS.WARNING} ${t.paymentTypeAmountUsd}`, { parse_mode: 'HTML' });
        return;
      }

      const method: 'binance' | 'usdt_trc20' | 'usdt_bep20' = state.data?.method || 'binance';
      const rate = settingsService.getUsdAznRate();
      const amountAzn = amountUsd * rate;
      const expiresAt = Date.now() + 10 * 60 * 1000;

      setUserState(ctx.from.id, {
        step: 'awaiting_binance_id',
        data: { method, amountUsd, amountAzn, expiresAt }
      });

      startBinanceOrderTimer(ctx.from.id);

      const instruction = getCryptoInstruction(method, amountUsd, amountAzn, lang);

      await ctx.reply(instruction.text, {
        parse_mode: 'HTML',
        reply_markup: instruction.markup,
      });
      return;
    }

    // Kripto Sifariş ID / TxID gözləyirsə (10 dəqiqə ərzində)
    if (state.step === 'awaiting_binance_id') {
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;
      const method: 'binance' | 'usdt_trc20' | 'usdt_bep20' = state.data?.method || 'binance';
      const methodTitle = method === 'usdt_trc20' ? 'USDT (TRC20)' : (method === 'usdt_bep20' ? 'USDT (BEP20)' : 'Binance Pay');

      // Ciddi 10 Dəqiqəlik Bitmə Yoxlanışı
      if (state.data?.expiresAt && Date.now() > state.data.expiresAt) {
        clearBinanceOrderTimer(ctx.from.id);
        clearUserState(ctx.from.id);
        await ctx.reply(
          `⏳ <b>${t.paymentOrderExpiredTitle}</b>\n\n` +
          `⚠️ ${t.paymentOrderExpiredDesc}`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text(t.paymentBtnTopupAgain, 'menu_payment')
              .text(t.home, 'menu_main'),
          }
        );
        return;
      }

      clearBinanceOrderTimer(ctx.from.id);
      const orderId = text.trim();
      const amountAzn = state.data?.amountAzn || 0;
      const amountUsd = state.data?.amountUsd || 0;

      const waitMsg = await ctx.reply(`${EMOJIS.PENDING} ${methodTitle} ${t.paymentCheckingWait}`);
      const res = await paymentService.processCryptoPay(ctx.from.id, orderId, amountAzn, amountUsd, method);

      if (res.ok) {
        clearUserState(ctx.from.id);
        if (res.autoApproved) {
          const finalAdded = formatBalance(res.amountAzn || amountAzn, lang);
          const finalBalance = formatBalance(res.newBalance || 0, lang);
          await ctx.api.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            `${EMOJIS.CELEBRATE} <b>${t.paymentAutoApprovedTitle}</b>\n\n` +
            `✅ <b>${t.paymentAutoApprovedStatus}</b>\n` +
            `💳 <b>${t.paymentAddedBalance}</b> <b>+${finalAdded}</b>\n` +
            `💰 <b>${t.paymentNewBalance}</b> <b>${finalBalance}</b>\n\n` +
            `${t.paymentAutoApprovedNowShop} ${EMOJIS.LIGHTNING}`,
            {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard().text(t.gamesMenu, 'menu_games').text(t.home, 'menu_main')
            }
          );
        } else {
          const amountDisplay = amountUsd > 0
            ? `💰 <b>${t.paymentAmountToPay}</b> <b>${formatBalance(amountAzn, lang)}</b> (${amountUsd.toFixed(2)} USDT)\n`
            : '';

          await ctx.api.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            `${EMOJIS.RECEIPT} <b>${methodTitle.toUpperCase()} ${t.paymentReceivedTitle}</b>\n\n` +
            `${EMOJIS.TG_ID} <b>${t.paymentTxIdLabel}</b> <code>${orderId}</code>\n` +
            amountDisplay +
            `📌 <b>${t.paymentStatusPending}</b>\n\n` +
            `${t.paymentPendingAdminReview} ${EMOJIS.LIGHTNING}`,
            {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard().text(t.gamesMenu, 'menu_games').text(t.home, 'menu_main')
            }
          );
        }
      } else {
        await ctx.api.editMessageText(
          ctx.chat.id,
          waitMsg.message_id,
          res.error || `${EMOJIS.WARNING} ${t.orderStatusFailed}`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().text(t.refresh, 'menu_payment').text(t.home, 'menu_main')
          }
        );
      }

      clearUserState(ctx.from.id);
      return;
    }

    // Əgər istifadəçi aktiv 10 dəqiqəlik sifariş sessiyası olmadan TxID yazıbsa:
    if (/^[0-9]{15,25}$/.test(text.trim())) {
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;
      await ctx.reply(
        `⏳ <b>${t.paymentOrderExpiredTitle}</b>\n\n` +
        `⚠️ ${t.paymentOrderExpiredDesc}`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text(t.paymentBtnTopupAgain, 'pay_binance')
            .text(t.home, 'menu_main'),
        }
      );
      return;
    }
  });

  // Yenidən istifadə edilə bilən qəbz təqdim etmə köməkçisi
  async function handleReceiptUpload(ctx: any, fileId: string) {
    const lang = getUserLanguage(ctx.from.id);
    const t = translations[lang] || translations.az;
    const state = getUserState(ctx.from.id);
    const method = state.step === 'awaiting_m10_receipt' ? 'm10' : (state.step === 'awaiting_card_receipt' ? 'card' : null);
    const chosenMethod = method || 'm10';

    const res = await paymentService.submitManualReceipt({
      telegramId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      method: chosenMethod,
      receiptPath: fileId,
    });

    clearUserState(ctx.from.id);

    const replyText = `${EMOJIS.RECEIPT} <b>${t.receiptSent}</b>\n\n` +
      `📌 <b>ID:</b> <code>${res.paymentId}</code>\n` +
      `${EMOJIS.WALLET} <b>${t.orderProduct}</b> <b>${chosenMethod.toUpperCase()}</b>\n` +
      `📌 <b>${t.paymentStatusPending}</b>\n\n` +
      `${t.paymentPendingAdminReview} ${EMOJIS.LIGHTNING}`;

    await ctx.reply(replyText, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(t.home, 'menu_main')
    });
  }

  // Şəkil mesajını idarə et (M10 və Bank Kartı qəbzləri, və ya Admin Yayımı üçün)
  bot.on('message:photo', async (ctx) => {
    const state = getUserState(ctx.from.id);
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    if (!largestPhoto) return;

    // Adminin şəkil yayım edib-etmədiyini yoxla
    if (state.step === 'awaiting_broadcast_text' && isUserAdmin(ctx.from.id)) {
      const caption = ctx.message.caption || '';
      const segment = (state.extra?.segment || (state.data as any)?.segment || 'all') as any;
      return handleBroadcastMessage(ctx, caption, largestPhoto.file_id, segment);
    }

    await handleReceiptUpload(ctx, largestPhoto.file_id);
  });

  // Sənəd mesajını idarə et (PDF və ya sıxılmamış şəkil qəbzi)
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document;
    if (doc) {
      await handleReceiptUpload(ctx, doc.file_id);
    }
  });

  // Aktiv Sifariş İcrasının Qarşısının Alınması Kilidləri (Debounce Locks)
  const activeOrderLocks = new Set<string>();

  // 100% Daxili Callback Sorğu Yönləndiricisi
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    // Admin callback-ləri
    if (data.startsWith('adm_') || data.startsWith('adm:')) {
      return handleAdminCallbacks(ctx);
    }

    // Əsas Naviqasiya Callback-ləri
    if (data === 'noop_out_of_stock') {
      const lang = ctx.from ? getUserLanguage(ctx.from.id) : 'az';
      const alertMsg = lang === 'en' ? '⚠️ This package is temporarily out of stock at the provider. It will be restocked soon!' :
                       lang === 'ru' ? '⚠️ Данный товар временно закончился у поставщика. Скоро будет пополнение!' :
                       lang === 'tr' ? '⚠️ Bu ürün tedarikçi stoklarında geçici olarak tükenmiştir. Yakında güncellenecektir!' :
                       '⚠️ Bu məhsul hazırda təchizatçı anbarında tükənib. Tezliklə yenilənəcək!';
      return ctx.answerCallbackQuery({ text: alertMsg, show_alert: true });
    }

    if (data === 'menu_main' || data === 'main_menu' || data === 'nav_home' || data === 'home' || data === 'menu_home' || data === 'back_to_main') {
      return renderMainMenu(ctx, true);
    }
    if (data === 'menu_games' || data === 'games_menu' || data === 'nav_games') {
      return renderGamesMenu(ctx, true);
    }
    if (data === 'game_search' || data === 'menu_search') {
      return renderGameSearchPrompt(ctx, true);
    }
    if (data === 'menu_pubg_sub' || data === 'pubg_menu') {
      return renderPubgSubMenu(ctx, true);
    }
    if (data === 'menu_profile' || data === 'profile_menu') {
      return renderProfile(ctx, true);
    }
    if (data === 'menu_orders' || data === 'orders_menu') {
      return renderOrders(ctx, true);
    }
    if (data === 'menu_payment' || data === 'payment_menu' || data === 'balance_menu') {
      return renderPaymentMenu(ctx, true);
    }
    if (data === 'menu_services' || data === 'services_menu') {
      return renderTelegramServicesMenu(ctx, true);
    }
    if (data === 'menu_support' || data === 'support_menu') {
      return renderSupport(ctx, true);
    }
    if (data === 'menu_reviews' || data === 'reviews_menu') {
      return renderReviews(ctx, true);
    }
    if (data === 'menu_lang_select' || data === 'lang_menu') {
      return renderLanguageSelect(ctx, true);
    }
    if (data.startsWith('set_lang_')) {
      const lang = data.replace('set_lang_', '') as any;
      setUserLanguage(ctx.from.id, lang);
      await ctx.answerCallbackQuery({ text: 'Dil yeniləndi / Язык обновлен / Language updated ✅' });
      return renderMainMenu(ctx, true);
    }
    if (data === 'menu_referral' || data === 'referral_menu') {
      return renderReferralMenu(ctx, true);
    }
    if (data === 'menu_faq' || data === 'faq_menu') {
      return renderFaqMenu(ctx, true);
    }
    if (data === 'menu_info' || data === 'info_menu' || data === 'about_menu' || data === 'menu_developer' || data === 'dev_info') {
      return renderInfoCommand(ctx, true);
    }
    if (data === 'menu_admin') {
      await ctx.answerCallbackQuery();
      return handleAdminCommand(ctx);
    }

    // B2B API Tərtibatçı Sənədləşməsi və Gizli Açar İdarəetməsi (tg-spoiler və Çoxdilli)
    if (data === 'menu_api_docs' || data === 'api_regen_key') {
      const isRegen = data === 'api_regen_key';
      const tgId = ctx.from.id.toString();
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;

      let keys = getUserApiKeys(tgId);
      if (isRegen || keys.length === 0) {
        if (isRegen) {
          for (const k of keys) {
            revokeApiKey(k.id, tgId);
          }
        }
        createApiKey(tgId, 'Telegram API Client');
        keys = getUserApiKeys(tgId);
      }

      const activeKey = keys[0]?.api_key || 'wn_live_key';

      if (isRegen) {
        const regenAlerts: Record<string, string> = {
          az: '✅ Yeni API açarı yaradıldı! Köhnə açar ləğv edildi.',
          ru: '✅ Новый API-ключ создан! Старый ключ аннулирован.',
          en: '✅ New API key generated! Old key has been revoked.',
          tr: '✅ Yeni API anahtarı üretildi! Eski anahtar iptal edildi.'
        };
        await ctx.answerCallbackQuery({ text: regenAlerts[lang] || regenAlerts.az, show_alert: true });
      } else {
        await ctx.answerCallbackQuery();
      }

      const msgText = `${t.b2bApiTitle}\n\n` +
        `${t.b2bApiDocLink}\n` +
        `${t.b2bApiKeyLabel}\n\n` +
        `<tg-spoiler><code>${activeKey}</code></tg-spoiler>\n\n` +
        `${t.b2bApiTapToCopy}\n` +
        `${t.b2bApiWarning}\n\n` +
        `${t.b2bApiRegenPrompt}\n` +
        `${t.b2bApiRegenWarning}`;

      const kb = new InlineKeyboard()
        .text(t.b2bApiRegenBtn, 'api_regen_key').row()
        .url(t.b2bApiDocBtn, 'https://wsstore.pro/docs.html').row()
        .text('🏠 ' + t.home, 'menu_main');

      try {
        await ctx.editMessageText(msgText, {
          parse_mode: 'HTML',
          reply_markup: kb,
          link_preview_options: { is_disabled: false }
        });
      } catch {
        await ctx.reply(msgText, {
          parse_mode: 'HTML',
          reply_markup: kb,
          link_preview_options: { is_disabled: false }
        });
      }
      return;
    }

    // Qiymətləndirmə callback-i: rate_<orderKey>_<stars>
    if (data.startsWith('rate_')) {
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;
      const parts = data.split('_');
      const orderKey = parts[1];
      const stars = parseInt(parts[2], 10) || 5;

      createReview({
        orderId: orderKey,
        telegramId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        rating: stars,
      });

      await ctx.answerCallbackQuery({ text: `⭐️ ${stars}` });

      const starsDisplay = '⭐️'.repeat(stars);
      const youRatedMsg = t.reviewsYouRated.replace('{stars}', `<b>${starsDisplay}</b>`).replace('{num}', stars.toString());
      const thankText = `⭐ <b>${t.reviewsThanksTitle}</b>\n\n` +
        `${youRatedMsg}\n\n` +
        `${t.reviewsWriteCommentDesc}`;

      const kb = new InlineKeyboard()
        .text(t.reviewsBtnWriteComment, `rev_prompt_${orderKey}`).row()
        .text(t.reviewsBtnAllReviews, 'menu_reviews')
        .text(t.home, 'menu_main');

      return ctx.editMessageText(thankText, { parse_mode: 'HTML', reply_markup: kb });
    }

    // Rəy şərhi üçün sorğu: rev_prompt_<orderKey> və ya review_<orderKey>
    if (data.startsWith('rev_prompt_') || data.startsWith('review_')) {
      await ctx.answerCallbackQuery();
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;
      const parts = data.split('_');
      const orderKey = parts[parts.length - 1];
      setUserState(ctx.from.id, { step: 'awaiting_review_comment', data: { orderId: orderKey } });
      return ctx.reply(
        `💬 <b>${t.writeCommentPrompt}</b>\n\n` +
        `${t.reviewsWriteCommentDesc}`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text(t.cancel, 'menu_main'),
        }
      );
    }

    // Kripto Ödəmə Üsulları (Binance Pay, USDT TRC20, USDT BEP20)
    if (data === 'pay_binance' || data === 'pay_usdt_trc20' || data === 'pay_usdt_bep20') {
      await ctx.answerCallbackQuery();
      const lang = getUserLanguage(ctx.from.id);
      const method: 'binance' | 'usdt_trc20' | 'usdt_bep20' = data === 'pay_usdt_trc20' ? 'usdt_trc20' : (data === 'pay_usdt_bep20' ? 'usdt_bep20' : 'binance');
      setUserState(ctx.from.id, { step: 'awaiting_binance_amount', data: { method } });

      const picker = getCryptoAmountPicker(method, lang);
      return ctx.editMessageText(picker.text, {
        parse_mode: 'HTML',
        reply_markup: picker.markup,
      });
    }

    if (data.startsWith('bin_amt_') || data.startsWith('trc_amt_') || data.startsWith('bep_amt_')) {
      await ctx.answerCallbackQuery();
      const lang = getUserLanguage(ctx.from.id);
      let method: 'binance' | 'usdt_trc20' | 'usdt_bep20' = 'binance';
      let rawAmt = 0;
      if (data.startsWith('trc_amt_')) {
        method = 'usdt_trc20';
        rawAmt = parseFloat(data.replace('trc_amt_', ''));
      } else if (data.startsWith('bep_amt_')) {
        method = 'usdt_bep20';
        rawAmt = parseFloat(data.replace('bep_amt_', ''));
      } else {
        method = 'binance';
        rawAmt = parseFloat(data.replace('bin_amt_', ''));
      }

      const amountUsd = rawAmt;
      const rate = settingsService.getUsdAznRate();
      const amountAzn = amountUsd * rate;
      const expiresAt = Date.now() + 10 * 60 * 1000;

      setUserState(ctx.from.id, {
        step: 'awaiting_binance_id',
        data: { method, amountUsd, amountAzn, expiresAt }
      });

      startBinanceOrderTimer(ctx.from.id);

      const instruction = getCryptoInstruction(method, amountUsd, amountAzn, lang);

      return ctx.editMessageText(instruction.text, {
        parse_mode: 'HTML',
        reply_markup: instruction.markup,
      });
    }

    if (data === 'bin_cancel') {
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;
      await ctx.answerCallbackQuery({ text: `${t.cancel} ❌` });
      clearBinanceOrderTimer(ctx.from.id);
      clearUserState(ctx.from.id);

      const cancelText = `❌ <b>${t.paymentCancelledTitle}</b>\n\n` +
        `${t.paymentCancelledDesc}`;

      return ctx.editMessageText(cancelText, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text(t.paymentBtnTopupAgain, 'menu_payment')
          .text(t.home, 'menu_main'),
      });
    }

    // ─── Fəaliyyət yoxdur: istifadəçi satılmış məhsul düyməsinə toxundu ─────────────────────────
    if (data === 'noop_out_of_stock') {
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;
      return ctx.answerCallbackQuery({
        text: t.outOfStockAlert || '🔴 Bu paket hazırda stokda yoxdur. Zəhmət olmasa başqa paket seçin.',
        show_alert: true,
      });
    }

    // Kateqoriya Seçildi: cat:<category_id> və ya cat_<category_id>
    if (data.startsWith('cat:') || data.startsWith('cat_')) {
      await ctx.answerCallbackQuery();

      const categoryId = data.startsWith('cat:') ? data.replace('cat:', '') : data.replace('cat_', '');
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;

      // Xüsusi Admin Yaradılmış Kateqoriya olub-olmadığını yoxla
      if (categoryId.startsWith('custom_')) {
        const customCat = getCustomCategoryById(categoryId);
        if (!customCat || !customCat.is_active) {
          return ctx.editMessageText(`${EMOJIS.WARNING} Bu kateqoriya hazırda aktiv deyil.`, {
            reply_markup: new InlineKeyboard().text(t.back, 'menu_games').text(t.home, 'menu_main'),
          });
        }

        const customProducts = getCustomProductsByCategory(categoryId, false);
        if (customProducts.length === 0) {
          return ctx.editMessageText(`${customCat.icon || '🎮'} <b>${customCat.name}</b>\n\n${EMOJIS.WARNING} Bu kateqoriyada hələlik aktiv paket yoxdur. Zəhmət olmasa bir az sonra yenidən cəhd edin.`, {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().text(t.back, 'menu_games').text(t.home, 'menu_main'),
          });
        }

        const kb = new InlineKeyboard();
        for (const p of customProducts) {
          const stockInfo = p.delivery_type === 'manual' ? (p.stock_count && p.stock_count > 0 ? ` (Stok: ${p.stock_count})` : ' (Tükəndi)') : '';
          kb.text(`🔹 ${p.name} — ${p.price_azn.toFixed(2)} ₼${stockInfo}`, `off:${categoryId}:${p.id}`).row();
        }
        kb.text(t.back, 'menu_games').text(t.home, 'menu_main');

        const desc = customCat.description ? `\n<i>${customCat.description}</i>\n` : '';
        const text = `${customCat.icon || '🎮'} <b>${customCat.name}</b>\n${desc}\n${t.choosePackage}\n${EMOJIS.LIGHTNING} <i>${t.noteTopup}</i>`;

        return ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      }

      const type = isGiftcardCategory(categoryId) ?'giftcard' : 'topup';

      const offersRes = await fazerCardsService.getOffers(categoryId, type);
      if (!offersRes.ok || !offersRes.offers || offersRes.offers.length === 0) {
        const noOffersMsg = (t.noOffersFound || '<b>{name}</b> üçün hazırda aktiv təklif tapılmadı. Zəhmət olmasa bir az sonra yenidən cəhd edin.')
          .replace('{name}', offersRes.name || categoryId);
        return ctx.editMessageText(`${EMOJIS.WARNING} ${noOffersMsg}`, {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text(t.back, 'menu_games').text(t.home, 'menu_main'),
        });
      }

      const catEmoji = getCategoryEmoji(categoryId);
      // Çatdırılma təsviri kateqoriya növündən asılıdır
      let deliveryNote: string;
      if (categoryId === 'pubg_mobile_web') {
        deliveryNote = `${EMOJIS.LIGHTNING} <i>${t.noteWebPurchase}</i>`;
      } else if (categoryId === 'pubg_mobile_epin' || categoryId === 'pubg_mobile') {
        deliveryNote = `${EMOJIS.LIGHTNING} <i>${t.noteEpin}</i>`;
      } else if (isGiftcardCategory(categoryId)) {
        deliveryNote = `${EMOJIS.LIGHTNING} <i>${t.noteEpin}</i>`;
      } else {
        deliveryNote = `${EMOJIS.LIGHTNING} <i>${t.noteTopup}</i>`;
      }
      const text = `${catEmoji} <b>${offersRes.name}</b>\n\n` +
        `${t.choosePackage}\n` +
        deliveryNote;

      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: getOffersKeyboard(categoryId, offersRes.offers, 0, 8, lang),
        });
      } catch (e) {}
    }

    // Oyunların Seçimi Səhifələnməsi: games_page:<pageNum>
    if (data.startsWith('games_page:') || data.startsWith('games_page_')) {
      await ctx.answerCallbackQuery().catch(() => {});
      const pageStr = data.startsWith('games_page:') ? data.replace('games_page:', '') : data.replace('games_page_', '');
      const page = parseInt(pageStr, 10) || 0;
      const lang = getUserLanguage(ctx.from.id);
      const kb = getGamesMenuKeyboard(page, 12, lang);
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: kb });
      } catch (e) {}
      return;
    }

    // Təklif Səhifələnməsi: page:<categoryId>:<pageNum>
    if (data.startsWith('page:') || data.startsWith('page_')) {
      await ctx.answerCallbackQuery().catch(() => {});
      let categoryId = '';
      let page = 0;
      if (data.startsWith('page:')) {
        const parts = data.replace('page:', '').split(':');
        categoryId = parts[0];
        page = parseInt(parts[1], 10) || 0;
      } else {
        const parts = data.split('_');
        categoryId = parts.slice(1, -1).join('_');
        page = parseInt(parts[parts.length - 1], 10) || 0;
      }

      const type = isGiftcardCategory(categoryId) ?'giftcard' : 'topup';
      const offersRes = await fazerCardsService.getOffers(categoryId, type);

      if (offersRes.offers) {
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: getOffersKeyboard(categoryId, offersRes.offers, page, 8, getUserLanguage(ctx.from.id)),
          });
        } catch (e) {}
      }
      return;
    }

    // Təklif Seçildi: off:<categoryId>:<offerId>
    if (data.startsWith('off:') || data.startsWith('off_')) {
      await ctx.answerCallbackQuery();
      let categoryId = '';
      let offerId = '';

      if (data.startsWith('off:')) {
        const parts = data.replace('off:', '').split(':');
        categoryId = parts[0];
        offerId = parts[1];
      } else {
        // Geri Dönüş (Fallback)
        const parts = data.split('_');
        categoryId = parts[1];
        offerId = parts.slice(2).join('_');
      }

      // Xüsusi Məhsul olub-olmadığını yoxla
      if (categoryId.startsWith('custom_') || offerId.startsWith('prod_')) {
        const customCat = getCustomCategoryById(categoryId);
        const customProd = getCustomProductById(offerId);
        const lang = getUserLanguage(ctx.from.id);
        const t = translations[lang] || translations.az;

        if (!customProd || !customProd.is_active) {
          return ctx.editMessageText(`${EMOJIS.WARNING} ${t.invalidPlayerId || 'Seçilən paket tapılmadı və ya aktiv deyil.'}`, {
            reply_markup: new InlineKeyboard().text(t.back || '🔙 Geri', `cat:${categoryId}`).text(t.home || '🏠 Əsas Menyu', 'menu_main'),
          });
        }

        const user = getOrCreateUser(ctx.from.id);
        const customPriceDisplay = formatPrice(customProd.price_azn, customProd.price_usd, lang);
        const userBalanceDisplay = formatBalance(user.balance, lang);
        const missingBalanceDisplay = formatBalance(customProd.price_azn - user.balance, lang);

        if (user.balance < customProd.price_azn) {
          const text = `${EMOJIS.WARNING} <b>${t.balanceInsufficientTitle || 'BALANSINIZ ÇATMIR!'}</b>\n\n` +
            `${EMOJIS.PACKAGE} <b>${t.fieldPackage || 'Paket:'}</b> ${customProd.name}\n` +
            `${EMOJIS.MONEY} <b>${t.fieldAmountToPay || 'Qiymət:'}</b> <b>${customPriceDisplay}</b>\n` +
            `${EMOJIS.WALLET} <b>${t.currentBalance || 'Cari Balansınız:'}</b> ${userBalanceDisplay}\n` +
            `${t.balanceMissing || 'Çatışmayan məbləğ:'} <b>${missingBalanceDisplay}</b>\n\n` +
            `${t.topUpToProceed || 'Davam etmək üçün zəhmət olmasa əvvəlcə balansınızı artırın:'}`;

          return ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text(t.btnDepositBalance || '💳 Balans Artır', 'menu_payment').row()
              .text(t.btnBackToPackages || '🔙 Paketlərə Qayıt', `cat:${categoryId}`)
              .text(t.home || '🏠 Əsas Menyu', 'menu_main'),
          });
        }

        // Əl ilə çatdırılmadırsa (Hədiyyə Kartı/Pin kodları)
        if (customProd.delivery_type === 'manual' || customCat?.type ==='giftcard') {
          const stockCount = getAvailableStockCount(customProd.id);
          if (stockCount <= 0) {
            return ctx.editMessageText(`${EMOJIS.WARNING} <b>${t.orderStatusFailed || 'TÜKƏNDİ!'}</b>\n\n${t.giftcardSectionDesc || 'Bu məhsul üzrə bazada hazır aktivasiya kodu qalmayıb.'}`, {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard().text(t.btnBackToPackages || '🔙 Paketlərə Qayıt', `cat:${categoryId}`).text(t.home || '🏠 Əsas Menyu', 'menu_main'),
            });
          }

          const confirmText = `${EMOJIS.CONFIRM} <b>${t.orderConfirmTitle || 'SİFARİŞİN TƏSDİQİ'}</b>\n\n` +
            `${EMOJIS.GAMES} <b>${t.fieldGame || 'Xidmət:'}</b> ${customCat?.name || 'Məhsul'}\n` +
            `${EMOJIS.PACKAGE} <b>${t.fieldPackage || 'Paket:'}</b> ${customProd.name}\n` +
            `${EMOJIS.MONEY} <b>${t.fieldAmountToPay || 'Məbləğ:'}</b> <b>${customPriceDisplay}</b>\n` +
            `${EMOJIS.WALLET} <b>${t.currentBalance || 'Cari Balansınız:'}</b> ${userBalanceDisplay}\n\n` +
            `<i>${t.noteEpin || 'Təsdiqlədiyiniz anda rəqəmsal aktivasiya kodu birbaşa çata təqdim ediləcək.'}</i>`;

          const orderKey = `custom_gc:::${categoryId}:::${customProd.id}`;
          return ctx.editMessageText(confirmText, {
            parse_mode: 'HTML',
            reply_markup: getOrderConfirmKeyboard(orderKey, lang),
          });
        }

        // Top-Up-dursa (Oyunçu ID lazımdır)
        setUserState(ctx.from.id, {
          step: 'awaiting_player_id',
          data: {
            categoryId,
            categoryName: customCat?.name || categoryId,
            offerId: customProd.id,
            offerName: customProd.name,
            priceUsd: customProd.price_usd,
            priceAzn: customProd.price_azn,
            type: 'custom_topup',
          }
        });

        const promptText = `${EMOJIS.TARGET_ID} <b>${t.promptEnterPlayerId || 'OYUNÇU ID-SİNİ DAXİL EDİN'}</b>\n\n` +
          `${EMOJIS.GAMES} <b>${t.fieldGame || 'Məhsul:'}</b> ${customCat?.name || categoryId} — <b>${customProd.name}</b>\n` +
          `${EMOJIS.MONEY} <b>${t.fieldAmountToPay || 'Qiymət:'}</b> <b>${customPriceDisplay}</b>\n\n` +
          `${EMOJIS.WRITE} <i>${t.promptTypePlayerId || 'Zəhmət olmasa yükləmə ediləcək Oyunçu ID-sini (Player ID) çata yazın:'}</i>`;

        return ctx.editMessageText(promptText, {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text(t.btnCancelAndReturn || '🔙 Ləğv Et və Qayıt', `cat:${categoryId}`),
        });
      }

      const type = isGiftcardCategory(categoryId) ?'giftcard' : 'topup';
      const offersRes = await fazerCardsService.getOffers(categoryId, type);
      const offer = offersRes.offers?.find(o => o.offer_id === offerId);

      if (!offer) {
        return ctx.editMessageText(`${EMOJIS.WARNING} Seçilən paket tapılmadı (${categoryId} / ${offerId}).`, {
          reply_markup: new InlineKeyboard().text('🔙 Oyunlar Menyusu', 'menu_games').text('🏠 Əsas Menyu', 'menu_main'),
        });
      }

      const custom = getCustomOfferPrice(categoryId, offer.offer_id);
      const rate = settingsService.getUsdAznRate() || 1.70;
      const aznPrice = custom && typeof custom.custom_price_azn === 'number' && custom.custom_price_azn > 0
        ? custom.custom_price_azn
        : settingsService.calculateAznPrice(offer.price_usd);

      const usdPrice = custom && typeof custom.custom_price_usd === 'number' && custom.custom_price_usd > 0
        ? custom.custom_price_usd
        : Number((aznPrice / rate).toFixed(2));

      const user = getOrCreateUser(ctx.from.id);
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;
      const priceDisplay = formatPrice(aznPrice, usdPrice, lang);
      const userBalanceDisplay = formatBalance(user.balance, lang);
      const missingBalanceDisplay = formatBalance(aznPrice - user.balance, lang);

      if (user.balance < aznPrice) {
        const text = `${EMOJIS.WARNING} <b>${t.balanceInsufficientTitle || 'BALANSINIZ ÇATMIR!'}</b>\n\n` +
          `${EMOJIS.PACKAGE} <b>${t.fieldPackage || 'Paket:'}</b> ${offer.name}\n` +
          `${EMOJIS.MONEY} <b>${t.fieldAmountToPay || 'Qiymət:'}</b> <b>${priceDisplay}</b>\n` +
          `${EMOJIS.WALLET} <b>${t.currentBalance || 'Cari Balansınız:'}</b> ${userBalanceDisplay}\n` +
          `${t.balanceMissing || 'Çatışmayan məbləğ:'} <b>${missingBalanceDisplay}</b>\n\n` +
          `${t.topUpToProceed || 'Davam etmək üçün zəhmət olmasa əvvəlcə balansınızı artırın:'}`;

        return ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text(t.btnDepositBalance || '💳 Balans Artır', 'menu_payment').row()
            .text(t.btnBackToPackages || '🔙 Paketlərə Qayıt', `cat:${categoryId}`)
            .text(t.home || '🏠 Əsas Menyu', 'menu_main'),
        });
      }

      // Giftcard və ya topup olduğunu yoxla
      if (type ==='giftcard') {
        const confirmText = `${EMOJIS.CONFIRM} <b>${t.orderConfirmTitle || 'HƏDİYYƏ KARTI SİFARİŞİNİN TƏSDİQİ'}</b>\n\n` +
          `${EMOJIS.GAMES} <b>${t.fieldGame || 'Xidmət:'}</b> ${offersRes.name}\n` +
          `${EMOJIS.PACKAGE} <b>${t.fieldPackage || 'Paket:'}</b> ${offer.name}\n` +
          `${EMOJIS.MONEY} <b>${t.fieldAmountToPay || 'Məbləğ:'}</b> <b>${priceDisplay}</b>\n` +
          `${EMOJIS.WALLET} <b>${t.currentBalance || 'Cari Balansınız:'}</b> ${userBalanceDisplay}\n\n` +
          `<i>${t.noteEpin || 'Təsdiqlədiyiniz anda rəqəmsal aktivasiya kodu çata göndəriləcək.'}</i>`;

        const orderKey = `gc:::${categoryId}:::${offerId}`;
        return ctx.editMessageText(confirmText, {
          parse_mode: 'HTML',
          reply_markup: getOrderConfirmKeyboard(orderKey, lang),
        });
      }

      // Topup (Oyunçu ID lazımdır)
      setUserState(ctx.from.id, {
        step: 'awaiting_player_id',
        data: {
          categoryId,
          categoryName: offersRes.name || categoryId,
          offerId: offer.offer_id,
          offerName: offer.name,
          priceUsd: usdPrice,
          priceAzn: aznPrice,
          type: 'topup',
        }
      });

      const promptText = `${EMOJIS.TARGET_ID} <b>${t.promptEnterPlayerId || 'OYUNÇU ID-SİNİ DAXİL EDİN'}</b>\n\n` +
        `${EMOJIS.GAMES} <b>${t.fieldGame || 'Məhsul:'}</b> ${offersRes.name} — <b>${offer.name}</b>\n` +
        `${EMOJIS.MONEY} <b>${t.fieldAmountToPay || 'Qiymət:'}</b> <b>${priceDisplay}</b>\n\n` +
        `${EMOJIS.WRITE} <i>${t.promptTypePlayerId || 'Zəhmət olmasa yükləmə ediləcək Oyunçu ID-sini (Player ID) çata yazın:'}</i>`;

      return ctx.editMessageText(promptText, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(t.btnCancelAndReturn || '🔙 Ləğv Et və Qayıt', `cat:${categoryId}`),
      });

      return ctx.editMessageText(promptText, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Ləğv Et və Qayıt', `cat:${categoryId}`),
      });
    }

    // Sifariş İcrasını Təsdiqlə: conf_yes_<orderKey>
    if (data.startsWith('conf_yes_')) {
      const userLockKey = ctx.from.id.toString();
      if (activeOrderLocks.has(userLockKey)) {
        return ctx.answerCallbackQuery({
          text: '⏳ Sifarişiniz hazırda icra olunur, zəhmət olmasa bir neçə saniyə gözləyin...',
          show_alert: true,
        });
      }
      activeOrderLocks.add(userLockKey);

      try {
        await ctx.answerCallbackQuery();
        const rawKey = data.replace('conf_yes_', '');

        // Xüsusi Giftcard / Kod anında çatdırılma
        if (rawKey.startsWith('custom_gc:::')) {
          const parts = rawKey.split(':::');
          const categoryId = parts[1];
          const productId = parts[2];

          const customCat = getCustomCategoryById(categoryId);
          const customProd = getCustomProductById(productId);

          if (!customProd) {
            return ctx.editMessageText('⚠️ Məhsul tapılmadı.');
          }

          const user = getOrCreateUser(ctx.from.id);
          if (user.balance < customProd.price_azn) {
            return ctx.editMessageText('⚠️ Balansınız kifayət etmir.');
          }

          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          const code = popAvailableStockCode(productId, ctx.from.id, orderId);

          if (!code) {
            return ctx.editMessageText('⚠️ Bu məhsul üzrə stokda hazır kod qalmayıb.');
          }

          updateUserBalance(ctx.from.id, -customProd.price_azn);

          // Sifarişi DB-yə yadda saxla
          db.prepare(`
            INSERT INTO orders (id, telegram_id, product_type, category_id, category_name, offer_id, offer_name, price_usd, price_azn, status)
            VALUES (?, ?,'giftcard', ?, ?, ?, ?, ?, ?, 'completed')
          `).run(orderId, ctx.from.id.toString(), categoryId, customCat?.name || categoryId, productId, customProd.name, customProd.price_usd, customProd.price_azn);

          const successText = `${EMOJIS.SUCCESS} <b>SİFARİŞİNİZ UĞURLA TƏHVİL VERİLDİ!</b>\n\n` +
            `🆔 <b>Sifariş No:</b> <code>${orderId}</code>\n` +
            `${EMOJIS.GAMES} <b>Məhsul:</b> ${customCat?.name || categoryId} — <b>${customProd.name}</b>\n` +
            `${EMOJIS.MONEY} <b>Məbləğ:</b> <b>${customProd.price_azn.toFixed(2)} ₼</b>\n` +
            `${EMOJIS.WALLET} <b>Yeni Balansınız:</b> ${(user.balance - customProd.price_azn).toFixed(2)} ₼\n\n` +
            `🎟️ <b>RƏQƏMSAL KODUNUZ:</b>\n` +
            `<code>${code}</code>\n\n` +
            `<i>(Kodu kopyalamaq üçün üzərinə toxunun)</i>\n\n` +
            `Təşəkkür edirik! 🌟`;

          const t = ctx.from ? getT(ctx.from.id) : getT('0');
          return ctx.editMessageText(successText, {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().text(t.notifBtnWriteReview || '⭐️ Rəy Yaz', `review_${orderId}`).text(t.home || '🏠 Əsas Menyu', 'menu_main'),
          });
        }

        // Standart FazerCards Giftcard təsdiqi
        if (rawKey.startsWith('gc:::') || rawKey.startsWith('gc___')) {
          const parts = rawKey.includes(':::') ? rawKey.split(':::') : rawKey.split('___');
          const categoryId = parts[1];
          const offerId = parts[2];
          const offersRes = await fazerCardsService.getOffers(categoryId,'giftcard');
          const offer = offersRes.offers?.find(o => o.offer_id === offerId);
          const t = ctx.from ? getT(ctx.from.id) : getT('0');

          if (!offer) {
            return ctx.editMessageText(`⚠️ ${t.invalidPlayerId || 'Təklif tapılmadı.'}`);
          }

          await ctx.editMessageText(`⏳ <b>${t.orderProcessing || 'Hədiyyə kartı generasiya olunur, zəhmət olmasa gözləyin...'}</b>`, { parse_mode: 'HTML' });
          const res = await orderService.processGiftcardOrder({
            telegramId: ctx.from.id,
            categoryId,
            categoryName: offersRes.name || categoryId,
            offerId: offer.offer_id,
            offerName: offer.name,
            priceUsd: parseFloat(offer.price_usd),
            count: 1,
          });

          if (!res.ok) {
            await ctx.editMessageText(`⚠️ ${res.error || 'Xəta baş verdi'}`, {
              parse_mode: 'HTML',
              reply_markup: new InlineKeyboard().text(t.home || '🏠 Əsas Menyu', 'menu_main')
            });
          }
          return;
        }

        // Topup təsdiqi: <categoryId>:::<offerId>:::<playerId>
        const parts = rawKey.includes(':::') ? rawKey.split(':::') : rawKey.split('___');
        const categoryId = parts[0];
        const offerId = parts[1];
        const playerId = decodeURIComponent(parts[2]);
        const t = ctx.from ? getT(ctx.from.id) : getT('0');

        // Əgər Xüsusi Topup-dırsa
        if (categoryId.startsWith('custom_') || offerId.startsWith('prod_')) {
          const customCat = getCustomCategoryById(categoryId);
          const customProd = getCustomProductById(offerId);

          if (!customProd) {
            return ctx.editMessageText(`⚠️ ${t.invalidPlayerId || 'Məhsul tapılmadı.'}`);
          }

          const user = getOrCreateUser(ctx.from.id);
          if (user.balance < customProd.price_azn) {
            return ctx.editMessageText(`⚠️ ${t.insufficientBalance || 'Balansınız kifayət etmir.'}`);
          }

          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          updateUserBalance(ctx.from.id, -customProd.price_azn);

          db.prepare(`
            INSERT INTO orders (id, telegram_id, product_type, category_id, category_name, offer_id, offer_name, player_id, price_usd, price_azn, status)
            VALUES (?, ?, 'topup', ?, ?, ?, ?, ?, ?, ?, 'completed')
          `).run(orderId, ctx.from.id.toString(), categoryId, customCat?.name || categoryId, offerId, customProd.name, playerId, customProd.price_usd, customProd.price_azn);

          const successText = `${EMOJIS.SUCCESS} <b>TOP-UP SİFARİŞİNİZ İCRA EDİLDİ!</b>\n\n` +
            `🆔 <b>Sifariş No:</b> <code>${orderId}</code>\n` +
            `${EMOJIS.GAMES} <b>Məhsul:</b> ${customCat?.name || categoryId} — <b>${customProd.name}</b>\n` +
            `${EMOJIS.TG_ID} <b>Oyunçu ID:</b> <code>${playerId}</code>\n` +
            `${EMOJIS.MONEY} <b>Məbləğ:</b> <b>${customProd.price_azn.toFixed(2)} ₼</b>\n` +
            `${EMOJIS.WALLET} <b>Yeni Balansınız:</b> ${(user.balance - customProd.price_azn).toFixed(2)} ₼\n\n` +
            `⚡ Hesabınıza uğurla yükləndi!`;

          return ctx.editMessageText(successText, {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().text(t.notifBtnWriteReview || '⭐️ Rəy Yaz', `review_${orderId}`).text(t.home || '🏠 Əsas Menyu', 'menu_main'),
          });
        }

        const offersRes = await fazerCardsService.getOffers(categoryId, 'topup');
        const offer = offersRes.offers?.find(o => o.offer_id === offerId);

        if (!offer) {
          return ctx.editMessageText(`⚠️ ${t.invalidPlayerId || 'Təklif tapılmadı.'}`);
        }

        if (categoryId === 'pubg_mobile_web') {
          await ctx.editMessageText(`${EMOJIS.PENDING} <b>${t.orderForwardingOperator}</b>`, { parse_mode: 'HTML' }).catch(() => {});
        } else {
          await ctx.editMessageText(`${EMOJIS.LIGHTNING} <b>${t.orderAutoProcessing}</b>`, { parse_mode: 'HTML' }).catch(() => {});
        }

        const res = await orderService.processTopupOrder({
          telegramId: ctx.from.id,
          categoryId,
          categoryName: offersRes.name || categoryId,
          offerId: offer.offer_id,
          offerName: offer.name,
          priceUsd: parseFloat(offer.price_usd),
          playerId,
        });

        if (!res.ok) {
          await ctx.editMessageText(`⚠️ ${res.error || 'Sifariş xətası baş verdi.'}`, {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().text(t.btnBackToPackages || '🔄 Yenidən Yoxla', `cat:${categoryId}`).text(t.home || '🏠 Əsas Menyu', 'menu_main')
          });
        }
        return;
      } finally {
        activeOrderLocks.delete(userLockKey);
      }
    }

    if (data === 'conf_no') {
      const t = ctx.from ? getT(ctx.from.id) : getT('0');
      await ctx.answerCallbackQuery({ text: t.cancel || 'Sifariş ləğv edildi.' });
      return ctx.editMessageText(`❌ ${t.cancel || 'Sifarişiniz ləğv edildi.'}`, {
        reply_markup: new InlineKeyboard().text(t.gamesMenu || '🎮 Oyunlar Menyusu', 'menu_games').text(t.home || '🏠 Əsas Menyu', 'menu_main'),
      });
    }
  });

  // İnline Axtarış və Tərtibatçı Vizitkartı (@rentazbot [axtarış])
  bot.on('inline_query', async (ctx) => {
    try {
      const devText =
        `${EMOJIS.MAIN_MENU} <b>WINNERS BOT & DIGITAL COMMERCE ECOSYSTEM</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${EMOJIS.LIGHTNING} <b>Architecture:</b> High-Performance Node.js & TypeScript Core\n` +
        `${EMOJIS.SHIELD} <b>Security:</b> Distributed Cloud Core • Zero-Trust Auth\n` +
        `${EMOJIS.PACKAGE} <b>Fulfillment:</b> 100% Automated Instant API Delivery\n` +
        `${EMOJIS.WALLET} <b>Gateways:</b> Binance Pay, USDT (TRC20 / BEP20) & Local Cards\n` +
        `${EMOJIS.STATS} <b>Database:</b> High-Speed SQLite WAL Engine\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${EMOJIS.ADMIN_CROWN} <b>Lead Developer & Systems Architect:</b>\n` +
        `${EMOJIS.TELEGRAM_PREMIUM} <b>@HUSNUTECH</b> <i>(Senior Full-Stack & Bot Engineer)</i>\n\n` +
        `${EMOJIS.BRIEFCASE} <i>For custom enterprise Telegram Bots, WebApps, or high-performance automated e-commerce solutions, contact the developer:</i>`;

      const devKeyboard = {
        inline_keyboard: [
          [makeUrlBtn('WhatsApp: +994 77 211 70 11', 'https://wa.me/994772117011', getCustomEmojiId('WHATSAPP_SUPPORT') || '5271536803482981220', '💬')],
          [makeUrlBtn('Telegram: @HusnuTech', 'https://t.me/HusnuTech', getCustomEmojiId('LIGHTNING_FAST') || '6023726576493925831', '⚡')],
        ]
      };

      const rawStoreUrl = (config.server.webAppUrl || '').trim();
      const safeStoreUrl = (rawStoreUrl.startsWith('https://') && !rawStoreUrl.includes('localhost') && !rawStoreUrl.includes('127.0.0.1'))
        ? rawStoreUrl
        : `https://t.me/${config.botUsername || 'WS_StoreBot'}`;

      const storeText =
        `${EMOJIS.GAMES} <b>WINNERS SHOP — OFFICIAL DIGITAL STORE</b>\n\n` +
        `${EMOJIS.LIGHTNING} PUBG Mobile UC, Free Fire, Mobile Legends və bütün rəqəmsal oyun valyutaları 100% avtomatik çatdırılma ilə!\n\n` +
        `${EMOJIS.LANGUAGE} <b>Rəsmi Bot:</b> @${config.botUsername || 'WS_StoreBot'}\n` +
        `${EMOJIS.TELEGRAM} <b>Dəstək & Sifariş:</b> 100% Avtomatik və Təhlükəsiz`;

      const storeKeyboard = {
        inline_keyboard: [
          [makeUrlBtn('🛒 Bota Keç və Sifariş Et', `https://t.me/${config.botUsername || 'WS_StoreBot'}`, getCustomEmojiId('GAMES_CATALOG') || '5994703708653361268', '🎮')],
          [makeUrlBtn('⚡ Canlı Əlaqə: @HusnuTech', 'https://t.me/HusnuTech', getCustomEmojiId('LIGHTNING_FAST') || '6023726576493925831', '⚡')],
        ]
      };

      const results: any[] = [
        {
          type: 'article',
          id: 'dev_signature',
          title: '👨‍💻 Lead Developer & Bot Architect (@HUSNUTECH)',
          description: 'Official developer contact and system specifications for custom bot development',
          thumbnail_url: 'https://cdn-icons-png.flaticon.com/512/4712/4712038.png',
          input_message_content: {
            message_text: devText,
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true }
          },
          reply_markup: devKeyboard
        },
        {
          type: 'article',
          id: 'store_catalog',
          title: '🎮 Winners Shop — Oyun & UC Kataloqu',
          description: '100% Avtomatik çatdırılma ilə ən ucuz oyun paketləri',
          thumbnail_url: 'https://cdn-icons-png.flaticon.com/512/808/808439.png',
          input_message_content: {
            message_text: storeText,
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true }
          },
          reply_markup: storeKeyboard
        }
      ];

      await ctx.answerInlineQuery(results, {
        cache_time: 1,
        is_personal: true
      });
    } catch (e: any) {
      console.error('Inline query error:', e.message);
    }
  });

  return bot;
}
