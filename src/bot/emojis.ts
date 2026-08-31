import fs from 'fs';
import path from 'path';

interface EmojiConfigItem {
  name: string;
  default: string;
  custom_emoji_id: string;
}

const configPath = path.resolve(process.cwd(), 'custom-emojis.json');

/**
  * custom-emojis.json-dan ən son xüsusi emoji ID-ni oxuyur.
  * custom_emoji_id doldurulubsa, onu <tg-emoji emoji-id="..."> içinə qoyur.
  * Boşdursa, standart təmiz emojini qaytarır.
 */
export function getEmoji(key: string, fallbackDefault = '🔹'): string {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const data: Record<string, EmojiConfigItem> = JSON.parse(raw);
      const item = data[key];
      if (item) {
        if (item.custom_emoji_id && item.custom_emoji_id.trim().length > 0) {
          return `<tg-emoji emoji-id="${item.custom_emoji_id.trim()}">${item.default || fallbackDefault}</tg-emoji>`;
        }
        return item.default || fallbackDefault;
      }
    }
  } catch (e) {
    // Oxuma xətasında ehtiyat dəyəri qaytar
  }
  return fallbackDefault;
}

export const EMOJIS = {
  // Əsas İdarəetmə Paneli & User
  get MAIN_MENU() { return getEmoji('MAIN_MENU_HEADER', '🏛'); },
  get PROFILE() { return getEmoji('PROFILE_USER', '👤'); },
  get TG_ID() { return getEmoji('TELEGRAM_ID', '🆔'); },
  get USERNAME() { return getEmoji('USERNAME_LINK', '🔗'); },
  get WALLET() { return getEmoji('BALANCE_WALLET', '💳'); },
  get MONEY() { return getEmoji('MONEY_BAG', '💰'); },
  get ORDERS() { return getEmoji('ORDER_HISTORY', '📜'); },
  get CART() { return getEmoji('ORDERS_CART', '🛒'); },
  get PACKAGE() { return getEmoji('PACKAGE_BOX', '📦'); },
  get CONFIRM() { return getEmoji('ORDER_CONFIRM', '📋'); },

  // Kanallar və Dəstək
  get TELEGRAM() { return getEmoji('TELEGRAM_CHANNEL', '✈️'); },
  get WHATSAPP() { return getEmoji('WHATSAPP_SUPPORT', '💬'); },
  get WORKING_HOURS() { return getEmoji('WORKING_HOURS', '⏰'); },
  get FAQ() { return getEmoji('FAQ_HELP', '❓'); },
  get REVIEWS() { return getEmoji('REVIEWS_RATING', '⭐'); },
  get REFERRAL() { return getEmoji('REFERRAL_FRIENDS', '👥'); },
  get LANGUAGE() { return getEmoji('LANGUAGE_SELECT', '🌐'); },
  get SHIELD() { return getEmoji('SHIELD_SECURITY', '🛡️'); },
  get STATS() { return getEmoji('STATS_CHART', '📊'); },
  get SEARCH() { return getEmoji('NAV_SEARCH', '🔍'); },

  // Oyunlar və Kataloqlar
  get GAMES() { return getEmoji('GAMES_CATALOG', '🎮'); },
  get LIGHTNING() { return getEmoji('LIGHTNING_FAST', '⚡'); },
  get TARGET_ID() { return getEmoji('TARGET_PLAYER_ID', '🎯'); },
  get GIFT() { return getEmoji('GIFT_REDEEM', '🎁'); },

  // Fərdi Oyunlar
  get PUBG() { return getEmoji('PUBG_MOBILE', '🔫'); },
  get PUBG_AUTO() { return getEmoji('PUBG_AUTO', '⚡'); },
  get PUBG_EPIN() { return getEmoji('PUBG_EPIN', '🎟️'); },
  get TELEGRAM_STARS() { return getEmoji('TELEGRAM_STARS', '⭐️'); },
  get TELEGRAM_PREMIUM() { return getEmoji('TELEGRAM_PREMIUM', '💎'); },
  get FREE_FIRE() { return getEmoji('FREE_FIRE', '🔥'); },
  get MOBILE_LEGENDS() { return getEmoji('MOBILE_LEGENDS', '⚔️'); },
  get ROBLOX() { return getEmoji('ROBLOX', '🧱'); },
  get STEAM() { return getEmoji('STEAM', '🎮'); },
  get GENSHIN() { return getEmoji('GENSHIN', '✨'); },
  get POOL() { return getEmoji('POOL_8_BALL', '🎱'); },
  get ARENA() { return getEmoji('ARENA_BREAKOUT', '🛡️'); },
  get ASPHALT() { return getEmoji('ASPHALT', '🏎️'); },
  get MAGIC() { return getEmoji('AGE_OF_MAGIC', '🔮'); },
  get VALORANT() { return getEmoji('VALORANT', '🎯'); },
  get BRAWL_STARS() { return getEmoji('BRAWL_STARS', '⭐'); },
  get NETFLIX() { return getEmoji('NETFLIX', '🎬'); },

  // Ödəmə Üsulları
  get BINANCE() { return getEmoji('BINANCE_PAY', '🟡'); },
  get USDT_TRC20() { return getEmoji('USDT_TRC20', '🟢'); },
  get USDT_BEP20() { return getEmoji('USDT_BEP20', '🟡'); },
  get RECEIPT() { return getEmoji('RECEIPT_BILL', '🧾'); },
  get CAMERA() { return getEmoji('PHOTO_CAMERA', '📷'); },
  get PHONE() { return getEmoji('PHONE_MOBILE', '📱'); },
  get WRITE() { return getEmoji('WRITE_EDIT', '✍️'); },

  // Status və Naviqasiya
  get DATE() { return getEmoji('DATE_CALENDAR', '📅'); },
  get PIN() { return getEmoji('PIN_STATUS', '📌'); },
  get SUCCESS() { return getEmoji('STATUS_SUCCESS', '✅'); },
  get PENDING() { return getEmoji('STATUS_PENDING', '⏳'); },
  get ERROR() { return getEmoji('STATUS_ERROR', '❌'); },
  get WARNING() { return getEmoji('STATUS_WARNING', '⚠️'); },
  get CELEBRATE() { return getEmoji('SUCCESS_CELEBRATE', '🎉'); },
  get NAV_HOME() { return getEmoji('NAV_HOME', '🏠'); },
  get NAV_BACK() { return getEmoji('NAV_BACK', '🔙'); },
  get NAV_MORE() { return getEmoji('NAV_MORE', '➡️'); },
  get NAV_PREV() { return getEmoji('NAV_PREV', '⬅️'); },
  get NAV_WEB() { return getEmoji('NAV_WEB', '🌐'); },
  get NAV_RELOAD() { return getEmoji('NAV_RELOAD', '🔄'); },
  get ADMIN_CROWN() { return getEmoji('ADMIN_CROWN', '👑'); },

  // Paket Səviyyə Medalları
  get TIER_BRONZE() { return getEmoji('TIER_BRONZE', '🥉'); },
  get TIER_SILVER() { return getEmoji('TIER_SILVER', '🥈'); },
  get TIER_GOLD() { return getEmoji('TIER_GOLD', '🥇'); },
  get TIER_DIAMOND() { return getEmoji('TIER_DIAMOND', '💎'); },

  // Tərtibatçı API və Sənədlər və Əlavələr
  get API_DOCS() { return getEmoji('API_DOCS', '🔌'); },
  get API_KEY() { return getEmoji('API_KEY', '🔑'); },
  get API_REGEN() { return getEmoji('API_REGEN', '🔄'); },
  get DOCS_EXTERNAL() { return getEmoji('DOCS_EXTERNAL', '📖'); },
  get BROADCAST() { return getEmoji('BROADCAST_ANNOUNCE', '📢'); },
  get DISCORD_NITRO() { return getEmoji('DISCORD_NITRO', '💎'); },
  get SPOTIFY() { return getEmoji('SPOTIFY_PREMIUM', '🎵'); },
  get CALL_OF_DUTY() { return getEmoji('CALL_OF_DUTY', '🎖️'); },
  get BRIEFCASE() { return getEmoji('BRIEFCASE_PORTFOLIO', '💼'); },
  get BRIEFCASE_PORTFOLIO() { return getEmoji('BRIEFCASE_PORTFOLIO', '💼'); },
};

import { getApiCategory } from '../database/db.js';

export function getCustomEmojiId(key: string): string | null {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const data: Record<string, EmojiConfigItem> = JSON.parse(raw);
      const item = data[key];
      if (item && item.custom_emoji_id && item.custom_emoji_id.trim().length > 0) {
        return item.custom_emoji_id.trim();
      }
    }
  } catch (e) {}
  return null;
}

export function getCategoryCustomEmojiId(categoryId: string): string | null {
  try {
    const catRec = getApiCategory(categoryId);
    if (catRec && catRec.custom_emoji_id && catRec.custom_emoji_id.trim().length > 0) {
      return catRec.custom_emoji_id.trim();
    }
  } catch (e) {}

  const cat = (categoryId || '').toLowerCase();
  // Əvvəlcə Xüsusi yoxlamalar
  if (cat.includes('brawl')) return getCustomEmojiId('BRAWL_STARS');
  if (cat.includes('pubg') && (cat.includes('auto') || cat.includes('direct'))) return getCustomEmojiId('PUBG_AUTO') || getCustomEmojiId('PUBG_MOBILE');
  if (cat.includes('pubg')) return getCustomEmojiId('PUBG_MOBILE');
  if (cat.includes('free_fire') || cat.includes('freefire')) return getCustomEmojiId('FREE_FIRE');
  if (cat.includes('telegram_stars') || (cat.includes('star') && !cat.includes('brawl'))) return getCustomEmojiId('TELEGRAM_STARS');
  if (cat.includes('premium')) return getCustomEmojiId('TELEGRAM_PREMIUM');
  if (cat.includes('roblox')) return getCustomEmojiId('ROBLOX');
  if (cat.includes('steam')) return getCustomEmojiId('STEAM');
  if (cat.includes('mobile_legends') || cat.includes('mlbb')) return getCustomEmojiId('MOBILE_LEGENDS');
  if (cat.includes('king')) return getCustomEmojiId('BE_THE_KING');
  if (cat.includes('valorant')) return getCustomEmojiId('VALORANT');
  if (cat.includes('netflix')) return getCustomEmojiId('NETFLIX');
  if (cat.includes('genshin')) return getCustomEmojiId('GENSHIN');
  if (cat.includes('pool')) return getCustomEmojiId('POOL_8_BALL');
  if (cat.includes('arena')) return getCustomEmojiId('ARENA_BREAKOUT');
  if (cat.includes('asphalt')) return getCustomEmojiId('ASPHALT');
  if (cat.includes('magic')) return getCustomEmojiId('AGE_OF_MAGIC');
  return null;
}

export function getCategoryEmoji(categoryId: string): string {
  const customId = getCategoryCustomEmojiId(categoryId) || getCustomEmojiId('GAMES_CATALOG') || '5994703708653361268';
  const catRec = getApiCategory(categoryId);
  if (customId) {
    return `<tg-emoji emoji-id="${customId}">${catRec?.icon || '🎮'}</tg-emoji>`;
  }
  return catRec?.icon || EMOJIS.GAMES;
}

export function getOfferCustomEmojiId(categoryId: string, offerName: string, offerId: string = ''): string | null {
  const name = (offerName + ' ' + offerId).toLowerCase();

  // 1. Kateqoriyanın öz oyun logosu/emojisi varsa (Free Fire, PUBG, Valorant və s.), bütün paketlər üçün istifadə et
  const catEmojiId = getCategoryCustomEmojiId(categoryId);
  if (catEmojiId) {
    // Yalnız xüsusi Pass elementlərinin opsional Tac-ı ola bilər, əks halda rəsmi oyun logosunu istifadə et
    if (/royale pass|elite pass|prime plus|monthly pass/i.test(name)) {
      return getCustomEmojiId('TIER_CROWN') || catEmojiId;
    }
    return catEmojiId;
  }

  // 2. Xüsusi oyun adı yoxlamaları
  if (name.includes('brawl') || categoryId.includes('brawl')) return getCustomEmojiId('BRAWL_STARS');
  if (name.includes('pubg') || categoryId.includes('pubg')) return getCustomEmojiId('PUBG_MOBILE');
  if (name.includes('free fire') || name.includes('freefire') || categoryId.includes('free_fire')) return getCustomEmojiId('FREE_FIRE');
  if (name.includes('valorant') || categoryId.includes('valorant')) return getCustomEmojiId('VALORANT');
  if (name.includes('roblox') || name.includes('robux') || categoryId.includes('roblox')) return getCustomEmojiId('ROBLOX');
  if (name.includes('steam') || categoryId.includes('steam')) return getCustomEmojiId('STEAM');
  if (name.includes('mobile legends') || name.includes('mlbb') || categoryId.includes('mobile_legends')) return getCustomEmojiId('MOBILE_LEGENDS');

  // Telegram Ulduzlar və Premium
  if ((categoryId.includes('stars') || name.includes('star')) && !categoryId.includes('brawl')) return getCustomEmojiId('TELEGRAM_STARS');
  if (categoryId.includes('premium') || name.includes('premium')) return getCustomEmojiId('TELEGRAM_PREMIUM');

  // Ümumi ehtiyat dəyərləri
  if (/pass|prime|vip|plus|elite/i.test(name)) return getCustomEmojiId('TIER_CROWN') || getCustomEmojiId('ADMIN_CROWN');
  if (/gift|card|voucher|epin|code/i.test(name)) return getCustomEmojiId('TIER_GIFT') || getCustomEmojiId('GIFT_REDEEM');

  return getCustomEmojiId('GAMES_CATALOG') || '5994703708653361268';
}
