import { Context, InlineKeyboard } from 'grammy';
import {
  getOrCreateUser,
  getUserOrders,
  confirmAuthSession,
  getRatingStats,
  getRecentReviews,
  addReferral,
  getReferralStats,
  getAllActiveApiCategories,
  getActiveApiCategoriesByType,
  hasUserChosenLanguage,
  isUserAdmin,
  getCustomOfferPrice,
} from '../database/db.js';
import {
  getMainInlineMenu,
  getGamesMenuKeyboard,
  getPubgMenuKeyboard,
  getTelegramServicesKeyboard,
  getPaymentMenuKeyboard,
  getBackToMainKeyboard,
  getLanguageKeyboard,
  formatPrice,
  formatBalance,
  makeBtn,
  makeUrlBtn,
} from './menus.js';
import { getUserLanguage, setUserLanguage, getT, translations } from '../i18n/index.js';
import { settingsService } from '../services/settings.service.js';
import { escapeTgHtml } from '../services/notification.service.js';
import { EMOJIS, getCategoryEmoji, getCategoryCustomEmojiId, getCustomEmojiId } from './emojis.js';
import { config } from '../config/config.js';


export interface UserState {
  step: 'idle' | 'awaiting_player_id' | 'awaiting_binance_amount' | 'awaiting_binance_id' | 'awaiting_m10_receipt' | 'awaiting_card_receipt' | 'awaiting_broadcast_text' | 'awaiting_review_comment' | 'awaiting_game_search' | 'awaiting_user_direct_msg' | 'awaiting_admin_user_search' | 'awaiting_admin_order_search';
  extra?: {
    targetTgId?: string;
    [key: string]: any;
  };
  data?: {
    categoryId?: string;
    categoryName?: string;
    offerId?: string;
    offerName?: string;
    priceUsd?: number;
    priceAzn?: number;
    playerId?: string;
    type?: 'topup' | 'giftcard' | 'custom_topup';
    amountUsd?: number;
    amountAzn?: number;
    expiresAt?: number;
    method?: 'binance' | 'usdt_trc20' | 'usdt_bep20';
    messageId?: number;
    orderId?: string;
  };
}

const userStates = new Map<string, UserState>();

export function getUserState(telegramId: string | number): UserState {
  const idStr = telegramId.toString();
  if (!userStates.has(idStr)) {
    userStates.set(idStr, { step: 'idle' });
  }
  return userStates.get(idStr)!;
}

export function setUserState(telegramId: string | number, state: UserState) {
  userStates.set(telegramId.toString(), state);
}

export function clearUserState(telegramId: string | number) {
  userStates.set(telegramId.toString(), { step: 'idle' });
}

// Universal Möhkəm Mesaj Redaktoru və Ehtiyat Göndərici
export async function sendOrEdit(ctx: Context, text: string, markup: any, isEdit = true) {
  if (isEdit && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: markup });
      try {
        await ctx.answerCallbackQuery();
      } catch (_) {}
      return;
    } catch (err: any) {
      if (err?.description?.includes('message is not modified')) {
        try {
          await ctx.answerCallbackQuery();
        } catch (_) {}
        return;
      }
      // Redaktə uğursuz olduqda (məs. şəkil mesajı, vaxtı keçmiş mesaj, və ya başlıq), ctx.reply-ə keç
      try {
        await ctx.answerCallbackQuery();
      } catch (_) {}
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: markup });
      return;
    }
  }
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: markup });
}

// Əsas Menyunu Göstər (həm dil seçimindən sonra /start, həm də "menu_main" callback sorğusu üçün)
export async function renderMainMenu(ctx: Context, isEdit = false) {
  if (!ctx.from) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
  clearUserState(ctx.from.id);

  const isAdmin = isUserAdmin(ctx.from.id);
  const lang = getUserLanguage(ctx.from.id);
  const t = getT(ctx.from.id);
  const userName = ctx.from.first_name || ctx.from.username || 'Müştəri';

  const balanceDisplay = formatBalance(user.balance, lang);

  const welcomeText = `${EMOJIS.MAIN_MENU} <b>WINNERS SHOP</b>\n` +
    `<i>${t.welcomeSub}</i>\n\n` +
    `${EMOJIS.PROFILE} <b>${t.profile}:</b> ${userName}\n` +
    `${EMOJIS.TG_ID} <b>ID:</b> <code>${user.telegram_id}</code>\n` +
    `${EMOJIS.WALLET} <b>${t.currentBalance}</b> <b>${balanceDisplay}</b>\n\n` +
    `${EMOJIS.TARGET_ID} <i>${t.welcomeHeader}</i>`;

  const markup = getMainInlineMenu(isAdmin, lang);
  await sendOrEdit(ctx, welcomeText, markup, isEdit);
}

export async function handleStart(ctx: Context) {
  if (!ctx.from) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);

  // Deep-link start payload-da auth_<code> və ya açıq kod olub-olmadığını yoxla (məs. /start auth_555162 və ya /start 555162)
  const text = (ctx.message?.text || '').trim();
  const match = text.match(/\/start\s+(?:auth_)?([A-Za-z0-9_-]+)/i);

  if (match && match[1]) {
    const authCode = match[1].trim().toUpperCase();
    const confirmed = confirmAuthSession(authCode, ctx.from.id.toString(), ctx.from.username, ctx.from.first_name);

    if (confirmed) {
      const lang = getUserLanguage(ctx.from.id);
      const t = translations[lang] || translations.az;
      const kb = new InlineKeyboard().text(t.gamesMenu || '🎮 Games Menu', 'menu_games').text(t.home || '🏠 Main Menu', 'menu_main');
      if (config.server.webAppUrl && config.server.webAppUrl.startsWith('https://')) {
        kb.row().url(t.navWebStore || '🌐 Winners Web Store', config.server.webAppUrl);
      }

      const balanceDisplay = formatBalance(user.balance, lang);
      const title = lang === 'en' ? 'REGISTRATION & LOGIN CONFIRMED!' :
                    lang === 'ru' ? 'РЕГИСТРАЦИЯ И ВХОД ПОДТВЕРЖДЕНЫ!' :
                    lang === 'tr' ? 'KAYIT VE GİRİŞ ONAYLANDI!' :
                    'QEYDİYYAT VƏ SAYTA GİRİŞİNİZ TƏSDİQLƏNDİ!';
      const tgIdLabel = 'Telegram ID:';
      const usernameLabel = lang === 'en' ? 'Username:' : lang === 'ru' ? 'Имя пользователя:' : lang === 'tr' ? 'Kullanıcı Adı:' : 'İstifadəçi adı:';
      const sub = lang === 'en' ? 'Your account has been activated on <b>Winners Shop</b> website. You can now return to the web store and place orders directly! 🚀' :
                  lang === 'ru' ? 'Ваш аккаунт активирован на сайте <b>Winners Shop</b>. Теперь вы можете вернуться на сайт и оформлять заказы напрямую! 🚀' :
                  lang === 'tr' ? 'Hesabınız <b>Winners Shop</b> web sitesinde doğrulandı. Artık siteye dönüp doğrudan sipariş verebilirsiniz! 🚀' :
                  '<b>Winners Shop</b> vebsaytında hesabınız aktivləşdirildi. İndi sayta qayıdıb birbaşa sifariş verə bilərsiniz! 🚀';

      await ctx.reply(
        `${EMOJIS.CELEBRATE} <b>${title}</b>\n\n` +
        `${EMOJIS.PROFILE} <b>${t.userProfileTitle || 'İstifadəçi'}:</b> ${escapeTgHtml(ctx.from.first_name || 'Player')}\n` +
        `${EMOJIS.TG_ID} <b>${tgIdLabel}</b> <code>${ctx.from.id}</code>\n` +
        `${EMOJIS.USERNAME} <b>${usernameLabel}</b> ${ctx.from.username ? `@${ctx.from.username}` : (lang === 'en' ? 'None' : lang === 'ru' ? 'Нет' : lang === 'tr' ? 'Yok' : 'Yoxdur')}\n` +
        `${EMOJIS.WALLET} <b>${t.currentBalance || 'Cari Balansınız:'}</b> <b>${balanceDisplay}</b>\n\n` +
        `${EMOJIS.NAV_WEB} ${sub}`,
        {
          parse_mode: 'HTML',
          reply_markup: kb
        }
      );
      return;
    }

    // Start payload-un dəvət linki olub-olmadığını yoxla: ref_<tgId>
    if (match[1].startsWith('ref_')) {
      const referrerId = match[1].replace(/^ref_/, '').trim();
      if (referrerId && referrerId !== ctx.from.id.toString()) {
        const added = addReferral(referrerId, ctx.from.id);
        if (added) {
          try {
            const refLang = getUserLanguage(referrerId);
            const refTitle = refLang === 'en' ? 'YOU HAVE A NEW REFERRAL!' :
                             refLang === 'ru' ? 'У ВАС НОВЫЙ РЕФЕРАЛ!' :
                             refLang === 'tr' ? 'YENİ BİR DAVETİNİZ VAR!' :
                             'YENİ DƏVƏTİNİZ VAR!';
            const refDesc = refLang === 'en' ? 'You will automatically earn 1% cashback on every purchase made by your friend! 💰' :
                            refLang === 'ru' ? 'Вы будете автоматически получать 1% кэшбэка с каждой покупки вашего друга! 💰' :
                            refLang === 'tr' ? 'Arkadaşınızın yaptığı her alışverişten otomatik olarak %1 nakit iade (cashback) kazanacaksınız! 💰' :
                            'Dostunuzun etdiyi hər alış-verişdən sizə avtomatik 1% keşbek balansı yatacaqdır! 💰';
            await ctx.api.sendMessage(
              referrerId,
              `🎉 <b>${refTitle}</b>\n\n` +
              `👤 <b>${refLang === 'en' ? 'User:' : refLang === 'ru' ? 'Пользователь:' : refLang === 'tr' ? 'Kullanıcı:' : 'İstifadəçi:'}</b> ${escapeTgHtml(ctx.from.first_name || 'Friend')}\n\n` +
              `${refDesc}`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {}
        }
      }
    }

    // Start payload-un məhsul alış deep-linki olub-olmadığını yoxla: buy_<cat>_<offer>
    if (match[1].startsWith('buy_')) {
      const payload = match[1].replace(/^buy_/, '');
      try {
        const { fazerCardsService } = await import('../services/fazercards.service.js');
        const { settingsService } = await import('../services/settings.service.js');
        const cats = await fazerCardsService.fetchAllCategories();
        
        let foundCat = cats.topups.find(c => payload.startsWith(c.category_id)) || cats.giftcards.find(c => payload.startsWith(c.category_id));
        let offerId = '';
        if (foundCat) {
          offerId = payload.slice(foundCat.category_id.length + 1);
        } else {
          const lastIdx = payload.lastIndexOf('_');
          const catId = payload.slice(0, lastIdx);
          offerId = payload.slice(lastIdx + 1);
          foundCat = cats.topups.find(c => c.category_id === catId) || cats.giftcards.find(c => c.category_id === catId) || { category_id: catId, name: catId, type: 'topup' as const };
        }

        const offersRes = await fazerCardsService.getOffers(foundCat.category_id, foundCat.type);
        const offer = offersRes.offers?.find(o => o.offer_id === offerId) || offersRes.offers?.[0];

        if (offer) {
          const custom = getCustomOfferPrice(foundCat.category_id, offer.offer_id);
          const rate = settingsService.getUsdAznRate() || 1.70;
          const priceAzn = custom && typeof custom.custom_price_azn === 'number' && custom.custom_price_azn > 0
            ? custom.custom_price_azn
            : settingsService.calculateAznPrice(offer.price_usd);

          const priceUsd = custom && typeof custom.custom_price_usd === 'number' && custom.custom_price_usd > 0
            ? custom.custom_price_usd
            : Number((priceAzn / rate).toFixed(2));

          const lang = getUserLanguage(ctx.from.id);
          const t = translations[lang] || translations.az;
          const priceFormatted = formatPrice(priceAzn, priceUsd, lang);
          const balanceFormatted = formatBalance(user.balance, lang);

          if (foundCat.type === 'topup') {
            setUserState(ctx.from.id, {
              step: 'awaiting_player_id',
              data: {
                categoryId: foundCat.category_id,
                categoryName: foundCat.name,
                offerId: offer.offer_id,
                offerName: offer.name,
                priceUsd: priceUsd,
                priceAzn: priceAzn,
                type: 'topup'
              }
            });

            await ctx.reply(
              `🎮 <b>${t.catalogTitle || 'SİFARİŞ'}: ${foundCat.name}</b>\n\n` +
              `📦 <b>${t.fieldPackage || 'Paket:'}</b> ${offer.name}\n` +
              `💰 <b>${t.fieldAmountToPay || 'Qiymət:'}</b> <b>${priceFormatted}</b>\n` +
              `💳 <b>${t.currentBalance || 'Cari Balansınız:'}</b> <b>${balanceFormatted}</b>\n\n` +
              `🎯 ${t.promptTypePlayerId || 'Zəhmət olmasa Oyunçu ID-nizi (Player ID) daxil edin:'}`,
              {
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard().text(t.cancel || '❌ Cancel', 'menu_main')
              }
            );
            return;
          } else {
            const kb = new InlineKeyboard()
              .text(`✅ ${t.confirm || 'Confirm'} (${priceFormatted})`, `confirm_buy_gc_${foundCat.category_id}_${offer.offer_id}`)
              .row()
              .text(t.cancel || '❌ Cancel', 'menu_main');

            await ctx.reply(
              `🎁 <b>${t.orderConfirmTitle || 'HƏDİYYƏ KARTI SİFARİŞİ'}:</b>\n\n` +
              `📦 <b>${t.fieldGame || 'Məhsul:'}</b> ${foundCat.name} — ${offer.name}\n` +
              `💰 <b>${t.fieldAmountToPay || 'Qiymət:'}</b> <b>${priceFormatted}</b>\n` +
              `💳 <b>${t.currentBalance || 'Cari Balansınız:'}</b> <b>${balanceFormatted}</b>\n\n` +
              `<i>${t.noteEpin || 'Təsdiq etdikdən sonra rəqəmsal aktivasiya kodu 3 saniyəyə dərhal çatınıza göndəriləcəkdir.'}</i>`,
              {
                parse_mode: 'HTML',
                reply_markup: kb
              }
            );
            return;
          }
        }
      } catch (err) {}
    }
  }

  // İstifadəçi artıq dil seçibsə, birbaşa Əsas Menyunu aç!
  if (hasUserChosenLanguage(ctx.from.id)) {
    return renderMainMenu(ctx, false);
  }

  // Hələ dil seçməmiş ilk dəfə istifadəçi: /start-da Dil Seçimini Göstər!
  const startLangText = `🌐 <b>Zəhmət olmasa dil seçin / Пожалуйста, выберите язык / Please select your language / Lütfen dil seçiniz:</b>\n\n` +
    `🇦🇿 <b>Azərbaycan</b> — Qiymətlər Manat (₼) ilə\n` +
    `🇬🇧 <b>English</b> — Prices in US Dollar ($)\n` +
    `🇷🇺 <b>Русский</b> — Цены в долларах ($)\n` +
    `🇹🇷 <b>Türkçe</b> — Fiyatlar Dolar ($) ile`;

  const kb = getLanguageKeyboard(false);
  await ctx.reply(startLangText, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

// İstifadəçi Profilini Göstər
export async function renderProfile(ctx: Context, isEdit = true) {
  if (!ctx.from) return;
  const lang = getUserLanguage(ctx.from.id);
  const t = getT(ctx.from.id);
  const user = getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
  const orders = getUserOrders(ctx.from.id, 5);

  const balanceDisplay = formatBalance(user.balance, lang);

  let text = `${EMOJIS.PROFILE} <b>${t.userProfileTitle}</b>\n\n` +
    `${EMOJIS.TG_ID} <b>ID:</b> <code>${user.telegram_id}</code>\n` +
    `${EMOJIS.PROFILE} <b>${t.profile}:</b> ${user.first_name || '—'}\n` +
    `${EMOJIS.USERNAME} <b>Username:</b> ${user.username ? `@${user.username}` : '—'}\n` +
    `${EMOJIS.WALLET} <b>${t.currentBalance}</b> <b>${balanceDisplay}</b>\n` +
    `${EMOJIS.DATE} <b>${t.profileRegDate}</b> ${user.created_at || t.profileNewUser}\n\n` +
    `${EMOJIS.CART} <b>${t.orders}:</b>\n`;

  if (orders.length === 0) {
    text += `<i>${t.noOrdersYet}</i>`;
  } else {
    orders.forEach((o, i) => {
      const statusIcon = o.status === 'completed' ? EMOJIS.SUCCESS : (o.status === 'failed' ? EMOJIS.ERROR : EMOJIS.PENDING);
      const priceDisplay = formatPrice(o.price_azn, o.price_usd, lang);
      text += `${i + 1}. ${statusIcon} <b>${o.category_name}</b> (${o.offer_name}) — <b>${priceDisplay}</b>\n`;
    });
  }

  const kb = getBackToMainKeyboard(lang);
  await sendOrEdit(ctx, text, kb, isEdit);
}

// Sifariş Tarixçəsini Göstər
export async function renderOrders(ctx: Context, isEdit = true) {
  if (!ctx.from) return;
  const lang = getUserLanguage(ctx.from.id);
  const t = getT(ctx.from.id);
  const orders = getUserOrders(ctx.from.id, 5);

  let text = '';
  if (orders.length === 0) {
    text = `${EMOJIS.ORDERS} <b>${t.orders}</b>\n\n` +
      `<i>${t.noOrdersYet}</i>`;
  } else {
    text = `${EMOJIS.ORDERS} <b>${t.orders}:</b>\n\n`;
    orders.forEach((o, i) => {
      const statusLabel = o.status === 'completed' ? `${EMOJIS.SUCCESS} ${t.orderStatusCompleted}` : (o.status === 'failed' ? `${EMOJIS.ERROR} ${t.orderStatusFailed}` : `${EMOJIS.PENDING} ${t.orderStatusProcessing}`);
      const priceDisplay = formatPrice(o.price_azn, o.price_usd, lang);
      text += `<b>${i + 1}.</b> <code>${o.id}</code>\n` +
        `${EMOJIS.GAMES} <b>${t.orderProduct}</b> ${o.category_name} - ${o.offer_name}\n` +
        (o.player_id ? `${EMOJIS.TG_ID} <b>${t.orderPlayerId}</b> <code>${o.player_id}</code>\n` : '') +
        `${EMOJIS.MONEY} <b>${t.orderAmount}</b> ${priceDisplay}\n` +
        `${EMOJIS.PIN} <b>${t.orderStatus}</b> ${statusLabel}\n` +
        `${EMOJIS.DATE} <b>${t.orderDate}</b> ${o.created_at}\n\n`;
    });
  }

  const kb = getBackToMainKeyboard(lang);
  await sendOrEdit(ctx, text, kb, isEdit);
}

// Dəstək Məlumatını Göstər
export async function renderSupport(ctx: Context, isEdit = true) {
  const lang = ctx.from ? getUserLanguage(ctx.from.id) : 'az';
  const t = ctx.from ? getT(ctx.from.id) : getT('0');
  const text = `${EMOJIS.WHATSAPP} <b>${t.supportTitle}</b>\n\n` +
    `${t.supportSubtitle}\n\n` +
    `• ${EMOJIS.TELEGRAM} <b>Telegram:</b> @Winners_Shoop\n\n` +
    `• ${EMOJIS.WHATSAPP} <b>WhatsApp:</b> +994776382616\n\n` +
    `${EMOJIS.WORKING_HOURS} <b>${t.supportWorkingHours}</b>`;

  const kb = getBackToMainKeyboard(lang);
  await sendOrEdit(ctx, text, kb, isEdit);
}

// Ödəmə Menyusunu Göstər
export async function renderPaymentMenu(ctx: Context, isEdit = true) {
  if (!ctx.from) return;
  const lang = getUserLanguage(ctx.from.id);
  const t = getT(ctx.from.id);
  const user = getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);

  const balanceDisplay = formatBalance(user.balance, lang);

  const text = `${EMOJIS.WALLET} <b>${t.paymentTitle}</b>\n\n` +
    `${EMOJIS.PROFILE} <b>${t.profile}:</b> ${ctx.from.first_name || '—'}\n` +
    `${EMOJIS.MONEY} <b>${t.currentBalance}</b> <b>${balanceDisplay}</b>\n\n` +
    `💡 <i>${t.paymentInstantCryptoDesc}</i>\n\n` +
    `• ${EMOJIS.BINANCE} <b>${t.paymentBinanceOption}</b>\n` +
    `• ${EMOJIS.USDT_TRC20} <b>${t.paymentTrc20Option}</b>\n` +
    `• ${EMOJIS.USDT_BEP20} <b>${t.paymentBep20Option}</b>\n\n` +
    `${EMOJIS.TARGET_ID} <i>${t.paymentChooseCryptoMethod}</i>`;

  const kb = getPaymentMenuKeyboard(lang);
  await sendOrEdit(ctx, text, kb, isEdit);
}

// Oyunlar Menyusunu Göstər (Oyunları 6-elementlik səhifələrdə göstərir)
export async function renderGamesMenu(ctx: Context, isEdit = true, page = 0) {
  const lang = ctx.from ? getUserLanguage(ctx.from.id) : 'az';
  const t = ctx.from ? getT(ctx.from.id) : getT('0');

  const cleanTitle = (t.catalogTitle || 'OYUNLAR VƏ XİDMƏTLƏR KATALOQU')
    .replace(/<[^>]*>/g, '')
    .replace(/^[\p{Emoji}\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '')
    .trim();

  const cleanDesc = (t.catalogDesc || 'Bütün sifarişlər rəsmi serverlər vasitəsilə 3 saniyə ərzində hesabınıza yüklənir.')
    .replace(/<[^>]*>/g, '')
    .replace(/^[\p{Emoji}\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '')
    .trim();

  const text = `${EMOJIS.GAMES} <b>${cleanTitle}</b>\n\n` +
    `${EMOJIS.LIGHTNING} <i>${cleanDesc}</i>\n\n` +
    `${EMOJIS.TARGET_ID} <i>${t.selectGameToTopup || 'Yükləmək istədiyiniz oyunu və ya xidməti seçin:'}</i>`;

  const kb = getGamesMenuKeyboard(page, 12, lang);
  await sendOrEdit(ctx, text, kb, isEdit);
}

// PUBG Mobile Alt-Menyunu Göstər (Avto ID vs E-Pin vs Web Purchase)
export async function renderPubgSubMenu(ctx: Context, isEdit = true) {
  const lang = ctx.from ? getUserLanguage(ctx.from.id) : 'az';
  const t = ctx.from ? getT(ctx.from.id) : getT('0');
  const text = `${EMOJIS.PUBG} <b>${t.pubgTitle}</b>\n\n` +
    `${t.pubgChooseType || 'Zəhmət olmasa yükləmə növünü seçin:'}\n\n` +
    `⚡ <b>1. ${t.pubgAutoDesc}</b>\n` +
    `<i>${t.pubgAutoInfo || 'Oyunçu ID-nizi daxil edirsiniz və balans saniyələr içində birbaşa oyun hesabınıza oturur.'}</i>\n\n` +
    `🎟️ <b>2. ${t.pubgEpinDesc}</b>\n` +
    `<i>${t.pubgEpinInfo || 'Rəsmi aktivasiya kodu (PIN/Redeem Code) anında çatınıza təqdim olunur.'}</i>\n\n` +
    `🌐 <b>3. ${t.pubgWebDesc}</b>\n` +
    `<i>${t.pubgWebInfo || 'Rəsmi PlayPin Web Yükləmə kanalı ilə birbaşa Oyunçu ID-nizə yüklənmə.'}</i>\n\n` +
    `👇 <i>${t.selectButtonBelow || 'Aşağıdakı düymələrdən birini seçin:'}</i>`;

  const kb = getPubgMenuKeyboard(lang);
  await sendOrEdit(ctx, text, kb, isEdit);
}

// Telegram Xidmətlər Menyusunu Göstər
export async function renderTelegramServicesMenu(ctx: Context, isEdit = true) {
  const lang = ctx.from ? getUserLanguage(ctx.from.id) : 'az';
  const t = ctx.from ? getT(ctx.from.id) : getT('0');
  const text = `${EMOJIS.TELEGRAM} <b>${t.services}</b>\n\n` +
    `• ${EMOJIS.TELEGRAM_STARS} <b>Telegram Stars</b>\n` +
    `• ${EMOJIS.TELEGRAM_PREMIUM} <b>Telegram Premium</b>\n\n` +
    `👇 <i>Seçim edin / Select:</i>`;

  const kb = getTelegramServicesKeyboard(lang);
  await sendOrEdit(ctx, text, kb, isEdit);
}

// Veb Tətbiq Məlumatını Göstər
export async function renderWebAppInfo(ctx: Context, isEdit = true) {
  const lang = ctx.from ? getUserLanguage(ctx.from.id) : 'az';
  const webUrl = config.server.webAppUrl;
  const text = `${EMOJIS.NAV_WEB} <b>WINNERS SHOP — VEB MAĞAZA & MINI APP</b>\n\n` +
    `Bütün 300+ oyun, rəqəmsal kartlar və geniş xidmət kataloqumuza birbaşa vebsaytdan baxa bilərsiniz:\n\n` +
    `${EMOJIS.USERNAME} <b>Veb Mağaza:</b> <a href="${webUrl}">${webUrl}</a>\n` +
    `${EMOJIS.ADMIN_CROWN} <b>Admin Paneli:</b> <a href="${webUrl}/admin.html">${webUrl}/admin.html</a>\n\n` +
    `<i>(Domeninizə HTTPS sertifikatı bağlandıqda, bu menyu birbaşa Telegram Mini App kimi açılacaqdır).</i>`;

  const kb = getBackToMainKeyboard(lang);
  await sendOrEdit(ctx, text, kb, isEdit);
}

// Rəylər və Reytinq Menyusunu Göstər
export async function renderReviews(ctx: Context, isEdit = true) {
  const lang = ctx.from ? getUserLanguage(ctx.from.id) : 'az';
  const t = ctx.from ? getT(ctx.from.id) : getT('0');
  const stats = getRatingStats();
  const recentReviews = getRecentReviews(6);

  let text = `${EMOJIS.REVIEWS} <b>${t.ratingTitle}</b>\n\n` +
    `${EMOJIS.STATS} <b>${t.reviewsOverallRating}</b> <b>${EMOJIS.REVIEWS} ${stats.average.toFixed(1)} / 5.0</b> <i>(${stats.count} ${t.reviewsCountLabel})</i>\n\n` +
    `${EMOJIS.WHATSAPP} <b>${t.reviewsRecentReviews}</b>\n\n`;

  if (recentReviews.length === 0) {
    text += `<i>${t.reviewsNoReviewsYet}</i>\n\n`;
  } else {
    for (const r of recentReviews) {
      const stars = '⭐'.repeat(Math.max(1, Math.min(5, r.rating)));
      const name = r.first_name || r.username || 'Müştəri';
      const prod = r.product_name ? ` <i>(${r.product_name})</i>` : '';
      const comment = r.comment ? `\n   💬 <i>"${r.comment}"</i>` : '';
      text += `• ${stars} <b>${name}</b>${prod}${comment}\n\n`;
    }
  }

  text += `✨ <i>${t.reviewsAutoPromptNote}</i>`;

  const kb = new InlineKeyboard();
  (kb as any).inline_keyboard = [
    [
      makeBtn(t.reviewsBtnOrderNow, 'menu_games', getCustomEmojiId('GAMES_CATALOG'), 'primary', '🎮'),
      makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')
    ]
  ];

  await sendOrEdit(ctx, text, kb, isEdit);
}

// Dil Seçimi Menyusunu Göstər
export async function renderLanguageSelect(ctx: Context, isEdit = true) {
  const text = `${EMOJIS.LANGUAGE} <b>DİL SEÇİMİ / ВЫБОР ЯЗЫКА / SELECT LANGUAGE</b>\n\n` +
    `Zəhmət olmasa istifadə etmək istədiyiniz dili seçin:\n` +
    `Пожалуйста, выберите язык обслуживания:\n` +
    `Please select your preferred language:\n` +
    `Lütfen tercih ettiğiniz dili seçiniz:`;

  const kb = getLanguageKeyboard(true);
  await sendOrEdit(ctx, text, kb, isEdit);
}

// Dəvət və Tərəfdaşlıq Menyusunu Göstər
export async function renderReferralMenu(ctx: Context, isEdit = true) {
  if (!ctx.from) return;
  const lang = getUserLanguage(ctx.from.id);
  const t = getT(ctx.from.id);
  const stats = getReferralStats(ctx.from.id);
  const botUser = settingsService.getBotUsername() || config.botUsername || 'WS_StoreBot';
  const refLink = `https://t.me/${botUser}?start=ref_${ctx.from.id}`;
  const shareText = encodeURIComponent(`🔥 PUBG Mobile UC & Game Top-Up — Winners Shop:\n${refLink}`);
  const shareUrl = `https://t.me/share/url?url=${refLink}&text=${shareText}`;

  const commissionDisplay = formatBalance(stats.totalCommission, lang);

  const text = `${EMOJIS.REFERRAL} <b>${t.referralTitle}</b>\n\n` +
    `${EMOJIS.USERNAME} <b>${t.referralLinkText}</b>\n` +
    `<code>${refLink}</code>\n\n` +
    `${EMOJIS.STATS} <b>${t.referralYourStats}</b>\n` +
    `• ${EMOJIS.REFERRAL} <b>${t.referralInvitedFriends}</b> <b>${stats.count}</b>\n` +
    `• ${EMOJIS.MONEY} <b>${t.referralEarnedCommission}</b> <b>${commissionDisplay}</b>\n\n` +
    `${EMOJIS.LIGHTNING} <i>${t.referralCommissionExpl}</i>`;

  const kb = new InlineKeyboard()
    .url(t.referralBtnShare, shareUrl).row();
  (kb as any).inline_keyboard.push([
    makeBtn(t.refresh, 'menu_referral', getCustomEmojiId('NAV_RELOAD'), undefined, '🔄'),
    makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')
  ]);

  await sendOrEdit(ctx, text, kb, isEdit);
}

// Tez-tez Soruşulan Suallar və Kömək Menyusunu Göstər
export async function renderFaqMenu(ctx: Context, isEdit = true) {
  const lang = ctx.from ? getUserLanguage(ctx.from.id) : 'az';
  const t = ctx.from ? getT(ctx.from.id) : getT('0');
  const text = `${EMOJIS.FAQ} <b>${t.faqTitle}</b>\n\n` +
    `${EMOJIS.LIGHTNING} <b>${t.faqQ1}</b>\n` +
    `└ <i>${t.faqA1}</i>\n\n` +
    `${EMOJIS.WALLET} <b>${t.faqQ2}</b>\n` +
    `└ <i>${t.faqA2}</i>\n\n` +
    `${EMOJIS.SHIELD} <b>${t.faqQ3}</b>\n` +
    `└ <i>${t.faqA3}</i>\n\n` +
    `${EMOJIS.WHATSAPP} <b>${t.faqExtraQuestions}</b>`;

  const kb = new InlineKeyboard();
  (kb as any).inline_keyboard = [
    [
      makeBtn(t.gamesMenu, 'menu_games', getCustomEmojiId('GAMES_CATALOG'), 'primary', '🎮'),
      makeBtn(t.faqBtnContactSupport, 'menu_support', getCustomEmojiId('WHATSAPP_SUPPORT'), undefined, '💬')
    ],
    [makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')]
  ];

  await sendOrEdit(ctx, text, kb, isEdit);
}

// Oyun Axtarışı Bildirişini Göstər
export async function renderGameSearchPrompt(ctx: Context, isEdit = true) {
  if (!ctx.from) return;
  const lang = getUserLanguage(ctx.from.id);
  const t = getT(ctx.from.id);
  setUserState(ctx.from.id, { step: 'awaiting_game_search' });

  const searchTitle = lang === 'en' ? 'GAME & SERVICE SEARCH' :
                      lang === 'ru' ? 'ПОИСК ИГР И УСЛУГ' :
                      lang === 'tr' ? 'OYUN VE HİZMET ARAMA' :
                      'OYUN VƏ YA XİDMƏT AXTARIŞI';

  const searchPrompt = lang === 'en' ? 'Type the name of the game, voucher, or digital service you are looking for:\n\n<i>(For example: <b>Free Fire, Valorant, Steam, Roblox, Genshin, Brawl Stars, Apex, Netflix, Spotify</b> etc.)</i>' :
                       lang === 'ru' ? 'Введите название игры, ваучера или услуги, которую вы ищете:\n\n<i>(Например: <b>Free Fire, Valorant, Steam, Roblox, Genshin, Brawl Stars, Apex, Netflix, Spotify</b> и т.д.)</i>' :
                       lang === 'tr' ? 'Aramak istediğiniz oyun, kupon veya dijital hizmetin adını yazın:\n\n<i>(Örneğin: <b>Free Fire, Valorant, Steam, Roblox, Genshin, Brawl Stars, Apex, Netflix, Spotify</b> vb.)</i>' :
                       'Axtarmaq istədiyiniz oyunun, vauçerin və ya rəqəmsal xidmətin adını yazın:\n\n<i>(Məsələn: <b>Free Fire, Valorant, Steam, Roblox, Genshin, Brawl Stars, Apex, Netflix, Spotify</b> və s.)</i>';

  const text = `${EMOJIS.SEARCH} <b>${searchTitle}</b>\n\n${searchPrompt}`;

  const kb = new InlineKeyboard();
  (kb as any).inline_keyboard = [
    [makeBtn(t.cancel, 'menu_games', getCustomEmojiId('STATUS_ERROR'), 'danger', '❌')]
  ];

  await sendOrEdit(ctx, text, kb, isEdit);
}

// Bütün Kateqoriyalarda Oyun Axtarışı Apar (FazerCards, PlayPin və Xüsusi)
export async function handleGameSearchResult(ctx: Context, query: string) {
  if (!ctx.from) return;
  const lang = getUserLanguage(ctx.from.id);
  const t = getT(ctx.from.id);
  const cleanQ = query.toLowerCase().trim();

  const { fazerCardsService } = await import('../services/fazercards.service.js');
  const allApiCats = await fazerCardsService.fetchAllCategories();
  const dbCats = getAllActiveApiCategories();

  const matched: Array<{ id: string; name: string; type: string; icon: string }> = [];
  const seenIds = new Set<string>();

  // Köməkçi uyğunlaşdırıcı
  const isMatch = (name: string, id: string) => {
    const n = (name || '').toLowerCase();
    const i = (id || '').toLowerCase();
    return n.includes(cleanQ) || i.includes(cleanQ) || cleanQ.includes(n);
  };

  // 1. Əvvəlcə DB Aktiv Kateqoriyalarında axtar (Prioritet)
  for (const c of dbCats) {
    if (isMatch(c.name, c.category_id) && !seenIds.has(c.category_id)) {
      matched.push({ id: c.category_id, name: c.name, type: c.type, icon: c.icon || '🎮' });
      seenIds.add(c.category_id);
    }
  }

  // 2. Bütün FazerCards topup-larda axtar
  for (const c of allApiCats.topups) {
    if (isMatch(c.name, c.category_id) && !seenIds.has(c.category_id)) {
      matched.push({ id: c.category_id, name: c.name, type: 'topup', icon: '🎮' });
      seenIds.add(c.category_id);
    }
  }

  // 3. Bütün FazerCards hədiyyə kartlarında axtar
  for (const c of allApiCats.giftcards) {
    if (isMatch(c.name, c.category_id) && !seenIds.has(c.category_id)) {
      matched.push({ id: c.category_id, name: c.name, type: 'giftcard', icon: '🎟️' });
      seenIds.add(c.category_id);
    }
  }

  clearUserState(ctx.from.id);

  const searchAgainBtnLabel = lang === 'en' ? '🔍 Search Again' :
                              lang === 'ru' ? '🔍 Искать снова' :
                              lang === 'tr' ? '🔍 Yeniden Ara' :
                              '🔍 Yenidən Axtar';

  if (matched.length === 0) {
    const noResultsTitle = lang === 'en' ? `No games found for "${escapeTgHtml(query)}"!` :
                           lang === 'ru' ? `По запросу "${escapeTgHtml(query)}" ничего не найдено!` :
                           lang === 'tr' ? `"${escapeTgHtml(query)}" için hiçbir oyun bulunamadı!` :
                           `"${escapeTgHtml(query)}" üzrə heç bir oyun tapılmadı!`;
    const noResultsHint = lang === 'en' ? 'Please try another keyword or browse the catalog.' :
                          lang === 'ru' ? 'Пожалуйста, введите другое ключевое слово или перейдите в каталог.' :
                          lang === 'tr' ? 'Lütfen başka bir anahtar kelime deneyin veya kataloğa göz atın.' :
                          'Zəhmət olmasa başqa açar söz daxil edin və ya kataloqa keçid edin.';

    const kb = new InlineKeyboard();
    (kb as any).inline_keyboard = [
      [makeBtn(searchAgainBtnLabel, 'game_search', getCustomEmojiId('NAV_SEARCH'), 'primary', '🔍')],
      [makeBtn(t.gamesMenu, 'menu_games', getCustomEmojiId('GAMES_CATALOG'), undefined, '🎮')],
      [makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')]
    ];

    return ctx.reply(
      `${EMOJIS.WARNING} <b>${noResultsTitle}</b>\n\n` +
      `<i>${noResultsHint}</i>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  // Ən yaxşı uyğun nəticələri göstər (maks 10)
  const topMatches = matched.slice(0, 10);
  const kb = new InlineKeyboard();
  const rows: any[][] = [];

  for (const m of topMatches) {
    const emojiId = getCategoryCustomEmojiId(m.id);
    const callback = m.id.includes('pubg') ? 'menu_pubg_sub' : `cat:${m.id}`;
    rows.push([makeBtn(m.name, callback, emojiId, 'primary', m.icon)]);
  }

  const searchOtherBtnLabel = lang === 'en' ? '🔍 Search Other Game' :
                              lang === 'ru' ? '🔍 Найти другую игру' :
                              lang === 'tr' ? '🔍 Başka Oyun Ara' :
                              '🔍 Başqa Oyun Axtar';

  rows.push([
    makeBtn(searchOtherBtnLabel, 'game_search', getCustomEmojiId('NAV_SEARCH'), undefined, '🔍'),
    makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')
  ]);

  (kb as any).inline_keyboard = rows;

  const resultsTitle = lang === 'en' ? `SEARCH RESULTS: "${escapeTgHtml(query)}"` :
                       lang === 'ru' ? `РЕЗУЛЬТАТЫ ПОИСКА: "${escapeTgHtml(query)}"` :
                       lang === 'tr' ? `ARAMA SONUÇLARI: "${escapeTgHtml(query)}"` :
                       `AXTARIŞ NƏTİCƏLƏRİ: "${escapeTgHtml(query)}"`;

  const resultsFoundLabel = lang === 'en' ? `Found results (<b>${matched.length}</b>):` :
                            lang === 'ru' ? `Найдено результатов (<b>${matched.length}</b>):` :
                            lang === 'tr' ? `Bulunan sonuçlar (<b>${matched.length}</b> adet):` :
                            `Tapılan nəticələr (<b>${matched.length}</b> ədəd):`;

  const resultsHint = lang === 'en' ? 'Tap on any game below to view packages and prices:' :
                      lang === 'ru' ? 'Нажмите на любую игру ниже, чтобы увидеть пакеты и цены:' :
                      lang === 'tr' ? 'Paketleri ve fiyatları görmek için aşağıdaki oyunlardan birine tıklayın:' :
                      'Aşağıdakı düymələrdən istədiyiniz oyuna toxunaraq paketləri görə bilərsiniz:';

  await ctx.reply(
    `${EMOJIS.SEARCH} <b>${resultsTitle}</b>\n\n` +
    `${resultsFoundLabel}\n` +
    `<i>${resultsHint}</i>`,
    { parse_mode: 'HTML', reply_markup: kb }
  );
}

export async function renderInfoCommand(ctx: Context, isCallback = false) {
  const text =
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

  const keyboard = {
    inline_keyboard: [
      [makeUrlBtn('WhatsApp: +994 77 211 70 11', 'https://wa.me/994772117011', getCustomEmojiId('WHATSAPP_SUPPORT') || '5271536803482981220', '💬')],
      [makeUrlBtn('Telegram: @HusnuTech', 'https://t.me/HusnuTech', getCustomEmojiId('LIGHTNING_FAST') || '5785334962190293693', '⚡')],
      [makeBtn('Əsas Menyu / Back to Store', 'menu_main', getCustomEmojiId('MAIN_MENU_HEADER') || '5217822164362739968', undefined, '🏠')],
    ]
  };

  if (isCallback && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      return;
    } catch (e) {}
  }

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
}
