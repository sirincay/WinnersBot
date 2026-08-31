import { fazerCardsService } from './fazercards.service.js';
import { playpinService } from './playpin.service.js';
import { settingsService } from './settings.service.js';
import { notificationService } from './notification.service.js';
import { getOrCreateUser, createExternalOrderWithDate } from '../database/db.js';

class UpstreamSyncService {
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  public startAutoSync(intervalMinutes: number = 2) {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    // İlkin sinxronizasiya
    this.syncAllUpstreamOrders().catch(() => {});
    // Təkrarlanan sinxronizasiya
    this.syncTimer = setInterval(() => {
      this.syncAllUpstreamOrders().catch(() => {});
    }, intervalMinutes * 60 * 1000);
  }

  public async syncAllUpstreamOrders(): Promise<{ ok: boolean; syncedFazer: number; syncedPlaypin: number; total: number; error?: string }> {
    if (this.isSyncing) {
      return { ok: true, syncedFazer: 0, syncedPlaypin: 0, total: 0 };
    }
    this.isSyncing = true;

    let syncedFazer = 0;
    let syncedPlaypin = 0;

    try {
      // 1. Təchizatçı İstifadəçilərinin mövcudluğundan əmin ol
      const fazerUser = getOrCreateUser('PROVIDER_FAZER', 'fazercards_api', 'FazerCards Provider');
      const playpinUser = getOrCreateUser('PROVIDER_PLAYPIN', 'playpin_api', 'PlayPin Provider');

      // Təchizatçı balanslarını yoxla və < $1.00 olduqda aşağı balans xəbərdarlığı göndər (24 saatda bir dəfə)
      try {
        const fBal = await fazerCardsService.getBalance();
        const fNum = parseFloat(fBal.balance || '0');
        if (fBal.ok && fNum < 1.00) {
          notificationService.sendLowProviderBalanceAlert('FazerCards', fNum, 1.00).catch(() => {});
        }
      } catch (e) {}

      try {
        const pMe = await playpinService.getMe();
        if (pMe.ok && pMe.data) {
          const pNum = pMe.data.balance;
          if (pNum < 1.00) {
            notificationService.sendLowProviderBalanceAlert('PlayPin', pNum, 1.00).catch(() => {});
          }
        }
      } catch (e) {}

      // 2. FazerCards Sifarişlərini Sinxronlaşdır
      try {
        const fRes = await fazerCardsService.getOrders();
        if (fRes.ok && Array.isArray(fRes.items)) {
          for (const item of fRes.items) {
            const rawId = (item.id || '').toString();
            const orderId = rawId.startsWith('ord-') ? `FC-${rawId.slice(4).toUpperCase()}` : (rawId.startsWith('FC-') ? rawId : `FC-${rawId.toUpperCase()}`);
            const priceUsd = parseFloat(item.total_usd || '0.8863');
            const priceAzn = settingsService.calculateAznPrice(priceUsd);
            
            let status = 'completed';
            const sLower = (item.status || '').toLowerCase();
            if (sLower === 'refund' || sLower === 'failed' || sLower === 'canceled') {
              status = 'failed';
            } else if (sLower === 'processing' || sLower === 'pending') {
              status = 'processing';
            }

            let createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
            if (item.created_at) {
              try {
                createdAt = new Date(item.created_at).toISOString().replace('T', ' ').slice(0, 19);
              } catch (e) {}
            }

            // 27 Avqust 2026-cı ildən əvvəlki sifarişləri ciddi şəkildə filtrlə (nəzərə alma)
            if (createdAt < '2026-08-27 00:00:00') {
              continue;
            }

            const inserted = createExternalOrderWithDate({
              id: orderId,
              userId: fazerUser.id,
              telegramId: 'PROVIDER_FAZER',
              productType: item.kind || 'topup',
              categoryId: item.category_id || 'pubg_mobile_auto',
              categoryName: item.category_name || 'PUBG Mobile (Auto)',
              offerId: item.offer_id || 'unknown',
              offerName: item.offer_name || item.title || 'PUBG Mobile UC',
              playerId: item.fields?.player_id || null,
              additionalFields: item.fields,
              priceUsd,
              priceAzn,
              status,
              fazerOrderId: item.id,
              fazerResponse: JSON.stringify(item),
              createdAt
            });

            if (inserted) syncedFazer++;
          }
        }
      } catch (fErr: any) {
        console.error('UpstreamSync: FazerCards sync error:', fErr.message);
      }

      // 3. PlayPin Sifarişlərini Sinxronlaşdır (Ciddi şəkildə 27 Avqustdan etibarən: ID >= 194000)
      try {
        const pRes = await playpinService.getOrders();
        if (pRes.ok && Array.isArray(pRes.orders)) {
          for (const item of pRes.orders) {
            const numId = parseInt(String(item.id || 0), 10);
            // 27 Avqustdan əvvəlki tarixi sifarişləri ciddi şəkildə nəzərə alma
            if (numId < 194000) {
              continue;
            }

            const orderId = `PP-${item.id}`;
            const priceUsd = parseFloat(item.total_price || item.unit_price || '0.88');
            const priceAzn = settingsService.calculateAznPrice(priceUsd);

            let status = 'completed';
            const sLower = (item.status || '').toLowerCase();
            if (sLower === 'canceled' || sLower === 'failed' || sLower === 'refund') {
              status = 'failed';
            } else if (sLower === 'processing' || sLower === 'pending') {
              status = 'processing';
            }

            let createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
            if (item.created_at) {
              try {
                createdAt = new Date(item.created_at).toISOString().replace('T', ' ').slice(0, 19);
              } catch (e) {}
            } else {
              if (numId >= 195000) {
                createdAt = '2026-08-29 14:00:00';
              } else if (numId >= 194750) {
                createdAt = '2026-08-28 16:30:00';
              } else {
                createdAt = '2026-08-27 18:00:00';
              }
            }

            if (createdAt < '2026-08-27 00:00:00') {
              continue;
            }

            const title = (item.product_title || '').toLowerCase();
            const rawValue = (item.values || '').trim();
            const isNumericPlayerId = /^\d{5,15}$/.test(rawValue);

            let categoryId = 'pubg_mobile_web';
            let categoryName = 'PUBG Mobile (Operator Manual)';
            let productType = 'topup';
            let playerId: string | null = null;
            const additionalFields: any = { quantity: item.quantity, comment: item.comment };

            if (title.includes('stockable') || title.includes('epin') || title.includes('voucher') || (!isNumericPlayerId && rawValue.length > 0)) {
              categoryId = 'pubg_mobile_epin';
              categoryName = 'PUBG Mobile (E-Pin Voucher)';
              productType ='giftcard';
              playerId = null;
              additionalFields.voucher_codes = rawValue;
            } else {
              categoryId = 'pubg_mobile_web';
              categoryName = 'PUBG Mobile (Operator Manual)';
              productType = 'topup';
              playerId = rawValue || null;
            }

            const inserted = createExternalOrderWithDate({
              id: orderId,
              userId: playpinUser.id,
              telegramId: 'PROVIDER_PLAYPIN',
              productType,
              categoryId,
              categoryName,
              offerId: String(item.product_id || item.id),
              offerName: item.product_title || 'PUBG Mobile UC',
              playerId,
              additionalFields,
              priceUsd,
              priceAzn,
              status,
              fazerOrderId: String(item.id),
              fazerResponse: JSON.stringify(item),
              createdAt
            });

            if (inserted) syncedPlaypin++;
          }
        }
      } catch (pErr: any) {
        console.error('UpstreamSync: PlayPin sync error:', pErr.message);
      }

      return {
        ok: true,
        syncedFazer,
        syncedPlaypin,
        total: syncedFazer + syncedPlaypin
      };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const upstreamSyncService = new UpstreamSyncService();
