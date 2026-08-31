import { InlineKeyboard } from 'grammy';
import { settingsService } from '../services/settings.service.js';
import { FazerOffer } from '../services/fazercards.service.js';
import { translations, SupportedLanguage } from '../i18n/index.js';
import { getAllActiveApiCategories, getActiveApiCategoriesByType, getCustomOfferPrice, getApiCategory } from '../database/db.js';
import { getCategoryCustomEmojiId, getCustomEmojiId, getOfferCustomEmojiId } from './emojis.js';

// Opsional Premium Xüsusi Emoji dəstəyi ilə Telegram Inline Düymə qurmaq üçün köməkçi
// - Masaüstü: icon_custom_emoji_id animasiyalı premium emoji göstərir
// - Mobil (iOS/Android/Nicegram): mətndə standart unicode emojiyə keçir
export function makeBtn(
  text: string,
  callbackData: string,
  customEmojiId?: string | null,
  style?: 'primary' | 'success' | 'danger',
  fallbackIcon?: string
) {
  // Bütün HTML teqlərini təmizlə (Telegram düymə mətni HTML dəstəkləmir!)
  let cleanText = text.replace(/<[^>]*>/g, '').trim();

  const rawNoHtml = text.replace(/<[^>]*>/g, '').trim();
  const icon = fallbackIcon || rawNoHtml.match(/^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{E000}-\u{F8FF}\uFE0F\u200D]|\p{Extended_Pictographic})+/gu)?.[0] || '';

  // Mətnin əvvəlindəki unicode emojiləri təmizlə
  cleanText = cleanText.replace(/^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{E000}-\u{F8FF}\uFE0F\u200D]|\p{Extended_Pictographic})+\s*/gu, '').trim() || cleanText;

  const btn: any = { callback_data: callbackData };

  const isValidNumericEmojiId = Boolean(customEmojiId && /^\d{10,24}$/.test(customEmojiId.trim()));

  if (isValidNumericEmojiId) {
    // Xüsusi premium animasiyalı emoji aktivdir: mətndə ikinci emoji göstərilmir
    btn.icon_custom_emoji_id = customEmojiId!.trim();
    btn.text = cleanText;
  } else {
    // Xüsusi emoji yoxdur: birbaşa mətndə standart unicode emoji göstərilir
    btn.text = icon ? `${icon} ${cleanText}` : cleanText;
  }

  if (style) {
    btn.style = style;
  }
  return btn;
}

export function makeUrlBtn(
  text: string,
  url: string,
  customEmojiId?: string | null,
  fallbackIcon?: string
) {
  let cleanText = text.replace(/<[^>]*>/g, '').trim();
  const rawNoHtml = text.replace(/<[^>]*>/g, '').trim();
  const icon = fallbackIcon || rawNoHtml.match(/^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{E000}-\u{F8FF}\uFE0F\u200D]|\p{Extended_Pictographic})+/gu)?.[0] || '';
  cleanText = cleanText.replace(/^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{E000}-\u{F8FF}\uFE0F\u200D]|\p{Extended_Pictographic})+\s*/gu, '').trim() || cleanText;

  const btn: any = { url };
  const isValidNumericEmojiId = Boolean(customEmojiId && /^\d{10,24}$/.test(customEmojiId.trim()));

  if (isValidNumericEmojiId) {
    btn.icon_custom_emoji_id = customEmojiId!.trim();
    btn.text = cleanText;
  } else {
    btn.text = icon ? `${icon} ${cleanText}` : cleanText;
  }

  return btn;
}

// 100% Inline Əsas Menyu — Çoxdilli Dəstək və Telegram 9.4+ Xüsusi Emojilər / Stillər
export function getMainInlineMenu(isAdmin = false, lang: SupportedLanguage = 'az') {
  const t = translations[lang] || translations.az;
  const kb = new InlineKeyboard();

  const gamesId = getCustomEmojiId('GAMES_CATALOG');
  const balanceId = getCustomEmojiId('BALANCE_WALLET');
  const profileId = getCustomEmojiId('PROFILE_USER');
  const ordersId = getCustomEmojiId('ORDER_HISTORY');
  const supportId = getCustomEmojiId('WHATSAPP_SUPPORT');
  const faqId = getCustomEmojiId('FAQ_HELP');
  const reviewsId = getCustomEmojiId('REVIEWS_RATING');
  const langId = getCustomEmojiId('LANGUAGE_SELECT');

  const row1 = [
    makeBtn(t.gamesMenu, 'menu_games', gamesId, 'primary', '🎮'),
    makeBtn(t.balance, 'menu_payment', balanceId, 'success', '💳')
  ];
  const row2 = [
    makeBtn(t.profile, 'menu_profile', profileId, 'primary', '👤'),
    makeBtn(t.orders, 'menu_orders', ordersId, 'success', '📜')
  ];
  const row3 = [
    makeBtn(t.reviews, 'menu_reviews', reviewsId, 'primary', '⭐'),
    makeBtn(t.faq, 'menu_faq', faqId, 'success', '❓')
  ];
  const row4 = [
    makeBtn(t.language, 'menu_lang_select', langId, 'primary', '🌐'),
    makeBtn(t.support, 'menu_support', supportId, 'success', '💬')
  ];
  const row5 = [
    makeBtn(t.b2bApiBtn, 'menu_api_docs', getCustomEmojiId('API_DOCS') || getCustomEmojiId('LIGHTNING') || null, undefined, '🔌')
  ];

  const rows = [row1, row2, row3, row4, row5];
  if (isAdmin) {
    rows.push([makeBtn('Admin Panel', 'menu_admin', null, 'danger', '👑')]);
  }
  (kb as any).inline_keyboard = rows;
  return kb;
}

// Dil Seçimi Klaviaturası
export function getLanguageKeyboard(showHome = false) {
  const kb = new InlineKeyboard()
    .text('🇦🇿 Azərbaycan', 'set_lang_az')
    .text('🇷🇺 Русский', 'set_lang_ru').row()
    .text('🇬🇧 English', 'set_lang_en')
    .text('🇹🇷 Türkçe', 'set_lang_tr');

  if (showHome) {
    kb.row().text('🏠 Əsas Menyu / Main Menu', 'menu_main');
  }

  return kb;
}

// Oyun Seçimi Menyusu - Oyunları 12 elementlik səhifələrdə göstərir (6 sətir x 2 sütun = 6 sol, 6 sağ)
export function getGamesMenuKeyboard(page = 0, limit = 12, lang: SupportedLanguage = 'az') {
  const t = translations[lang] || translations.az;
  const kb = new InlineKeyboard();
  const rows: any[][] = [];

  try {
    const apiCats = getAllActiveApiCategories();
    const mainCats: Array<{ id: string; icon: string; name: string; callback: string }> = [];

    // PUBG Mobile əsas kateqoriya düyməsi (Avto vs E-Pin seçicisini açır)
    mainCats.push({ id: 'pubg_mobile', icon: '🔫', name: 'PUBG Mobile', callback: 'menu_pubg_sub' });

    for (const c of apiCats) {
      if (c.category_id.includes('pubg')) continue; // PUBG handled via dedicated sub-menu
      mainCats.push({
        id: c.category_id,
        icon: c.icon || '🎮',
        name: c.name,
        callback: `cat:${c.category_id}`
      });
    }

    const start = page * limit;
    const pageCats = mainCats.slice(start, start + limit);

    for (let i = 0; i < pageCats.length; i += 2) {
      const c1 = pageCats[i];
      const c2 = pageCats[i + 1];
      const row: any[] = [];

      const id1 = getCategoryCustomEmojiId(c1.id);
      row.push(makeBtn(c1.name, c1.callback, id1, undefined, c1.icon));

      if (c2) {
        const id2 = getCategoryCustomEmojiId(c2.id);
        row.push(makeBtn(c2.name, c2.callback, id2, undefined, c2.icon));
      }
      rows.push(row);
    }

    // Axtarış sətri
    const searchBtnLabel = lang === 'az' ? '🔍 Oyun və ya Xidmət Axtar' : (lang === 'ru' ? '🔍 Поиск игр и услуг' : (lang === 'tr' ? '🔍 Oyun veya Hizmet Ara' : '🔍 Search Games & Services'));
    rows.push([
      makeBtn(searchBtnLabel, 'game_search', getCustomEmojiId('NAV_SEARCH'), 'primary', '🔍')
    ]);

    // Səhifələmə sətri (Əvvəlki / Növbəti)
    const navRow: any[] = [];
    if (page > 0) {
      navRow.push(makeBtn(t.back, `games_page:${page - 1}`, getCustomEmojiId('NAV_PREV') || getCustomEmojiId('NAV_BACK'), undefined, '⬅️'));
    }
    if (start + limit < mainCats.length) {
      navRow.push(makeBtn(t.more || 'More', `games_page:${page + 1}`, getCustomEmojiId('NAV_MORE'), undefined, '➡️'));
    }
    if (navRow.length > 0) {
      rows.push(navRow);
    }
  } catch (e) {
    const pubgId = getCategoryCustomEmojiId('pubg_mobile');
    rows.push([makeBtn('PUBG Mobile', 'menu_pubg_sub', pubgId, undefined, '🔫')]);
  }

  rows.push([makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')]);
  (kb as any).inline_keyboard = rows;
  return kb;
}

// PUBG Mobile Alt-Menyu (Avto ID Top-Up vs E-Pin Vauçer vs Web Purchase)
export function getPubgMenuKeyboard(lang: SupportedLanguage = 'az') {
  const t = translations[lang] || translations.az;
  const kb = new InlineKeyboard();

  const autoId = getCategoryCustomEmojiId('pubg_mobile_auto');
  const epinId = getCategoryCustomEmojiId('pubg_mobile_epin') || getCategoryCustomEmojiId('pubg_mobile');
  const webId = getCategoryCustomEmojiId('pubg_mobile_web') || getCategoryCustomEmojiId('pubg_mobile');
  const cardId = getCategoryCustomEmojiId('pubg_mobile_card') || getCategoryCustomEmojiId('pubg_mobile');

  (kb as any).inline_keyboard = [
    [makeBtn(t.pubgAutoDesc, 'cat:pubg_mobile_auto', autoId, 'primary', '⚡')],
    [makeBtn(t.pubgEpinDesc, 'cat:pubg_mobile_epin', epinId, 'success', '🎟️')],
    [makeBtn(t.pubgWebDesc, 'cat:pubg_mobile_web', webId, 'primary', '🌐')],
    [makeBtn(t.pubgCardDesc, 'cat:pubg_mobile_card', cardId, 'success', '💳')],
    [
      makeBtn(t.back, 'menu_games', getCustomEmojiId('NAV_BACK'), undefined, '🔙'),
      makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')
    ]
  ];
  return kb;
}

// Telegram Xidmətlər Menyusu
export function getTelegramServicesKeyboard(lang: SupportedLanguage = 'az') {
  const t = translations[lang] || translations.az;
  const starsId = getCustomEmojiId('TELEGRAM_STARS');
  const premId = getCustomEmojiId('TELEGRAM_PREMIUM');
  const kb = new InlineKeyboard();
  (kb as any).inline_keyboard = [
    [makeBtn('Telegram Stars', 'cat:telegram-stars', starsId, 'primary', '⭐️')],
    [makeBtn('Telegram Premium', 'cat:telegram-premium-gift', premId, 'primary', '💎')],
    [
      makeBtn(t.back, 'menu_games', getCustomEmojiId('NAV_BACK'), undefined, '🔙'),
      makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')
    ]
  ];
  return kb;
}

// Dilə əsasən qiymət sətirini formatla (AZN 'az' üçün, USD 'en', 'ru', 'tr' üçün)
export function formatPrice(priceAzn: number, usdPrice: number = 0, lang: SupportedLanguage = 'az'): string {
  if (lang === 'az') {
    return `${priceAzn.toFixed(2)} ₼`;
  }
  const rate = settingsService.getUsdAznRate() || 1.70;
  const usdVal = usdPrice > 0 ? usdPrice : (priceAzn > 0 ? (priceAzn / rate) : 0);
  return `$${usdVal.toFixed(2)}`;
}

// Dilə əsasən balans sətirini formatla (AZN 'az' üçün, USD 'en', 'ru', 'tr' üçün)
export function formatBalance(balanceAzn: number, lang: SupportedLanguage = 'az'): string {
  if (lang === 'az') {
    return `${balanceAzn.toFixed(2)} ₼`;
  }
  const rate = settingsService.getUsdAznRate() || 1.70;
  const usdVal = balanceAzn / rate;
  return `$${usdVal.toFixed(2)}`;
}

// Oyun və Səviyyəyə əsasən Ağıllı Təklif Emoji Seçicisi
export function getOfferIcon(categoryId: string, offerName: string, offerId: string = ''): string {
  const name = (offerName + ' ' + offerId).toLowerCase();

  // Brawl Stars Daşları (Gems)
  if (categoryId.includes('brawl')) {
    if (/pass/i.test(name)) return '👑';
    if (/2000|950|360/i.test(name)) return '🥇';
    if (/170|80/i.test(name)) return '🥈';
    return '⭐';
  }

  // Telegram Ulduzlar və Premium
  if ((categoryId.includes('stars') || name.includes('star')) && !categoryId.includes('brawl')) return '⭐️';
  if (categoryId.includes('premium') || name.includes('premium')) return '💎';

  // PUBG Mobile və Ümumi UC
  if (categoryId.includes('pubg') || name.includes('uc')) {
    if (/8100|8400/i.test(name)) return '👑';
    if (/3850|4000/i.test(name)) return '💎';
    if (/1800|1900/i.test(name)) return '🥇';
    if (/660|720/i.test(name)) return '🥈';
    if (/325|355/i.test(name)) return '🥉';
    if (/60/i.test(name)) return '🥉';
    if (/pass|prime|elite/i.test(name)) return '👑';
    if (/material|firearm|pack/i.test(name)) return '📦';
    if (/first/i.test(name)) return '🎁';
    return '🔫';
  }

  // Valorant Xalları (VP)
  if (categoryId.includes('valorant') || name.includes('vp')) {
    if (/9600|4700|5000/i.test(name)) return '👑';
    if (/2475|2050|1200/i.test(name)) return '🥇';
    if (/485|500/i.test(name)) return '🥈';
    return '🎯';
  }

  // Roblox Robux
  if (categoryId.includes('roblox') || name.includes('robux')) {
    if (/10000|4500/i.test(name)) return '👑';
    if (/1700|800/i.test(name)) return '🥇';
    if (/400/i.test(name)) return '🥈';
    return '🧱';
  }

  // Free Fire Almazları (Diamonds)
  if (categoryId.includes('free_fire') || categoryId.includes('freefire')) {
    if (/2180|1060/i.test(name)) return '👑';
    if (/520|310/i.test(name)) return '🥇';
    if (/100|50/i.test(name)) return '🔥';
    return '🔥';
  }

  // Mobile Legends
  if (categoryId.includes('mobile_legends') || categoryId.includes('mlbb')) {
    if (/pass|weekly|twilight/i.test(name)) return '👑';
    if (/2195|1412|706/i.test(name)) return '🥇';
    if (/343|257/i.test(name)) return '🥈';
    return '⚔️';
  }

  // Brawl Stars Daşları (Gems)
  if (categoryId.includes('brawl_stars')) {
    if (/pass/i.test(name)) return '👑';
    if (/2000|950|360/i.test(name)) return '🥇';
    if (/170|80/i.test(name)) return '🥈';
    return '⭐';
  }

  // Steam Pulqabı (Wallet)
  if (categoryId.includes('steam')) {
    if (/100|50/i.test(name)) return '👑';
    if (/25|20/i.test(name)) return '🥇';
    if (/10/i.test(name)) return '🥈';
    return '🎮';
  }

  // Ümumi Standartlar
  if (/pass|prime|vip|plus/i.test(name)) return '👑';
  if (/gift|card|voucher|epin|code/i.test(name)) return '🎟️';
  return '🔹';
}

// Hesablanmış / Xüsusi Qiymətlər və Emojilərlə Təkliflər Şəbəkəsi
export function getOffersKeyboard(categoryId: string, offers: FazerOffer[], page = 0, limit = 8, lang: SupportedLanguage = 'az') {
  const t = translations[lang] || translations.az;
  const kb = new InlineKeyboard();
  const rows: any[][] = [];
  const start = page * limit;
  const pageOffers = offers.slice(start, start + limit);

  const isEpin = categoryId === 'pubg_mobile_epin' || categoryId === 'pubg_mobile';
  const isWebPurchase = categoryId === 'pubg_mobile_web';

  for (const off of pageOffers) {
    const custom = getCustomOfferPrice(categoryId, off.offer_id);
    if (custom && custom.is_disabled) continue;

    const rate = settingsService.getUsdAznRate() || 1.70;
    const aznPrice = custom && typeof custom.custom_price_azn === 'number' && custom.custom_price_azn > 0
      ? custom.custom_price_azn
      : settingsService.calculateAznPrice(off.price_usd);

    const usdPrice = custom && typeof custom.custom_price_usd === 'number' && custom.custom_price_usd > 0
      ? custom.custom_price_usd
      : Number((aznPrice / rate).toFixed(2));

    const priceDisplay = formatPrice(aznPrice, usdPrice, lang);
    const icon = getOfferIcon(categoryId, off.name, off.offer_id);
    const customEmojiId = getOfferCustomEmojiId(categoryId, off.name, off.offer_id);
    const stock = typeof off.stock === 'number' ? off.stock : (parseInt(String(off.stock ?? ''), 10) || 0);
    const isOutOfStock = (off as any).in_stock === false || (off as any).status === 'inactive' || (isEpin && stock <= 0);

    // Stok bitibsə: Qırmızı Emoji ilə deaktiv 'Stokda Yoxdur' düyməsi göstər
    if (isOutOfStock) {
      const outEmojiId = getCustomEmojiId('EPIN_STOCK_OUT') || '5399849634350768407';
      const outText = t.outOfStock || '[Stokda Yoxdur]';
      rows.push([makeBtn(`${off.name} — ${priceDisplay} ${outText}`, 'noop_out_of_stock', outEmojiId, undefined, '🔴')]);
      continue;
    }

    // Web Purchase / E-Pin fərdiləşdirməsi:
    let labelSuffix = '';
    let itemEmojiId = customEmojiId;
    let fallbackIcon = icon;

    if (isEpin) {
      itemEmojiId = getCustomEmojiId('EPIN_STOCK_IN') || '5852871561983299073';
      fallbackIcon = '🟢';
    }

    if (isWebPurchase) {
      labelSuffix = ' ⚡';
    } else if (isEpin && stock > 0 && stock <= 10) {
      // E-Pin üçün az stok xəbərdarlığı
      const lastStockTpl = t.lastStock || '[Son {stock}]';
      labelSuffix = ` ${lastStockTpl.replace('{stock}', stock.toString())}`;
    }

    rows.push([makeBtn(`${off.name} — ${priceDisplay}${labelSuffix}`, `off:${categoryId}:${off.offer_id}`, itemEmojiId, undefined, fallbackIcon)]);
  }

  const navRow: any[] = [];
  if (page > 0) {
    navRow.push(makeBtn(t.back, `page:${categoryId}:${page - 1}`, getCustomEmojiId('NAV_PREV') || getCustomEmojiId('NAV_BACK'), undefined, '⬅️'));
  }
  if (start + limit < offers.length) {
    navRow.push(makeBtn(t.more || 'More', `page:${categoryId}:${page + 1}`, getCustomEmojiId('NAV_MORE'), undefined, '➡️'));
  }
  if (navRow.length > 0) {
    rows.push(navRow);
  }

  const backCallback = categoryId.includes('pubg') ? 'menu_pubg_sub' : 'menu_games';
  rows.push([
    makeBtn(t.back, backCallback, getCustomEmojiId('NAV_BACK'), undefined, '🔙'),
    makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')
  ]);

  (kb as any).inline_keyboard = rows;
  return kb;
}


// Ödəmə Üsulları Menyusu (Binance Pay, USDT TRC20, USDT BEP20)
export function getPaymentMenuKeyboard(lang: SupportedLanguage = 'az') {
  const t = translations[lang] || translations.az;
  const kb = new InlineKeyboard();

  const binanceId = getCustomEmojiId('BINANCE_PAY') || getCustomEmojiId('MONEY_BAG');
  const trc20Id = getCustomEmojiId('USDT_TRC20') || getCustomEmojiId('MONEY_BAG');
  const bep20Id = getCustomEmojiId('USDT_BEP20') || getCustomEmojiId('MONEY_BAG');

  (kb as any).inline_keyboard = [
    [makeBtn(t.binanceTitle || 'Binance Pay (0% Fee)', 'pay_binance', binanceId, 'primary', '🟡')],
    [makeBtn(t.paymentTrc20Option || 'USDT (TRC20 Network)', 'pay_usdt_trc20', trc20Id, 'success', '🟢')],
    [makeBtn(t.paymentBep20Option || 'USDT (BEP20 Network)', 'pay_usdt_bep20', bep20Id, 'primary', '🟡')],
    [makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')]
  ];
  return kb;
}

// Əsas Menyuya Sadə Qayıdış Klaviaturası
export function getBackToMainKeyboard(lang: SupportedLanguage = 'az') {
  const t = translations[lang] || translations.az;
  const kb = new InlineKeyboard();
  (kb as any).inline_keyboard = [
    [makeBtn(t.home, 'menu_main', getCustomEmojiId('NAV_HOME'), undefined, '🏠')]
  ];
  return kb;
}

// Sifarişi Təsdiq Et Klaviaturası
export function getOrderConfirmKeyboard(orderKey: string, lang: SupportedLanguage = 'az') {
  const t = translations[lang] || translations.az;
  const kb = new InlineKeyboard();
  (kb as any).inline_keyboard = [
    [makeBtn(t.confirm, `conf_yes_${orderKey}`, getCustomEmojiId('STATUS_SUCCESS'), 'success', '✅')],
    [makeBtn(t.cancel, 'menu_main', getCustomEmojiId('STATUS_ERROR'), 'danger', '❌')]
  ];
  return kb;
}
