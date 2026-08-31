import axios from 'axios';
import { getSetting } from '../database/db.js';

export interface PlayPinUser {
  success: boolean;
  user_id: number;
  username: string;
  first_name: string;
  balance: number;
}

export interface PlayPinOffer {
  id: number | string;
  title: string;
  unit_price: string | number;
  stock: number;
  description?: string;
  category_id?: number;
  category_title?: string;
}

export interface PlayPinPurchaseResult {
  success: boolean;
  order_id?: number | string;
  transaction_id?: number | string;
  product_id?: number | string;
  product_title?: string;
  delivery_items?: string[];
  error?: string;
}

class PlayPinService {
  private baseUrl = 'https://playpin.upgrow.uz';

  public getApiKey(): string {
    const fromSettings = getSetting('playpin_api_key');
    if (fromSettings && fromSettings.trim()) {
      return fromSettings.trim();
    }
    return (process.env.PLAYPIN_API_KEY || process.env.PLAYPIN_KEY || process.env.PLAYPIN_TOKEN || '').trim();
  }

  public isConfigured(): boolean {
    return this.getApiKey().length > 0;
  }

  private getHeaders(): Record<string, string> {
    const key = this.getApiKey();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': key,
      'X-API-KEY': key, // Hər iki şrift registrini dəstəkləyir (böyük/kiçik)
    };
  }

  // Hesab detallarını və balansını gətir
  async getMe(): Promise<{ ok: boolean; data?: PlayPinUser; error?: string }> {
    try {
      if (!this.isConfigured()) {
        return { ok: false, error: 'PlayPin API Key təyin edilməyib.' };
      }

      const res = await axios.get(`${this.baseUrl}/v1/getMe`, {
        headers: this.getHeaders(),
        timeout: 10000,
        validateStatus: () => true,
      });

      const data = res.data;
      if (res.status === 200 && (data.success || data.balance !== undefined)) {
        return {
          ok: true,
          data: {
            success: true,
            user_id: data.user_id || 0,
            username: data.username || '',
            first_name: data.first_name || '',
            balance: parseFloat(data.balance || '0'),
          },
        };
      } else {
        return { ok: false, error: data.detail || data.error || 'Autentifikasiya xətası' };
      }
    } catch (err: any) {
      console.error('PlayPin getMe error:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // PUBG Kart Alışını gətir (E-Pin / Vauçerlər)
  async getPubgCardVouchers(): Promise<{ ok: boolean; products: PlayPinOffer[]; error?: string }> {
    try {
      if (!this.isConfigured()) {
        return { ok: true, products: this.getFallbackCardOffers() };
      }

      const res = await axios.get(`${this.baseUrl}/v1/category/1`, {
        headers: this.getHeaders(),
        timeout: 10000,
        validateStatus: () => true,
      });

      let rawItems = res.data;
      if (!Array.isArray(rawItems) && rawItems && rawItems.products) {
        rawItems = rawItems.products;
      }

      if (Array.isArray(rawItems) && rawItems.length > 0) {
        const mapped: PlayPinOffer[] = rawItems
          .filter((p: any) => {
            const t = (p.name || p.title || '').toLowerCase();
            return (t.includes('uc') || t.includes('pubg')) && !t.includes('10 uc');
          })
          .map((p: any) => {
            let cleanTitle = (p.name || p.title || `PUBG Voucher ${p.id}`).trim();
            
            // Standart UC nömrələrini uyğunlaşdır: "60 Uc 1Year Stockable" -> "60 UC Vauçer"
            const ucMatch = cleanTitle.match(/^(\d+)\s*uc/i);
            if (ucMatch) {
              cleanTitle = `${ucMatch[1]} UC Voucher`;
            } else {
              cleanTitle = cleanTitle
                .replace(/1Year Stockable/gi, 'Voucher')
                .replace(/3 Months Stockable/gi, 'Voucher')
                .trim();
            }

            return {
              id: p.id,
              title: cleanTitle,
              unit_price: typeof p.price !== 'undefined' ? p.price : (p.unit_price || 0),
              stock: typeof p.stock !== 'undefined' ? p.stock : 9999,
              description: p.description || '',
              category_id: p.category_id || 1,
              category_title: 'PUBG MOBILE UC VOUCHERS',
            };
          });

        // Qiymətə görə artan sıra ilə düz (from 60 UC to 40500 UC)
        mapped.sort((a, b) => Number(a.unit_price || 0) - Number(b.unit_price || 0));

        return { ok: true, products: mapped };
      }

      return { ok: true, products: this.getFallbackCardOffers() };
    } catch (err: any) {
      console.error('PlayPin getPubgCardVouchers error:', err.message);
      return { ok: true, products: this.getFallbackCardOffers() };
    }
  }

  // PUBG Web Purchase Təkliflərini Gətir — Kateqoriya 10 = "PUBG WEB PURCHASE"
  // Məhsul ID-ləri: 38(60UC,$0.88), 37(325UC,$4.40), 36(660UC,$8.70),
  //              35(1800UC,$21.50), 34(3850UC,$42.50), 33(8100UC,$82.80)
  // Bunlar POST /v1/manual/order { product_id, count, pubg_id } ilə istifadə olunur
  async getPubgWebOffers(): Promise<{ ok: boolean; offers: PlayPinOffer[]; error?: string }> {
    try {
      if (!this.isConfigured()) {
        return { ok: true, offers: this.getFallbackWebOffers() };
      }

      const res = await axios.get(`${this.baseUrl}/v1/category/10`, {
        headers: this.getHeaders(),
        timeout: 10000,
        validateStatus: () => true,
      });

      let rawItems = res.data;
      if (!Array.isArray(rawItems) && rawItems && rawItems.products) {
        rawItems = rawItems.products;
      }

      if (Array.isArray(rawItems) && rawItems.length > 0) {
        // Kateqoriya 10 = PUBG WEB PURCHASE — PlayPin Telegram botu ilə eynilik təşkil edən dəqiq məhsul ID-ləri
        const allowedIds = [33, 34, 35, 36, 37, 38];
        const filtered = rawItems.filter((p: any) => allowedIds.includes(Number(p.id)));

        const mapped: PlayPinOffer[] = filtered.map((p: any) => {
          // Təmiz ad üçün həqiqət mənbəyi olaraq məhsul ID-dən istifadə et — regex qeyri-müəyyənliyinin qarşısını alır
          const idToName: Record<number, string> = {
            38: '60 UC',
            37: '325 UC',
            36: '660 UC',
            35: '1800 UC',
            34: '3850 UC',
            33: '8100 UC',
          };
          const cleanTitle = idToName[Number(p.id)] || (p.name || p.title || `UC ${p.id}`).trim();

          return {
            id: p.id,
            title: cleanTitle,
            unit_price: typeof p.price !== 'undefined' ? p.price : (p.unit_price || 0),
            stock: typeof p.stock !== 'undefined' ? p.stock : 0,
            description: p.description || '',
            category_id: 10,
            category_title: 'PUBG WEB PURCHASE',
          };
        });

        // Qiymətə görə artan sıra ilə düz
        mapped.sort((a, b) => Number(a.unit_price || 0) - Number(b.unit_price || 0));

        return { ok: true, offers: mapped.length > 0 ? mapped : this.getFallbackWebOffers() };
      }

      return { ok: true, offers: this.getFallbackWebOffers() };
    } catch (err: any) {
      console.error('PlayPin getPubgWebOffers error:', err.message);
      return { ok: true, offers: this.getFallbackWebOffers() };
    }
  }

  // PUBG Card Purchase Təkliflərini Gətir — Kateqoriya 3 = "PUBG CARD PURCHASE"
  async getPubgCardOffers(): Promise<{ ok: boolean; offers: PlayPinOffer[]; error?: string }> {
    try {
      if (!this.isConfigured()) {
        return { ok: true, offers: this.getFallbackCardPurchaseOffers() };
      }

      const res = await axios.get(`${this.baseUrl}/v1/category/3`, {
        headers: this.getHeaders(),
        timeout: 10000,
        validateStatus: () => true,
      });

      let rawItems = res.data;
      if (!Array.isArray(rawItems) && rawItems && rawItems.products) {
        rawItems = rawItems.products;
      }

      if (Array.isArray(rawItems) && rawItems.length > 0) {
        const mapped: PlayPinOffer[] = rawItems
          .filter((p: any) => {
            const t = (p.name || p.title || '').toLowerCase();
            return t.includes('uc') && t.includes('card');
          })
          .map((p: any) => {
            let cleanTitle = (p.name || p.title || `UC Card ${p.id}`).trim();
            const ucMatch = cleanTitle.match(/(\d+)\s*uc/i);
            if (ucMatch) {
              cleanTitle = `${ucMatch[1]} UC Card`;
            }
            return {
              id: p.id,
              title: cleanTitle,
              unit_price: typeof p.price !== 'undefined' ? p.price : (p.unit_price || 0),
              stock: typeof p.stock !== 'undefined' ? p.stock : 0,
              description: p.description || '',
              category_id: 3,
              category_title: 'PUBG CARD PURCHASE',
            };
          });

        mapped.sort((a, b) => Number(a.unit_price || 0) - Number(b.unit_price || 0));
        return { ok: true, offers: mapped.length > 0 ? mapped : this.getFallbackCardPurchaseOffers() };
      }

      return { ok: true, offers: this.getFallbackCardPurchaseOffers() };
    } catch (err: any) {
      console.error('PlayPin getPubgCardOffers error:', err.message);
      return { ok: true, offers: this.getFallbackCardPurchaseOffers() };
    }
  }

  // PUBG Card Purchase — Manual sifariş (Player ID lazım deyil, kart kodu göndərilir)
  async purchasePubgCard(
    productId: number | string,
    count = 1
  ): Promise<PlayPinPurchaseResult> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'PlayPin API Key təyin edilməyib.' };
      }

      const res = await axios.post(
        `${this.baseUrl}/v1/manual/order`,
        {
          product_id: Number(productId),
          count: count,
        },
        {
          headers: this.getHeaders(),
          timeout: 20000,
          validateStatus: () => true,
        }
      );

      const data = res.data;

      if ((res.status === 200 || res.status === 201) && (data.id || data.order_id || data.success)) {
        return {
          success: true,
          order_id: data.id || data.order_id,
          product_id: productId,
          product_title: data.product_title || data.product?.name || `PUBG UC Card (${productId})`,
        };
      }

      let errStr = 'Card Purchase sifarişi qəbul edilmədi';
      if (data && typeof data === 'object') {
        if (data.detail) errStr = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        else if (data.error) errStr = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        else if (data.message) errStr = data.message;
        else errStr = JSON.stringify(data).slice(0, 200);
      }
      return { success: false, error: errStr };
    } catch (err: any) {
      console.error('PlayPin purchasePubgCard error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // PUBG Card Purchase fallback təklifləri — Kateqoriya 3
  public getFallbackCardPurchaseOffers(): PlayPinOffer[] {
    return [
      { id: 100, title: '1800 UC Card', unit_price: 22.00, stock: 0, category_id: 3, category_title: 'PUBG CARD PURCHASE' },
      { id: 101, title: '3850 UC Card', unit_price: 42.50, stock: 0, category_id: 3, category_title: 'PUBG CARD PURCHASE' },
      { id: 102, title: '8100 UC Card', unit_price: 84.00, stock: 0, category_id: 3, category_title: 'PUBG CARD PURCHASE' },
    ];
  }

  // PUBG Kart Vauçeri Alışı (E-Pin)
  async purchasePubgCardVoucher(
    productId: number | string,
    quantity = 1
  ): Promise<PlayPinPurchaseResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'PlayPin API Key təyin edilməyib. Zəhmət olmasa admin panelindən API Key daxil edin.',
        };
      }

      const res = await axios.post(
        `${this.baseUrl}/v1/products/${productId}/purchase`,
        { quantity },
        {
          headers: this.getHeaders(),
          timeout: 15000,
          validateStatus: () => true,
        }
      );

      const data = res.data;
      const orderId = data.id || data.order_id || data.orderId;

      let items: string[] = [];

      // 1. PlayPin-in əsas "values" (dəyərlər) sahəsindən çıxart
      if (typeof data.values === 'string' && data.values.trim()) {
        items = data.values
          .split('\n')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
      } else if (Array.isArray(data.values)) {
        items = data.values.map((x: any) => typeof x === 'string' ? x.trim() : (x.code || x.pin || JSON.stringify(x)));
      } else if (Array.isArray(data.delivery_items)) {
        items = data.delivery_items.map((x: any) => typeof x === 'string' ? x.trim() : (x.code || x.pin || JSON.stringify(x)));
      } else if (Array.isArray(data.codes)) {
        items = data.codes.map((x: any) => typeof x === 'string' ? x.trim() : (x.code || x.pin || JSON.stringify(x)));
      } else if (Array.isArray(data.items)) {
        items = data.items.map((x: any) => typeof x === 'string' ? x.trim() : (x.code || x.pin || JSON.stringify(x)));
      } else if (typeof data.code === 'string' && data.code.trim()) {
        items = [data.code.trim()];
      } else if (typeof data.voucher === 'string' && data.voucher.trim()) {
        items = [data.voucher.trim()];
      } else if (typeof data.pin === 'string' && data.pin.trim()) {
        items = [data.pin.trim()];
      }

      // Əgər uğurlu status kodu və sifariş ID yaradılıbsa, lakin dəyərlər boşdursa, sifariş detallarını gətir
      if ((res.status === 200 || res.status === 201) && orderId && items.length === 0) {
        try {
          const detailRes = await axios.get(`${this.baseUrl}/v1/orders/${orderId}`, {
            headers: this.getHeaders(),
            timeout: 8000,
            validateStatus: () => true,
          });
          if (detailRes.data && typeof detailRes.data.values === 'string') {
            items = detailRes.data.values
              .split('\n')
              .map((s: string) => s.trim())
              .filter((s: string) => s.length > 0);
          }
        } catch (e) {}
      }

      const isSuccess = (res.status === 200 || res.status === 201) &&
        (data.status === 'COMPLETED' || data.status === true || data.success || orderId || items.length > 0);

      if (isSuccess) {
        return {
          success: true,
          order_id: orderId,
          transaction_id: data.transaction_id,
          product_id: data.product_id || productId,
          product_title: data.product_title,
          delivery_items: items.length > 0 ? items : (data.code ? [data.code] : []),
        };
      } else {
        let errStr = 'E-Pin sifarişi tamamlanmadı';
        if (Array.isArray(data) && data.length > 0) {
          errStr = typeof data[0] === 'string' ? data[0] : (data[0].message || JSON.stringify(data[0]));
        } else if (typeof data === 'string') {
          errStr = data;
        } else if (data.detail) {
          errStr = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        } else if (data.error) {
          errStr = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        } else if (data.message) {
          errStr = data.message;
        }

        if (errStr.includes('NO_CODES_AVAILABLE') || errStr.includes('Activation error')) {
          errStr = '⚠️ Bu paketin stoku hazırda tükənib. Zəhmət olmasa bir qədər sonra yenidən cəhd edin və ya PUBG Auto ID bölməsindən istifadə edin.';
        }

        return {
          success: false,
          error: errStr,
        };
      }
    } catch (err: any) {
      console.error('PlayPin purchasePubgCardVoucher error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // PUBG Web Manual Sifariş Alış-verişi — POST /v1/manual/order
  // Kateqoriya 22 məhsul ID-lərindən (87,89,91,95,97,98) {product_id, count, pubg_id} ilə istifadə edir
  async purchasePubgWebOffer(
    productId: number | string,
    playerId: string,
    count = 1
  ): Promise<PlayPinPurchaseResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'PlayPin API Key təyin edilməyib. Zəhmət olmasa admin panelindən API Key daxil edin.',
        };
      }

      const res = await axios.post(
        `${this.baseUrl}/v1/manual/order`,
        {
          product_id: Number(productId),
          count: count,
          pubg_id: playerId.trim(),
        },
        {
          headers: this.getHeaders(),
          timeout: 20000,
          validateStatus: () => true,
        }
      );

      const data = res.data;

      // Uğurlu: 200/201 id və ya order_id ilə
      if ((res.status === 200 || res.status === 201) && (data.id || data.order_id || data.success)) {
        return {
          success: true,
          order_id: data.id || data.order_id,
          product_id: productId,
          product_title: data.product_title || data.product?.name || `PUBG Mobile Web (${productId})`,
        };
      }

      // Xətanı təhlil et
      let errStr = 'Manual sifariş qəbul edilmədi';
      if (data && typeof data === 'object') {
        if (data.detail)    errStr = typeof data.detail  === 'string' ? data.detail  : JSON.stringify(data.detail);
        else if (data.error)   errStr = typeof data.error   === 'string' ? data.error   : JSON.stringify(data.error);
        else if (data.message) errStr = data.message;
        else if (data.pubg_id) errStr = `Oyunçu ID xətası: ${Array.isArray(data.pubg_id) ? data.pubg_id.join(', ') : data.pubg_id}`;
        else if (data.product_id) errStr = `Məhsul ID xətası: ${Array.isArray(data.product_id) ? data.product_id.join(', ') : data.product_id}`;
        else errStr = JSON.stringify(data).slice(0, 200);
      } else if (typeof data === 'string') {
        errStr = data.slice(0, 200);
      }

      return { success: false, error: errStr };
    } catch (err: any) {
      console.error('PlayPin purchasePubgWebOffer (manual) error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // API açarı hələ təyin olunmayıbsa və ya oflayn başlanğıcdırsa geri dönüş (fallback) siyahıları
  public getFallbackCardOffers(): PlayPinOffer[] {
    return [
      { id: 1, title: '60 UC Voucher', unit_price: 0.84, stock: 1000, category_id: 1, category_title: 'PUBG Mobile UC Vouchers' },
      { id: 2, title: '325 UC Voucher', unit_price: 4.20, stock: 500, category_id: 1, category_title: 'PUBG Mobile UC Vouchers' },
      { id: 3, title: '660 UC Voucher', unit_price: 8.40, stock: 500, category_id: 1, category_title: 'PUBG Mobile UC Vouchers' },
      { id: 4, title: '1800 UC Voucher', unit_price: 22.80, stock: 200, category_id: 1, category_title: 'PUBG Mobile UC Vouchers' },
      { id: 5, title: '3850 UC Voucher', unit_price: 48.50, stock: 100, category_id: 1, category_title: 'PUBG Mobile UC Vouchers' },
      { id: 6, title: '8100 UC Voucher', unit_price: 102.00, stock: 100, category_id: 1, category_title: 'PUBG Mobile UC Vouchers' },
    ];
  }

  // Sifarişin yerinə yetirilmə statusunu yoxla (məs. Kateqoriya 10-dakı Manual Sifarişlər üçün)
  // API nöqtəsi: GET /v1/order/status/<orderId>/ -> { id, product_id, product_title, quantity, total_price, status: 'COMPLETED' }
  async getOrderStatus(orderId: number | string): Promise<{ ok: boolean; status?: string; data?: any; error?: string }> {
    try {
      if (!this.isConfigured()) {
        return { ok: false, error: 'PlayPin API Key təyin edilməyib.' };
      }

      const res = await axios.get(`${this.baseUrl}/v1/order/status/${orderId}/`, {
        headers: this.getHeaders(),
        timeout: 10000,
        validateStatus: () => true,
      });

      if (res.status === 200 && res.data) {
        return {
          ok: true,
          status: res.data.status,
          data: res.data,
        };
      }

      return { ok: false, error: `Status check failed with HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // Geri dönüş veb təklifləri — Kateqoriya 10 "PUBG WEB PURCHASE" botun dəqiq qiymətləri ilə məhsul ID-ləri
  public getFallbackWebOffers(): PlayPinOffer[] {
    return [
      { id: 38, title: '60 UC',   unit_price: 0.88,  stock: 0, category_id: 10, category_title: 'PUBG WEB PURCHASE' },
      { id: 37, title: '325 UC',  unit_price: 4.40,  stock: 0, category_id: 10, category_title: 'PUBG WEB PURCHASE' },
      { id: 36, title: '660 UC',  unit_price: 8.70,  stock: 0, category_id: 10, category_title: 'PUBG WEB PURCHASE' },
      { id: 35, title: '1800 UC', unit_price: 21.50, stock: 0, category_id: 10, category_title: 'PUBG WEB PURCHASE' },
      { id: 34, title: '3850 UC', unit_price: 42.50, stock: 0, category_id: 10, category_title: 'PUBG WEB PURCHASE' },
      { id: 33, title: '8100 UC', unit_price: 82.80, stock: 0, category_id: 10, category_title: 'PUBG WEB PURCHASE' },
    ];
  }

  async getOrders(): Promise<{ ok: boolean; orders: any[]; error?: string }> {
    try {
      if (!this.isConfigured()) {
        return { ok: false, orders: [], error: 'PlayPin API Key not configured' };
      }
      const res = await axios.get(`${this.baseUrl}/v1/orders`, {
        headers: this.getHeaders(),
        timeout: 10000,
        validateStatus: () => true,
      });
      if (res.status === 200 && Array.isArray(res.data)) {
        return { ok: true, orders: res.data };
      }
      return { ok: false, orders: [], error: `PlayPin HTTP ${res.status}` };
    } catch (err: any) {
      console.error('PlayPin getOrders error:', err.message);
      return { ok: false, orders: [], error: err.message };
    }
  }
}

export const playpinService = new PlayPinService();
