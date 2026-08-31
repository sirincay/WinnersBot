import axios from 'axios';
import { config } from '../config/config.js';
import { playpinService } from './playpin.service.js';
import { getSetting } from '../database/db.js';

export interface FazerBalance {
  ok: boolean;
  balance: string;
  currency: string;
}

export interface FazerCategory {
  category_id: string;
  name: string;
  note?: string;
  type: 'topup' | 'giftcard';
}

export interface FazerOffer {
  offer_id: string;
  name: string;
  price_usd: string;
  stock?: number;
  min_order_quantity?: number;
  max_order_quantity?: number;
}

export interface FazerOffersResponse {
  ok: boolean;
  kind?: string;
  category_id?: string;
  name?: string;
  offers?: FazerOffer[];
  fields?: Array<{ key: string; label: string; type: string }>;
  note?: string;
  error?: string;
}

export interface FazerOrderResponse {
  ok: boolean;
  order_id?: string;
  status?: string;
  error?: string;
  code?: string;
  cards?: Array<{ code: string; pin?: string }>;
  message?: string;
}

class FazerCardsService {
  public getApiKey(): string {
    const fromSettings = getSetting('fazercards_api_key');
    if (fromSettings && fromSettings.trim()) {
      return fromSettings.trim();
    }
    return (process.env.FAZERCARDS_API_KEY || process.env.FAZER_API_KEY || config.fazerCards.apiKey || 'fc_eb9eea253d224b931a44d880').trim();
  }

  private get client() {
    return axios.create({
      baseURL: config.fazerCards.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.getApiKey()}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  private categoriesCache: { topups: FazerCategory[]; giftcards: FazerCategory[]; lastFetch: number } | null = null;
  private offersCache: Map<string, { data: FazerOffersResponse; lastFetch: number }> = new Map();

  async getBalance(): Promise<FazerBalance> {
    try {
      const res = await this.client.get<FazerBalance>('/balance');
      return res.data;
    } catch (err: any) {
      console.error('FazerCards getBalance xətası:', err.response?.data || err.message);
      return { ok: false, balance: '0.00', currency: 'USD' };
    }
  }

  async fetchAllCategories(): Promise<{ topups: FazerCategory[]; giftcards: FazerCategory[] }> {
    if (this.categoriesCache && Date.now() - this.categoriesCache.lastFetch < 30 * 60 * 1000) {
      return { topups: this.categoriesCache.topups, giftcards: this.categoriesCache.giftcards };
    }

    const fetchEndpoint = async (endpoint: 'topups' | 'giftcards'): Promise<FazerCategory[]> => {
      let items: FazerCategory[] = [];
      let cursor: string | null = null;
      try {
        while (true) {
          const reqUrl: string = cursor ? `/${endpoint}?cursor=${encodeURIComponent(cursor)}` : `/${endpoint}`;
          const response = await this.client.get(reqUrl);
          if (response.data?.items) {
            const parsed = response.data.items.map((i: any) => ({
              category_id: i.category_id,
              name: i.name,
              note: i.note,
              type: endpoint === 'topups' ? 'topup' : 'giftcard'
            }));
            items.push(...parsed);
          }
          if (response.data?.meta?.has_more && response.data?.meta?.next_cursor) {
            cursor = response.data.meta.next_cursor;
          } else {
            break;
          }
        }
      } catch (err: any) {
        console.error(`FazerCards ${endpoint} yükləmə xətası:`, err.message);
      }
      return items;
    };

    const [topups, giftcards] = await Promise.all([fetchEndpoint('topups'), fetchEndpoint('giftcards')]);
    
    // PlayPin PUBG Kateqoriyalarını ən üstə açıq şəkildə əlavə et
    const playPinTopups: FazerCategory[] = [
      { category_id: 'pubg_mobile_web', name: 'PUBG Mobile (Operator Manual)', note: 'PlayPin API Top-Up', type: 'topup' }
    ];
    const playPinGiftcards: FazerCategory[] = [
      { category_id: 'pubg_mobile_epin', name: 'PUBG Mobile (E-Pin Voucher)', note: 'PlayPin API E-Pin', type: 'giftcard' }
    ];

    const finalTopups = [...playPinTopups, ...topups.filter(t => !t.category_id.toLowerCase().includes('pubg'))];
    const finalGiftcards = [...playPinGiftcards, ...giftcards.filter(g => !g.category_id.toLowerCase().includes('pubg'))];

    this.categoriesCache = { topups: finalTopups, giftcards: finalGiftcards, lastFetch: Date.now() };
    return { topups: finalTopups, giftcards: finalGiftcards };
  }

  // Anında Telegram Menyusu və Veb qəhrəmanı (Hero) üçün əvvəlcədən təyin olunmuş yüksək tələbatlı kateqoriyalar
  getFeaturedCategories() {
    return [
      { id: 'pubg_mobile_web', name: 'PUBG Mobile (Operator Manual)', type: 'topup', icon: '🎮', tag: 'PlayPin API' },
      { id: 'pubg_mobile_epin', name: 'PUBG Mobile (E-Pin Voucher)', type: 'giftcard', icon: '💳', tag: 'PlayPin API' },
      { id: 'free_fire_cis', name: 'Free Fire (CIS)', type: 'topup', icon: '🔥', tag: 'Avtomatik' },
      { id: 'mobile_legends_global', name: 'Mobile Legends (Global)', type: 'topup', icon: '⚔️', tag: 'Avtomatik' },
      { id: 'genshin_impact_global', name: 'Genshin Impact (Global)', type: 'topup', icon: '✨', tag: 'Populyar' },
      { id: '8_ball_pool', name: '8 Ball Pool (Coins/Cash)', type: 'topup', icon: '🎱', tag: 'Avtomatik' },
      { id: 'arena_breakout', name: 'Arena Breakout (Bonds)', type: 'topup', icon: '🛡️', tag: 'Avtomatik' },
      { id: 'asphalt_9_legends', name: 'Asphalt Legends', type: 'topup', icon: '🏎️', tag: 'Avtomatik' },
      { id: 'age_of_magic', name: 'Age of Magic (Gold)', type: 'topup', icon: '🔮', tag: 'Populyar' },
    ];
  }

  public resolveCategoryId(categoryId: string): string {
    const map: Record<string, string> = {
      'pubg-mobile': 'pubg_mobile_auto',
      'pubg_mobile_auto': 'pubg_mobile_auto',
      'pubg_mobile_web': 'pubg_mobile_web',
      'pubg_mobile_epin': 'pubg_mobile_epin',
      'pubg_mobile': 'pubg_mobile_epin',
      'pubg-mobile-uc-turkey': 'pubg_mobile_epin',
      'pubg_mobile_manual': 'pubg_mobile_epin',
      'free-fire-direct': 'free_fire_cis',
      'valorant': 'valorant_tr',
      'valorant_tr': 'valorant_tr',
      'valorant_us': 'valorant_us',
      'roblox-gift-card': 'roblox_global',
      'roblox_global': 'roblox_global',
      'mobile-legends-direct': 'mobile_legends_global',
      'mobile_legends_direct': 'mobile_legends_global',
      'mobile_legends_global': 'mobile_legends_global',
      'steam_usd': 'steam_wallet_global',
      'steam-usd': 'steam_wallet_global',
      'steam_wallet_global': 'steam_wallet_global',
      'telegram-stars': 'telegram_stars',
      'telegram_stars': 'telegram_stars',
      'telegram-premium-gift': 'telegram_premium',
      'telegram_premium_gift': 'telegram_premium',
      'telegram_premium': 'telegram_premium',
      'netflix_tr': 'netflix_us',
      'netflix-tr': 'netflix_us',
      'netflix_us': 'netflix_us',
    };
    return map[categoryId] || categoryId;
  }

  async getOffers(categoryId: string, type: 'topup' | 'giftcard' = 'topup'): Promise<FazerOffersResponse> {
    categoryId = this.resolveCategoryId(categoryId);
    const cacheKey = `${type}_${categoryId}`;
    const cached = this.offersCache.get(cacheKey);
    if (cached && Date.now() - cached.lastFetch < 10 * 60 * 1000) {
      return cached.data;
    }

    // 1. PlayPin PUBG Web Purchase (Birbaşa Top-up)
    if (categoryId === 'pubg_mobile_web') {
      const res = await playpinService.getPubgWebOffers();
      const normalizedOffers: FazerOffer[] = (res.offers || []).map(o => ({
        offer_id: o.id.toString(),
        name: o.title,
        price_usd: o.unit_price.toString(),
        stock: o.stock,
      }));
      const finalData: FazerOffersResponse = {
        ok: true,
        category_id: 'pubg_mobile_web',
        name: 'PUBG Mobile (Operator Manual)',
        offers: normalizedOffers,
        note: 'PlayPin API Web Direct Top-Up',
      };
      this.offersCache.set(cacheKey, { data: finalData, lastFetch: Date.now() });
      return finalData;
    }

    // 2. PlayPin PUBG E-Pin Vauçerləri
    if (categoryId === 'pubg_mobile_epin' || categoryId === 'pubg_mobile') {
      const res = await playpinService.getPubgCardVouchers();
      const normalizedOffers: FazerOffer[] = (res.products || []).map(p => ({
        offer_id: p.id.toString(),
        name: p.title,
        price_usd: p.unit_price.toString(),
        stock: p.stock,
      }));
      const finalData: FazerOffersResponse = {
        ok: true,
        category_id: 'pubg_mobile_epin',
        name: 'PUBG Mobile (E-Pin Voucher)',
        offers: normalizedOffers,
        note: 'PlayPin API E-Pin Voucher Codes',
      };
      this.offersCache.set(cacheKey, { data: finalData, lastFetch: Date.now() });
      return finalData;
    }

    const isGiftcard = type ==='giftcard' ||
      (categoryId.includes('stars') && !categoryId.includes('brawl')) ||
      categoryId.includes('premium') ||
      categoryId.includes('giftcard') ||
      categoryId.includes('wallet') ||
      categoryId.includes('roblox') ||
      categoryId.includes('steam') ||
      categoryId.includes('google_play') ||
      categoryId.includes('itunes') ||
      categoryId.includes('apple') ||
      categoryId.includes('playstation') ||
      categoryId.includes('xbox');

    // Müxtəlif API cavab formalarından gələn təklifləri normallaşdırmaq üçün köməkçi
    const normalizeFazerOffers = (rawOffers: any[]): FazerOffer[] => {
      return (rawOffers || []).map((o: any) => ({
        offer_id: (o.card_id || o.offer_id || o.id || '').toString(),
        name: o.name || o.title || '',
        price_usd: (o.price_usd || o.unit_price || o.price || '0').toString(),
        stock: typeof o.stock === 'number' ? o.stock : (parseInt(o.stock, 10) || 0),
        min_order_quantity: o.min_order_quantity,
        max_order_quantity: o.max_order_quantity,
      })).filter(o => o.offer_id && o.name);
    };

    if (isGiftcard) {
      try {
        const res = await this.client.get<any>(`/giftcards/cards?category_id=${categoryId}`);
        const offers = normalizeFazerOffers(res.data?.offers || res.data?.items || res.data?.cards || []);
        if (offers.length > 0) {
          const finalData: FazerOffersResponse = {
            ok: true,
            category_id: res.data?.category_id || categoryId,
            name: res.data?.name || categoryId,
            offers,
            note: res.data?.note,
          };
          this.offersCache.set(cacheKey, { data: finalData, lastFetch: Date.now() });
          return finalData;
        }
      } catch (err: any) {}

      // Topuplara geri dönüş et
      try {
        const res = await this.client.get<FazerOffersResponse>(`/topups/offers?category_id=${categoryId}`);
        const offers = normalizeFazerOffers(res.data?.offers || (res.data as any)?.items || []);
        if (offers.length > 0) {
          const finalData: FazerOffersResponse = {
            ok: true,
            category_id: res.data?.category_id || categoryId,
            name: res.data?.name || categoryId,
            offers,
            fields: res.data?.fields,
            note: res.data?.note,
          };
          this.offersCache.set(cacheKey, { data: finalData, lastFetch: Date.now() });
          return finalData;
        }
      } catch (err: any) {}
    } else {
      // İlk olaraq Topup
      try {
        const res = await this.client.get<FazerOffersResponse>(`/topups/offers?category_id=${categoryId}`);
        const offers = normalizeFazerOffers(res.data?.offers || (res.data as any)?.items || []);
        if (offers.length > 0) {
          const finalData: FazerOffersResponse = {
            ok: true,
            category_id: res.data?.category_id || categoryId,
            name: res.data?.name || categoryId,
            offers,
            fields: res.data?.fields,
            note: res.data?.note,
          };
          this.offersCache.set(cacheKey, { data: finalData, lastFetch: Date.now() });
          return finalData;
        }
      } catch (err: any) {}

      // Hədiyyə kartlarına geri dönüş et
      try {
        const res = await this.client.get<any>(`/giftcards/cards?category_id=${categoryId}`);
        const offers = normalizeFazerOffers(res.data?.offers || res.data?.items || res.data?.cards || []);
        if (offers.length > 0) {
          const finalData: FazerOffersResponse = {
            ok: true,
            category_id: res.data?.category_id || categoryId,
            name: res.data?.name || categoryId,
            offers,
            note: res.data?.note,
          };
          this.offersCache.set(cacheKey, { data: finalData, lastFetch: Date.now() });
          return finalData;
        }
      } catch (err: any) {}
    }

    if (categoryId.includes('brawl')) {
      const brawlOffers: FazerOffer[] = [
        { offer_id: '30_gems', name: '30 Gems', price_usd: '1.99', stock: 9999 },
        { offer_id: '80_gems', name: '80 Gems', price_usd: '4.99', stock: 9999 },
        { offer_id: '170_gems', name: '170 Gems', price_usd: '9.99', stock: 9999 },
        { offer_id: '360_gems', name: '360 Gems', price_usd: '19.99', stock: 9999 },
        { offer_id: '950_gems', name: '950 Gems', price_usd: '49.99', stock: 9999 },
        { offer_id: '2000_gems', name: '2000 Gems', price_usd: '99.99', stock: 9999 },
        { offer_id: 'brawl_pass', name: 'Brawl Pass', price_usd: '6.99', stock: 9999 },
        { offer_id: 'brawl_pass_plus', name: 'Brawl Pass Plus', price_usd: '9.99', stock: 9999 },
      ];
      const brawlData: FazerOffersResponse = {
        ok: true,
        category_id: categoryId,
        name: 'Brawl Stars',
        offers: brawlOffers,
        note: 'Brawl Stars Daşları (Gems) & Brawl Pass',
      };
      this.offersCache.set(cacheKey, { data: brawlData, lastFetch: Date.now() });
      return brawlData;
    }

    return {
      ok: false,
      error: 'Bu kateqoriya təchizatçı (FazerCards) sistemində hazırda deaktivdir və ya stokda paket yoxdur.'
    };
  }

  async validatePlayerId(categoryId: string, fields: Record<string, any>): Promise<{ ok: boolean; username?: string; error?: string }> {
    categoryId = this.resolveCategoryId(categoryId);
    try {
      const res = await this.client.post('/topups/validate-id', {
        category_id: categoryId,
        fields,
      });
      return res.data;
    } catch (err: any) {
      // ID təsdiqi API v2-də bəzi oyunlarda dəstəklənməyə bilər
      return { ok: false, error: err.response?.data?.error || 'ID yoxlanışı mövcud deyil.' };
    }
  }

  async createTopupOrder(categoryId: string, offerId: string, fields: Record<string, any>): Promise<FazerOrderResponse> {
    categoryId = this.resolveCategoryId(categoryId);
    try {
      const res = await this.client.post<FazerOrderResponse>('/topups/order', {
        category_id: categoryId,
        offer_id: offerId,
        fields,
      });
      return res.data;
    } catch (err: any) {
      console.error('FazerCards createTopupOrder xətası:', err.response?.data || err.message);
      return {
        ok: false,
        error: err.response?.data?.error || err.response?.data?.message || 'Sifariş göndərilərkən FazerCards tərəfindən xəta baş verdi.'
      };
    }
  }

  async createGiftcardOrder(categoryId: string, cardId: string, count: number = 1): Promise<FazerOrderResponse> {
    categoryId = this.resolveCategoryId(categoryId);
    const qty = count && count > 0 ? count : 1;
    try {
      const res = await this.client.post<FazerOrderResponse>('/giftcards/order', {
        category_id: categoryId,
        card_id: cardId,
        offer_id: cardId,
        quantity: qty,
        count: qty,
      });
      return res.data;
    } catch (err: any) {
      console.error('FazerCards createGiftcardOrder xətası:', err.response?.data || err.message);
      return {
        ok: false,
        error: err.response?.data?.error || err.response?.data?.message || 'Hədiyyə kartı sifarişi zamanı xəta baş verdi.'
      };
    }
  }

  async getOrders(): Promise<{ ok: boolean; items: any[]; error?: string }> {
    try {
      const res = await this.client.get('/orders');
      if (res.data?.ok && Array.isArray(res.data.items)) {
        return { ok: true, items: res.data.items };
      }
      return { ok: false, items: [], error: 'Orders could not be fetched' };
    } catch (err: any) {
      console.error('FazerCards getOrders error:', err.response?.data || err.message);
      return { ok: false, items: [], error: err.message };
    }
  }
}

export const fazerCardsService = new FazerCardsService();
