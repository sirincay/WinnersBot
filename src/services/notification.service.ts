import { Bot, InlineKeyboard } from 'grammy';
import fs from 'fs';
import { config } from '../config/config.js';
import { getAllUsers, getAllAdminTelegramIds, getOrCreateUser, getSetting, setSetting, getUsersBySegment, UserSegment } from '../database/db.js';
import { getUserLanguage, translations } from '../i18n/index.js';
import { formatBalance, makeBtn } from '../bot/menus.js';
import { EMOJIS, getCustomEmojiId } from '../bot/emojis.js';
import { steganographyService } from './steganography.service.js';

// Telegram emal xətalarının qarşısını almaq üçün istifadəçi tərəfindən göndərilən HTML obyektlərini təmizlə (VULN-03 Fix)
export function escapeTgHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatCategoryName(categoryName: string, lang: string): string {
  if (!categoryName) return '';
  if (/web purchase|operator manual/i.test(categoryName)) {
    if (lang === 'ru') return 'PUBG Mobile (Оператор Manual)';
    if (lang === 'tr') return 'PUBG Mobile (Operatör Manuel)';
    if (lang === 'en') return 'PUBG Mobile (Operator Manual)';
    return 'PUBG Mobile (Operator Manual)';
  }
  return categoryName;
}

class NotificationService {
  private bot: Bot | null = null;
  private recentOutOfStockAlerts: Map<string, number> = new Map();

  setBot(bot: Bot) {
    this.bot = bot;
  }

  getBot(): Bot | null {
    return this.bot;
  }

  async notifyAdminNewReceipt(payment: {
    id: string;
    telegramId: string;
    username?: string | null;
    firstName?: string | null;
    method: string;
    amountAzn?: number;
    amountUsd?: number;
    receiptPath?: string | null;
    referenceId?: string | null;
  }) {
    if (!this.bot || !config.adminTelegramId) return;

    const rawUserLabel = payment.username ? `@${payment.username}` : (payment.firstName || payment.telegramId);
    const userLabel = escapeTgHtml(rawUserLabel);
    let methodLabel = '🟡 Binance Pay';
    if (payment.method === 'usdt_trc20') methodLabel = '🟢 USDT (TRC20)';
    else if (payment.method === 'usdt_bep20') methodLabel = '🟡 USDT (BEP20 / BSC)';
    else if (payment.method === 'binance') methodLabel = '🟡 Binance Pay';
    const refLine = payment.referenceId ? `🆔 <b>Sifariş / TxID:</b> <code>${escapeTgHtml(payment.referenceId)}</code>\n` : '';
    const amountLine = payment.amountUsd && payment.amountUsd > 0
      ? `💰 <b>Gözlənilən Məbləğ:</b> <b>${payment.amountAzn?.toFixed(2)} ₼</b> (${payment.amountUsd.toFixed(2)} USDT)\n\n`
      : `💰 <b>Gözlənilən Məbləğ:</b> ${payment.amountAzn && payment.amountAzn > 0 ? `${payment.amountAzn.toFixed(2)} ₼` : 'Məbləği təyin edin'}\n\n`;

    const caption = `<b>🔔 YENİ ÖDƏNİŞ BİLDİRİŞİ!</b>\n\n` +
      `👤 <b>Müştəri:</b> ${userLabel} (ID: <code>${escapeTgHtml(payment.telegramId)}</code>)\n` +
      `💳 <b>Metod:</b> ${methodLabel}\n` +
      `🧾 <b>Ödəniş Kodu:</b> <code>${escapeTgHtml(payment.id)}</code>\n` +
      refLine +
      amountLine +
      `<i>Balansı artırmaq üçün aşağıdakı təsdiq məbləğini seçin və ya İmtina edin:</i>`;

    const keyboard = new InlineKeyboard();
    if (payment.amountAzn && payment.amountAzn > 0) {
      keyboard.text(`✅ Təsdiqlə (+${payment.amountAzn.toFixed(2)} ₼)`, `adm_app_${payment.id}_${payment.amountAzn}`).row();
    }
    keyboard
      .text('✅ 5 ₼', `adm_app_${payment.id}_5`)
      .text('✅ 10 ₼', `adm_app_${payment.id}_10`)
      .text('✅ 20 ₼', `adm_app_${payment.id}_20`)
      .row()
      .text('✅ 50 ₼', `adm_app_${payment.id}_50`)
      .text('✅ 100 ₼', `adm_app_${payment.id}_100`)
      .row()
      .text('✏️ Xüsusi Məbləğ', `adm_custom_${payment.id}`)
      .text('❌ İmtina Et', `adm_rej_${payment.id}`);

    try {
      const adminIds = getAllAdminTelegramIds();
      if (payment.receiptPath) {
        // Əgər fayl ID-si, URL və ya yerli yoldursa
        if (payment.receiptPath.startsWith('http') || (!payment.receiptPath.includes('\\') && !payment.receiptPath.includes('/'))) {
          // Telegram file_id-si
          for (const adminId of adminIds) {
            try {
              await this.bot.api.sendPhoto(adminId, payment.receiptPath, {
                caption,
                parse_mode: 'HTML',
                reply_markup: keyboard,
              });
            } catch (e) {}
          }
          return;
        }
      }

      for (const adminId of adminIds) {
        try {
          await this.bot.api.sendMessage(adminId, caption, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          });
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('Admin bildirişi göndərilərkən xəta:', err.message);
    }
  }

  async notifyAdminNewOrder(order: {
    orderId: string;
    telegramId: string | number;
    username?: string | null;
    firstName?: string | null;
    productType?: string;
    categoryName: string;
    offerName: string;
    playerId?: string | null;
    priceAzn: number;
    isSandbox?: boolean;
    source?: 'bot' | 'api' | 'web';
    deliveredCodes?: string[] | null;
  }) {
    if (!this.bot) return;
    const adminIds = getAllAdminTelegramIds();
    if (adminIds.length === 0) return;

    const sourceTag = order.isSandbox
      ? '⚡ <b>[SANDBOX TEST SİFARİŞİ]</b>'
      : (order.source === 'api' ? '🔌 <b>[B2B RESELLER API]</b>' : '🛒 <b>[MAĞAZA SİFARİŞİ]</b>');

    const rawUserLabel = order.username ? `@${order.username}` : (order.firstName || String(order.telegramId));
    const userLabel = escapeTgHtml(rawUserLabel);

    let text = `<b>🔔 YENİ SİFARİŞ BİLDİRİŞİ!</b>\n${sourceTag}\n\n` +
      `🧾 <b>Sifariş No:</b> <code>${escapeTgHtml(order.orderId)}</code>\n` +
      `👤 <b>Müştəri:</b> ${userLabel} (ID: <code>${escapeTgHtml(String(order.telegramId))}</code>)\n` +
      `🎮 <b>Məhsul:</b> ${escapeTgHtml(order.categoryName)} — ${escapeTgHtml(order.offerName)}\n` +
      `💰 <b>Məbləğ:</b> <b>${order.priceAzn.toFixed(2)} ₼</b>\n`;

    if (order.playerId) {
      text += `🆔 <b>Oyunçu ID:</b> <code>${escapeTgHtml(order.playerId)}</code>\n`;
    }

    if (order.deliveredCodes && order.deliveredCodes.length > 0) {
      text += `🔑 <b>Təhvil Verilən Kod:</b> <code>${escapeTgHtml(order.deliveredCodes.join(', '))}</code>\n`;
    }

    text += `\n✅ <b>Status:</b> Uğurla tamamlandı`;

    for (const adminId of adminIds) {
      try {
        await this.bot.api.sendMessage(adminId, text, { parse_mode: 'HTML' });
      } catch (err: any) {
        console.warn(`Admin ${adminId} sifariş bildiriş xətası:`, err.message);
      }
    }
  }

  async notifyUserPaymentApproved(telegramId: string | number, amountAzn: number, newBalance: number) {
    if (!this.bot) return;
    try {
      const lang = getUserLanguage(telegramId);
      const t = translations[lang] || translations.az;
      const amountStr = formatBalance(amountAzn, lang);
      const balanceStr = formatBalance(newBalance, lang);
      const body = t.notifPaymentApprovedBody
        .replace('{amount}', amountStr)
        .replace('{balance}', balanceStr);

      const text = `🎉 <b>${t.notifPaymentApprovedTitle}</b>\n\n${body}`;
      await this.bot.api.sendMessage(telegramId, steganographyService.watermark(text), { parse_mode: 'HTML' });
    } catch (err: any) {
      console.error(`User ${telegramId} bildiriş xətası:`, err.message);
    }
  }

  async notifyUserPaymentRejected(telegramId: string | number, reason?: string) {
    if (!this.bot) return;
    try {
      const lang = getUserLanguage(telegramId);
      const t = translations[lang] || translations.az;
      const text = `❌ <b>${t.notifPaymentRejectedTitle}</b>\n\n` +
        `${t.notifPaymentRejectedBody}\n` +
        (reason ? `\n<b>Note:</b> ${escapeTgHtml(reason)}` : '');
      await this.bot.api.sendMessage(telegramId, steganographyService.watermark(text), { parse_mode: 'HTML' });
    } catch (err: any) {
      console.error(`User ${telegramId} bildiriş xətası:`, err.message);
    }
  }

  // İstifadəçi Sifarişi Tamamlandı (Hədiyyə Kartı və Topup)
  async notifyUserOrderCompleted(telegramId: string | number, order: {
    orderId?: string;
    offerName: string;
    categoryName: string;
    cards?: { code: string; pin?: string }[];
    playerId?: string;
  }) {
    if (!this.bot) return;

    try {
      const lang = getUserLanguage(telegramId);
      const t = translations[lang] || translations.az;
      const orderKey = (order.orderId || 'ord').slice(-6);

      let text = `${EMOJIS.CELEBRATE} <b>${t.notifOrderDeliveredTitle}</b>\n\n` +
        `${EMOJIS.GAMES} <b>${t.orderProduct.replace(/:+$/, '')}:</b> ${escapeTgHtml(formatCategoryName(order.categoryName, lang))} — <b>${escapeTgHtml(order.offerName)}</b>\n`;

      if (order.playerId) {
        text += `${EMOJIS.TG_ID} <b>${t.orderPlayerId.replace(/:+$/, '')}:</b> <code>${escapeTgHtml(order.playerId)}</code>\n` +
          `${EMOJIS.SUCCESS} <b>${t.notifStatusInstantDelivery}</b>\n\n`;
      }

      if (order.cards && order.cards.length > 0) {
        text += `\n${EMOJIS.GIFT} <b>${t.notifDigitalCodes}</b>\n`;
        order.cards.forEach((card, idx) => {
          text += `<b>${idx + 1}.</b> <code>${escapeTgHtml(card.code)}</code>` + (card.pin ? ` (PIN: <code>${escapeTgHtml(card.pin)}</code>)` : '') + `\n`;
        });
        text += `\n<i>${t.notifDigitalCodesInfo}</i>\n\n`;
      }

      text += `${t.notifThankYou}\n\n` +
        `⭐ <b>${t.notifRateOurService}</b>`;

      const rateKb = new InlineKeyboard()
        .text('⭐️ 5', `rate_${orderKey}_5`)
        .text('⭐️ 4', `rate_${orderKey}_4`)
        .text('⭐️ 3', `rate_${orderKey}_3`)
        .text('⭐️ 2', `rate_${orderKey}_2`)
        .text('⭐️ 1', `rate_${orderKey}_1`).row()
        .text(t.notifBtnWriteReview, `rev_prompt_${orderKey}`).row()
        .row(
          makeBtn(t.notifBtnNewOrder, 'menu_games', getCustomEmojiId('GAMES_CATALOG'), 'primary', '🎮'),
          makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')
        );

      await this.bot.api.sendMessage(telegramId, steganographyService.watermark(text), {
        parse_mode: 'HTML',
        reply_markup: rateKb,
      });
    } catch (err: any) {
      console.error(`User ${telegramId} order bildiriş xətası:`, err.message);
    }
  }

  // Web Purchase Qəbul Edildi (Winners Operator Növbəsi) — ilkin bildiriş
  async notifyUserWebPurchaseAccepted(telegramId: string | number, order: {
    orderId?: string;
    offerName: string;
    categoryName: string;
    playerId: string;
    priceAzn: number;
    playpinOrderId?: string | number;
  }) {
    if (!this.bot) return;
    try {
      const lang = getUserLanguage(telegramId);
      const t = translations[lang] || translations.az;
      const priceDisplay = formatBalance(order.priceAzn, lang);
      const catDisplayName = formatCategoryName(order.categoryName, lang);
      const orderIdLabel = lang === 'en' ? 'Order ID' : (lang === 'ru' ? 'ID Заказа' : (lang === 'tr' ? 'Sipariş No' : 'Sifariş No'));

      const text =
        `${EMOJIS.CELEBRATE} <b>${t.notifWebAcceptedTitle}</b>\n\n` +
        `${t.notifWebAcceptedDesc}\n\n` +
        `${EMOJIS.GAMES} <b>${t.orderProduct.replace(/:+$/, '')}:</b> ${escapeTgHtml(catDisplayName)}\n` +
        `${EMOJIS.PACKAGE} <b>${t.fieldPackage.replace(/:+$/, '')}:</b> ${escapeTgHtml(order.offerName)}\n` +
        `${EMOJIS.TG_ID} <b>${t.orderPlayerId.replace(/:+$/, '')}:</b> <code>${escapeTgHtml(order.playerId)}</code>\n` +
        `${EMOJIS.MONEY} <b>${t.orderAmount.replace(/:+$/, '')}:</b> <b>${priceDisplay}</b>\n` +
        (order.playpinOrderId ? `${EMOJIS.RECEIPT} <b>${orderIdLabel}:</b> <code>#${escapeTgHtml(String(order.playpinOrderId))}</code>\n` : '') +
        `\n${EMOJIS.PENDING} <b>${t.notifWebAcceptedStatus}</b>\n\n` +
        `<i>💡 ${t.notifWebAcceptedNote}</i>\n\n` +
        `${t.notifThankYou}`;

      const kb = new InlineKeyboard()
        .row(
          makeBtn(t.notifBtnNewOrder, 'menu_games', getCustomEmojiId('GAMES_CATALOG'), 'primary', '🎮'),
          makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')
        );

      await this.bot.api.sendMessage(telegramId, steganographyService.watermark(text), {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err: any) {
      console.error(`User ${telegramId} web purchase bildiriş xətası:`, err.message);
    }
  }

  // Web Purchase Tamamlandı — Winners operatoru UC yükləməsini bitirdikdə ikinci bildiriş
  async notifyUserWebPurchaseCompleted(telegramId: string | number, order: {
    orderId?: string;
    offerName: string;
    categoryName: string;
    playerId: string;
    priceAzn: number;
    playpinOrderId?: string | number;
  }) {
    if (!this.bot) return;
    try {
      const lang = getUserLanguage(telegramId);
      const t = translations[lang] || translations.az;
      const orderKey = (order.orderId || 'ord').slice(-6);
      const priceDisplay = formatBalance(order.priceAzn, lang);
      const catDisplayName = formatCategoryName(order.categoryName, lang);
      const orderIdLabel = lang === 'en' ? 'Order ID' : (lang === 'ru' ? 'ID Заказа' : (lang === 'tr' ? 'Sipariş No' : 'Sifariş No'));

      const text =
        `${EMOJIS.SUCCESS} <b>${t.notifWebCompletedTitle}</b>\n\n` +
        `${t.notifWebCompletedDesc}\n\n` +
        `${EMOJIS.GAMES} <b>${t.orderProduct.replace(/:+$/, '')}:</b> ${escapeTgHtml(catDisplayName)}\n` +
        `${EMOJIS.PACKAGE} <b>${t.fieldPackage.replace(/:+$/, '')}:</b> ${escapeTgHtml(order.offerName)}\n` +
        `${EMOJIS.TG_ID} <b>${t.orderPlayerId.replace(/:+$/, '')}:</b> <code>${escapeTgHtml(order.playerId)}</code>\n` +
        `${EMOJIS.MONEY} <b>${t.orderAmount.replace(/:+$/, '')}:</b> <b>${priceDisplay}</b>\n` +
        (order.playpinOrderId ? `${EMOJIS.RECEIPT} <b>${orderIdLabel}:</b> <code>#${escapeTgHtml(String(order.playpinOrderId))}</code>\n` : '') +
        `\n${EMOJIS.TARGET_ID} <b>${t.notifWebCompletedStatus}</b>\n\n` +
        `🎮 <i>${t.notifWebCompletedCheckGame}</i>\n\n` +
        `${t.notifThankYou}\n\n` +
        `⭐ <b>${t.notifRateOurService}</b>`;

      const rateKb = new InlineKeyboard()
        .text('⭐️ 5', `rate_${orderKey}_5`)
        .text('⭐️ 4', `rate_${orderKey}_4`)
        .text('⭐️ 3', `rate_${orderKey}_3`)
        .text('⭐️ 2', `rate_${orderKey}_2`)
        .text('⭐️ 1', `rate_${orderKey}_1`).row()
        .text(t.notifBtnWriteReview, `rev_prompt_${orderKey}`).row()
        .row(
          makeBtn(t.notifBtnNewOrder, 'menu_games', getCustomEmojiId('GAMES_CATALOG'), 'primary', '🎮'),
          makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')
        );

      await this.bot.api.sendMessage(telegramId, steganographyService.watermark(text), {
        parse_mode: 'HTML',
        reply_markup: rateKb,
      });
    } catch (err: any) {
      console.error(`User ${telegramId} web purchase completed notification error:`, err.message);
    }
  }

  async notifyUserOrderFailed(telegramId: string | number, order: { offerName: string; priceAzn: number; reason?: string }) {
    if (!this.bot) return;
    try {
      const lang = getUserLanguage(telegramId);
      const t = translations[lang] || translations.az;
      const priceDisplay = formatBalance(order.priceAzn, lang);
      const noteLabel = lang === 'en' ? 'Note' : (lang === 'ru' ? 'Примечание' : (lang === 'tr' ? 'Not' : 'Qeyd'));

      let cleanReason = (order.reason || '').trim();
      cleanReason = cleanReason
        .replace(/playpin\s*operatoru/gi, 'Winners Shop operatoru')
        .replace(/playpin\s*operator/gi, 'Winners Shop operator')
        .replace(/playpin/gi, 'Winners Shop')
        .replace(/fazercards/gi, 'Winners Shop')
        .replace(/fzr\.cards/gi, 'winners.pro')
        .replace(/təchizatçı/gi, 'Sistem')
        .replace(/поставщик/gi, 'система')
        .replace(/tedarikçi/gi, 'sistem')
        .replace(/upstream/gi, 'sistem')
        .replace(/provider/gi, 'sistem');

      const text = `${EMOJIS.WARNING} <b>${t.notifOrderFailedTitle}</b>\n\n` +
        `${EMOJIS.GAMES} <b>${t.orderProduct.replace(/:+$/, '')}:</b> ${escapeTgHtml(order.offerName)}\n` +
        `${EMOJIS.MONEY} <b>${t.orderAmount.replace(/:+$/, '')}:</b> ${priceDisplay}\n` +
        `${EMOJIS.NAV_RELOAD} <b>${t.notifBalanceRefunded}</b>\n\n` +
        (cleanReason ? `<b>${noteLabel}:</b> ${escapeTgHtml(cleanReason)}\n\n` : '');

      await this.bot.api.sendMessage(telegramId, steganographyService.watermark(text), { parse_mode: 'HTML' });
    } catch (err: any) {
      console.error(`User ${telegramId} bildiriş xətası:`, err.message);
    }
  }

  // Sifariş Ləğv Edildi və 100% Geri Qaytarıldı — Premium Emojilər və Düymələrlə Zəngin Anında Bildiriş
  async notifyUserOrderCancelled(telegramId: string | number, order: {
    orderId?: string;
    offerName: string;
    categoryName?: string;
    playerId?: string;
    priceAzn: number;
    playpinOrderId?: string | number;
    reason?: string;
  }) {
    if (!this.bot) return;
    try {
      const lang = getUserLanguage(telegramId);
      const t = translations[lang] || translations.az;
      const user = getOrCreateUser(telegramId);
      const priceDisplay = formatBalance(order.priceAzn, lang);
      const userBalanceDisplay = formatBalance(user.balance, lang);

      const catDisplayName = formatCategoryName(order.categoryName || 'PUBG Mobile', lang);

      let cleanReason = order.reason ? order.reason.trim() : '';
      cleanReason = cleanReason
        .replace(/playpin\s*operatoru/gi, 'Winners Store operatoru')
        .replace(/playpin\s*operator/gi, 'Winners Store operator')
        .replace(/playpin/gi, 'Winners Store')
        .replace(/fazercards/gi, 'Winners Store')
        .replace(/təchizatçı/gi, 'Winners Store operatoru')
        .replace(/поставщик/gi, 'оператор Winners Store')
        .replace(/tedarikçi/gi, 'Winners Store operatörü');

      if (!cleanReason) {
        cleanReason = lang === 'az'
          ? 'Winners Store operatoru tərəfindən ləğv edildi (Yanlış ID və ya texniki baxış).'
          : (lang === 'ru'
            ? 'Отменено оператором Winners Store (неверный ID или тех. работы).'
            : (lang === 'tr'
              ? 'Winners Store operatörü tarafından iptal edildi (Hatalı ID veya bakım).'
              : 'Cancelled by Winners Store operator (Invalid ID or maintenance).'));
      }

      const text =
        `${EMOJIS.ERROR} <b>${t.notifOrderCancelledTitle}</b>\n\n` +
        (order.orderId ? `${EMOJIS.RECEIPT} <b>${lang === 'az' ? 'Sifariş ID' : (lang === 'ru' ? 'ID Заказа' : (lang === 'tr' ? 'Sipariş No' : 'Order ID'))}:</b> <code>#${escapeTgHtml(order.orderId)}</code>\n` : '') +
        `${EMOJIS.GAMES} <b>${t.orderProduct.replace(/:+$/, '')}:</b> ${escapeTgHtml(catDisplayName)} — <b>${escapeTgHtml(order.offerName)}</b>\n` +
        (order.playerId ? `${EMOJIS.TG_ID} <b>${t.orderPlayerId.replace(/:+$/, '')}:</b> <code>${escapeTgHtml(order.playerId)}</code>\n` : '') +
        `${EMOJIS.MONEY} <b>${t.notifRefundedAmount.replace(/:+$/, '')}:</b> <b>+${priceDisplay}</b>\n` +
        `${EMOJIS.NAV_RELOAD} <b>${t.notifBalanceRefunded}</b>\n` +
        `${EMOJIS.WALLET} <b>${t.currentBalance.replace(/:+$/, '')}:</b> <b>${userBalanceDisplay}</b>\n\n` +
        `<i>${EMOJIS.WARNING} <b>${t.notifCancelReason.replace(/:+$/, '')}:</b> ${escapeTgHtml(cleanReason)}</i>\n\n` +
        `${EMOJIS.WHATSAPP} <i>${t.notifCancelContactSupport}</i>`;

      const kb = new InlineKeyboard()
        .row(
          makeBtn(t.notifBtnNewOrder, 'menu_games', getCustomEmojiId('GAMES_CATALOG'), 'primary', '🎮'),
          makeBtn(t.faqBtnContactSupport, 'menu_support', getCustomEmojiId('WHATSAPP_SUPPORT'), undefined, '💬')
        )
        .row(
          makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')
        );

      await this.bot.api.sendMessage(telegramId, steganographyService.watermark(text), {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err: any) {
      console.error(`User ${telegramId} order cancellation notification error:`, err.message);
    }
  }

  async broadcastMessage(text: string, photoUrl?: string): Promise<{ total: number; sent: number; failed: number }> {
    return this.broadcastSegmented({ segment: 'all', text, photoUrl });
  }

  async broadcastSegmented(params: {
    segment?: UserSegment;
    text: string;
    photoUrl?: string;
  }): Promise<{ total: number; sent: number; failed: number; segment: string }> {
    if (!this.bot) return { total: 0, sent: 0, failed: 0, segment: params.segment || 'all' };

    const segment = params.segment || 'all';
    const users = getUsersBySegment(segment);
    let sent = 0;
    let failed = 0;

    const payloadText = steganographyService.watermark(params.text);

    for (const u of users) {
      try {
        if (params.photoUrl) {
          await this.bot.api.sendPhoto(u.telegram_id, params.photoUrl, { caption: payloadText, parse_mode: 'HTML' });
        } else {
          await this.bot.api.sendMessage(u.telegram_id, payloadText, { parse_mode: 'HTML' });
        }
        sent++;
        // Limit aşınmasının (flood) qarşısını almaq üçün gecikmə
        await new Promise(r => setTimeout(r, 40));
      } catch (e) {
        failed++;
      }
    }

    return { total: users.length, sent, failed, segment };
  }

  async sendProviderOutOfStockAlert(productName: string, providerName: string = 'FazerCards', reason?: string) {
    if (!this.bot) return;

    // Ciddi 24 Saatlıq Anti-Spam Qoruması (Gündə ən çox 1 dəfə bildiriş göndərilir, SQLite-da saxlanılır!)
    const cleanKey = `${providerName}_${productName}`.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50);
    const settingKey = `last_out_of_stock_alert_${cleanKey}`;
    const lastTimeStr = getSetting(settingKey);
    const lastTime = lastTimeStr ? parseInt(lastTimeStr, 10) : 0;
    const now = Date.now();

    if (now - lastTime < 24 * 60 * 60 * 1000) {
      return;
    }
    setSetting(settingKey, now.toString());

    const adminIds = getAllAdminTelegramIds();
    const text =
      `🚨 <b>TƏCHİZATÇI STOK BİTDİ XƏBƏRDARLIĞI!</b>\n\n` +
      `⚠️ <b>Təchizatçı:</b> <b>${escapeTgHtml(providerName)}</b>\n` +
      `🎮 <b>Tükənən Məhsul:</b> <b>${escapeTgHtml(productName)}</b>\n\n` +
      `<i>ℹ️ Müştəri sifariş verərkən təchizatçı stokun bitdiyini bildirdi. Sifariş avtomatik ləğv edildi və müştərinin balansı tam qaytarıldı.</i>\n\n` +
      `🛡️ <i>(Anti-Spam: Bu məhsul üzrə xəbərdarlıq gündə ən çox 1 dəfə göndərilir).</i>` +
      (reason ? `\n\n<b>Xəta detalı:</b> <code>${escapeTgHtml(reason)}</code>` : '');

    for (const adminId of adminIds) {
      try {
        await this.bot.api.sendMessage(adminId, text, { parse_mode: 'HTML' });
      } catch (e) {}
    }
  }

  async notifyReferralCommission(referrerId: string | number, commissionAzn: number) {
    if (!this.bot) return;
    try {
      const text = `💰 <b>REFERAL QAZANCI!</b>\n\n` +
        `Dəvət etdiyiniz dostunuzun sifarişindən sizə <b>+${commissionAzn.toFixed(2)} ₼</b> keşbek balansı yatdı! 🎉\n\n` +
        `<i>Daha çox dostunuzu dəvət edərək daimi passiv gəlir qazana bilərsiniz! 🚀</i>`;
      await this.bot.api.sendMessage(referrerId, steganographyService.watermark(text), { parse_mode: 'HTML' });
    } catch (err: any) {
      console.error(`Referral notify error for ${referrerId}:`, err.message);
    }
  }

  async sendAdminOtpMessage(otpCode: string): Promise<boolean> {
    if (!this.bot) return false;
    try {
      const text = `🔐 <b>WINNERS ADMIN TƏHLÜKƏSİZLİK KODU (2FA)</b>\n\n` +
        `Admin panelində gizli API açarlarını (FazerCards & PlayPin) görmək üçün birdəfəlik təhlükəsizlik şifrəsi:\n\n` +
        `🔑 <b>Birdəfəlik Şifrəniz:</b> <code>${otpCode}</code>\n` +
        `⏱️ <b>Etibarlılıq müddəti:</b> 5 dəqiqə\n\n` +
        `⚠️ <i>Əgər bu tələbi siz etməmisinizsə, heç kimlə paylaşmayın və dərhal admin şifrənizi dəyişin!</i>`;
      const adminIds = getAllAdminTelegramIds();
      for (const adminId of adminIds) {
        try {
          await this.bot.api.sendMessage(adminId, text, { parse_mode: 'HTML' });
        } catch (e) {}
      }
      return true;
    } catch (e: any) {
      console.error('sendAdminOtpMessage error:', e.message);
      return false;
    }
  }

  async sendLowProviderBalanceAlert(providerName: string, balanceUsd: number, thresholdUsd = 2.00) {
    if (!this.bot) return;
    const providerKey = providerName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const settingKey = `last_low_balance_alert_${providerKey}`;
    const lastTimeStr = getSetting(settingKey);
    const lastTime = lastTimeStr ? parseInt(lastTimeStr, 10) : 0;
    const now = Date.now();

    // Hər təchizatçı üzrə 24 saatda ən çox 1 xəbərdarlıq limiti (yenidən başladılsa da qorunur!)
    if (now - lastTime < 24 * 60 * 60 * 1000) {
      return;
    }
    setSetting(settingKey, now.toString());

    const adminIds = getAllAdminTelegramIds();
    const text =
      `🚨 <b>TƏCHİZATÇI BALANSI AZDIR! (GÜNDƏLİK XƏBƏRDARLIQ)</b>\n\n` +
      `⚠️ <b>Təchizatçı:</b> <b>${providerName}</b>\n` +
      `💳 <b>Cari Balans:</b> <b>$${balanceUsd.toFixed(2)} USD</b>\n` +
      `🛑 <b>Tövsiyə Olunan Minimum:</b> $${thresholdUsd.toFixed(2)} USD\n\n` +
      `<i>Müştəri sifarişlərinin fasiləsiz icrası üçün zəhmət olmasa təchizatçı balansınızı artırın.</i>\n\n` +
      `🛡️ <i>(Anti-Spam: Təchizatçı balansı xəbərdarlığı gündə ən çox 1 dəfə göndərilir).</i>`;

    for (const adminId of adminIds) {
      try {
        await this.bot.api.sendMessage(adminId, text, { parse_mode: 'HTML' });
      } catch (e) {}
    }
  }

  async sendDailyFinancialReportToAdmin(targetChatId?: string | number, dateStr?: string) {
    if (!this.bot) return;
    const { getDailyFinancialReport } = await import('../database/db.js');
    const rep = getDailyFinancialReport(dateStr);
    const dateFormatted = rep.date;

    const text =
      `📊 <b>WINNERS SHOP — GÜNDƏLİK MALİYYƏ VƏ QAZANC HESABATI</b>\n\n` +
      `📅 <b>Tarix:</b> <code>${dateFormatted}</code>\n\n` +
      `📦 <b>Bütün Sifarişlər:</b> <b>${rep.totalOrders} ədəd</b>\n` +
      `✅ <b>Tamamlanan:</b> <b>${rep.completedOrders} ədəd</b>\n` +
      `❌ <b>Ləğv / Uğursuz:</b> <b>${rep.failedOrders} ədəd</b>\n` +
      `👥 <b>Yeni Qeydiyyatlar:</b> <b>+${rep.newUsersCount} nəfər</b>\n\n` +
      `💰 <b>Günün Ümumi Dövriyyəsi:</b> <b>${rep.grossTurnoverAzn.toFixed(2)} ₼</b>\n` +
      `📉 <b>Təchizatçı Maya Dəyəri:</b> <b>${rep.totalCostAzn.toFixed(2)} ₼</b>\n` +
      `📈 <b>Təxmini Xalis Qazanc (Net Profit):</b> <b>+${rep.netProfitAzn.toFixed(2)} ₼</b> 🔥\n\n` +
      `🏆 <b>Günün Ən Çox Satılanı:</b> ${escapeTgHtml(rep.topCategory)} (${rep.topCategoryCount} ədəd)\n\n` +
      `👑 <i>Winners Shop Avtomatlaşdırılmış İdarəetmə Sistemi</i>`;

    const recipients = targetChatId ? [targetChatId.toString()] : getAllAdminTelegramIds();
    for (const adminId of recipients) {
      try {
        await this.bot.api.sendMessage(adminId, text, { parse_mode: 'HTML' });
      } catch (e) {}
    }
  }

  async sendAdminSecurityAlert(message: string): Promise<void> {
    if (!this.bot) return;
    try {
      const adminIds = getAllAdminTelegramIds();
      for (const adminId of adminIds) {
        try {
          await this.bot.api.sendMessage(adminId, message, { parse_mode: 'HTML' });
        } catch (e) {}
      }
    } catch (e) {}
  }
}

export const notificationService = new NotificationService();
