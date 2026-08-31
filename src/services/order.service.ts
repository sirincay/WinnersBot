import { createOrder, updateOrderStatus, updateUserBalance, deductUserBalanceAtomic, getOrCreateUser, getCustomOfferPrice, getProcessingWebOrders } from '../database/db.js';
import { fazerCardsService } from './fazercards.service.js';
import { playpinService } from './playpin.service.js';
import { notificationService } from './notification.service.js';
import { settingsService } from './settings.service.js';
import { loggerService } from './logger.service.js';

class OrderService {
  async processTopupOrder(params: {
    telegramId: string | number;
    categoryId: string;
    categoryName: string;
    offerId: string;
    offerName: string;
    priceUsd: number;
    playerId: string;
    additionalFields?: Record<string, any>;
  }): Promise<{
    ok: boolean;
    orderId?: string;
    error?: string;
    fazerOrderId?: string;
  }> {
    const user = getOrCreateUser(params.telegramId);
    const custom = getCustomOfferPrice(params.categoryId, params.offerId);
    const priceAzn = custom && typeof custom.custom_price_azn === 'number' && custom.custom_price_azn > 0
      ? custom.custom_price_azn
      : settingsService.calculateAznPrice(params.priceUsd);

    // Atomar şərti balans çıxılması (Race conditions və ikiqat xərcləmənin qarşısını alır - DB-02 Fix)
    const deducted = deductUserBalanceAtomic(params.telegramId, priceAzn);
    if (!deducted) {
      return {
        ok: false,
        error: `⚠️ Balansınız kifayət etmir və ya başqa bir əməliyyat icra olunur! Tələb olunan: <b>${priceAzn.toFixed(2)} ₼</b>, Cari balansınız: <b>${user.balance.toFixed(2)} ₼</b>.\nZəhmət olmasa əvvəlcə balansınızı artırın.`
      };
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;

    // DB-də gözləyən sifariş yarat
    createOrder({
      id: orderId,
      userId: user.id,
      telegramId: params.telegramId.toString(),
      productType: 'topup',
      categoryId: params.categoryId,
      categoryName: params.categoryName,
      offerId: params.offerId,
      offerName: params.offerName,
      playerId: params.playerId,
      additionalFields: params.additionalFields,
      priceUsd: params.priceUsd,
      priceAzn: priceAzn,
      status: 'pending',
    });

    const isPlaypinWeb = params.categoryId === 'pubg_mobile_web';

    try {
      // 1. PUBG Mobile Web Purchase-dirsə -> Birbaşa PlayPin API-yə yönləndir (Manual Sifariş Növbəsi)
      if (isPlaypinWeb) {
        const playpinRes = await playpinService.purchasePubgWebOffer(params.offerId, params.playerId);
        if (playpinRes.success) {
          // PlayPin operator növbəsində olarkən status 'processing' (emal edilir) olur
          updateOrderStatus(orderId, 'processing', playpinRes.order_id?.toString(), JSON.stringify(playpinRes));
          await notificationService.notifyUserWebPurchaseAccepted(params.telegramId, {
            orderId,
            offerName: params.offerName,
            categoryName: params.categoryName,
            playerId: params.playerId,
            priceAzn,
            playpinOrderId: playpinRes.order_id,
          });

          return {
            ok: true,
            orderId,
            fazerOrderId: playpinRes.order_id?.toString(),
          };
        } else {
          // Uğursuz olduqda geri qaytar
          updateUserBalance(params.telegramId, priceAzn);
          updateOrderStatus(orderId, 'failed', undefined, JSON.stringify(playpinRes));

          await notificationService.notifyUserOrderCancelled(params.telegramId, {
            orderId,
            offerName: params.offerName,
            categoryName: params.categoryName,
            playerId: params.playerId,
            priceAzn,
            reason: playpinRes.error || 'Təchizatçı sifarişi qəbul etmədi'
          });

          return {
            ok: false,
            error: playpinRes.error || 'PUBG Mobile Web Purchase sifarişi tamamlanmadı. Məbləğ balansınıza qaytarıldı.'
          };
        }
      }

      // 2. PUBG Mobile Avto ID (FazerCards) və Bütün Digər Oyunlar -> FazerCards API-yə yönləndir
      const fieldsPayload: Record<string, any> = {
        player_id: params.playerId,
        ...(params.additionalFields || {}),
      };

      const fazerCategory = params.categoryId === 'pubg_mobile_auto' ? 'pubg_mobile_auto' : params.categoryId;
      const fazerRes = await fazerCardsService.createTopupOrder(fazerCategory, params.offerId, fieldsPayload);

      if (fazerRes.ok) {
        updateOrderStatus(orderId, 'completed', fazerRes.order_id, JSON.stringify(fazerRes));
        await notificationService.notifyUserOrderCompleted(params.telegramId, {
          orderId,
          offerName: params.offerName,
          categoryName: params.categoryName,
          playerId: params.playerId,
        });

        // 🔔 Adminə Bildiriş Göndər
        notificationService.notifyAdminNewOrder({
          orderId,
          telegramId: params.telegramId,
          username: user.username,
          firstName: user.first_name,
          productType: 'topup',
          categoryName: params.categoryName,
          offerName: params.offerName,
          playerId: params.playerId,
          priceAzn,
          isSandbox: false,
          source: 'bot',
        }).catch(() => {});

        return {
          ok: true,
          orderId,
          fazerOrderId: fazerRes.order_id,
        };
      } else {
        // Uğursuz olduqda balansı geri qaytar
        updateUserBalance(params.telegramId, priceAzn);
        updateOrderStatus(orderId, 'failed', undefined, JSON.stringify(fazerRes));

        const errDetail = fazerRes.error || fazerRes.message || 'Təchizatçı xətası';
        const isStockErr = errDetail.toLowerCase().includes('stock') || errDetail.toLowerCase().includes('inventory') || errDetail.toLowerCase().includes('tükən') || errDetail.toLowerCase().includes('bitib');

        if (isStockErr) {
          notificationService.sendProviderOutOfStockAlert(params.offerName, 'FazerCards', errDetail).catch(() => {});
        }

        const userErrMsg = isStockErr
          ? `⚠️ Təchizatçının anbarında <b>${params.offerName}</b> paketi müvəqqəti tükənib. Məbləğ 100% balansınıza qaytarıldı.`
          : (fazerRes.error || fazerRes.message || 'Sifariş tamamlanarkən xəta baş verdi. Məbləğ balansınıza qaytarıldı.');

        await notificationService.notifyUserOrderFailed(params.telegramId, {
          offerName: params.offerName,
          priceAzn,
          reason: userErrMsg
        });

        return {
          ok: false,
          error: userErrMsg
        };
      }
    } catch (err: any) {
      loggerService.sendErrorAlert('TopupOrderNetworkFailure', err, {
        orderId,
        telegramId: params.telegramId,
        category: params.categoryId,
        offer: params.offerName,
      });

      // Şəbəkə xətasında balansı geri qaytar
      updateUserBalance(params.telegramId, priceAzn);
      updateOrderStatus(orderId, 'failed', undefined, err.message);

      await notificationService.notifyUserOrderFailed(params.telegramId, {
        offerName: params.offerName,
        priceAzn,
        reason: 'Sistem bağlantı xətası'
      });

      return {
        ok: false,
        error: 'Sistem bağlantı xətası baş verdi. Məbləğ balansınıza geri qaytarıldı.'
      };
    }
  }

  async processGiftcardOrder(params: {
    telegramId: string | number;
    categoryId: string;
    categoryName: string;
    offerId: string;
    offerName: string;
    priceUsd: number;
    count?: number;
  }): Promise<{
    ok: boolean;
    orderId?: string;
    cards?: Array<{ code: string; pin?: string }>;
    error?: string;
  }> {
    const user = getOrCreateUser(params.telegramId);
    const count = params.count || 1;
    const custom = getCustomOfferPrice(params.categoryId, params.offerId);
    const unitPriceAzn = custom && typeof custom.custom_price_azn === 'number' && custom.custom_price_azn > 0
      ? custom.custom_price_azn
      : settingsService.calculateAznPrice(params.priceUsd);
    const priceAzn = unitPriceAzn * count;

    // Atomar şərti balans çıxılması (Race conditions və ikiqat xərcləmənin qarşısını alır - DB-02 Fix)
    const deducted = deductUserBalanceAtomic(params.telegramId, priceAzn);
    if (!deducted) {
      return {
        ok: false,
        error: `⚠️ Balansınız kifayət etmir və ya başqa bir əməliyyat icra olunur! Tələb olunan: <b>${priceAzn.toFixed(2)} ₼</b>, Cari balansınız: <b>${user.balance.toFixed(2)} ₼</b>.\nZəhmət olmasa balansınızı artırın.`
      };
    }

    const orderId = `GC-${Date.now().toString().slice(-6)}`;

    createOrder({
      id: orderId,
      userId: user.id,
      telegramId: params.telegramId.toString(),
      productType: 'giftcard',
      categoryId: params.categoryId,
      categoryName: params.categoryName,
      offerId: params.offerId,
      offerName: params.offerName,
      priceUsd: params.priceUsd * count,
      priceAzn: priceAzn,
      status: 'pending',
    });

    const isPlaypinEpin = params.categoryId === 'pubg_mobile_epin' || params.categoryId === 'pubg_mobile';

    try {
      // 1. Əgər PUBG Mobile E-Pin-dirsə -> Birbaşa PlayPin API-yə yönləndir
      if (isPlaypinEpin) {
        // Alışdan öncə real vaxt stok qoruyucusu: balansı çıxmazdan ƏVVƏL yoxla (Problem 1 düzəlişi)
        const stockCheck = await playpinService.getPubgCardVouchers();
        const targetProduct = stockCheck.products.find(p => p.id.toString() === params.offerId.toString());
        if (!targetProduct || (typeof targetProduct.stock === 'number' && targetProduct.stock <= 0)) {
          // Artıq çıxılmış balansı geri qaytar və ləğv et
          updateUserBalance(params.telegramId, priceAzn);
          updateOrderStatus(orderId, 'failed', undefined, 'Stock=0 at purchase time');
          return {
            ok: false,
            error: `⚠️ Seçilən ${params.offerName} paketi hazırda stokda mövcud deyil. Məbləğ balansınıza geri qaytarıldı. Başqa bir paket seçin və ya bir az sonra yenidən cəhd edin.`
          };
        }

        const playpinRes = await playpinService.purchasePubgCardVoucher(params.offerId, count);

        if (playpinRes.success) {
          const cards = (playpinRes.delivery_items || []).map(code => ({ code, pin: '' }));
          updateOrderStatus(orderId, 'completed', playpinRes.order_id?.toString(), JSON.stringify(playpinRes));
          await notificationService.notifyUserOrderCompleted(params.telegramId, {
            orderId,
            offerName: params.offerName,
            categoryName: params.categoryName,
            cards,
          });

          return {
            ok: true,
            orderId,
            cards,
          };
        } else {
          updateUserBalance(params.telegramId, priceAzn);
          updateOrderStatus(orderId, 'failed', undefined, JSON.stringify(playpinRes));

          await notificationService.notifyUserOrderFailed(params.telegramId, {
            offerName: params.offerName,
            priceAzn,
            reason: playpinRes.error || 'PlayPin E-Pin xətası'
          });

          return {
            ok: false,
            error: playpinRes.error || 'PUBG E-Pin sifarişi uğursuz oldu. Məbləğ balansınıza qaytarıldı.'
          };
        }
      }

      // 2. Digər Hədiyyə Kartları -> FazerCards API-yə yönləndir
      const fazerRes = await fazerCardsService.createGiftcardOrder(params.categoryId, params.offerId, count);

      if (fazerRes.ok) {
        updateOrderStatus(orderId, 'completed', fazerRes.order_id, JSON.stringify(fazerRes));
        await notificationService.notifyUserOrderCompleted(params.telegramId, {
          orderId,
          offerName: params.offerName,
          categoryName: params.categoryName,
          cards: fazerRes.cards,
        });

        const delivered = (fazerRes.cards || []).map(c => c.code);

        // 🔔 Adminə Bildiriş Göndər
        notificationService.notifyAdminNewOrder({
          orderId,
          telegramId: params.telegramId,
          username: user.username,
          firstName: user.first_name,
          productType: 'giftcard',
          categoryName: params.categoryName,
          offerName: params.offerName,
          priceAzn,
          deliveredCodes: delivered,
          isSandbox: false,
          source: 'bot',
        }).catch(() => {});

        return {
          ok: true,
          orderId,
          cards: fazerRes.cards,
        };
      } else {
        updateUserBalance(params.telegramId, priceAzn);
        updateOrderStatus(orderId, 'failed', undefined, JSON.stringify(fazerRes));

        const errDetail = fazerRes.error || fazerRes.message || 'Təchizatçı xətası';
        const isStockErr = errDetail.toLowerCase().includes('stock') || errDetail.toLowerCase().includes('inventory') || errDetail.toLowerCase().includes('tükən') || errDetail.toLowerCase().includes('bitib');

        if (isStockErr) {
          notificationService.sendProviderOutOfStockAlert(params.offerName, 'FazerCards', errDetail).catch(() => {});
        }

        const userErrMsg = isStockErr
          ? `⚠️ Təchizatçının anbarında <b>${params.offerName}</b> kartı müvəqqəti tükənib. Məbləğ 100% balansınıza qaytarıldı.`
          : (fazerRes.error || fazerRes.message || 'Kart sifarişi uğursuz oldu. Məbləğ balansınıza qaytarıldı.');

        await notificationService.notifyUserOrderFailed(params.telegramId, {
          offerName: params.offerName,
          priceAzn,
          reason: userErrMsg
        });

        return {
          ok: false,
          error: userErrMsg
        };
      }
    } catch (err: any) {
      loggerService.sendErrorAlert('GiftcardOrderNetworkFailure', err, {
        orderId,
        telegramId: params.telegramId,
        category: params.categoryId,
        offer: params.offerName,
      });

      updateUserBalance(params.telegramId, priceAzn);
      updateOrderStatus(orderId, 'failed', undefined, err.message);

      await notificationService.notifyUserOrderFailed(params.telegramId, {
        offerName: params.offerName,
        priceAzn,
        reason: 'Sistem bağlantı xətası'
      });

      return {
        ok: false,
        error: 'Sistem bağlantı xətası baş verdi. Məbləğ balansınıza geri qaytarıldı.'
      };
    }
  }

  // Arxa plan izləyicisi: Web Purchase sifarişlərinin icrası üçün PlayPin statusunu yoxlayır və müştəriyə bildirir
  async checkProcessingWebOrders(): Promise<void> {
    try {
      const processingOrders = getProcessingWebOrders();
      if (!processingOrders || processingOrders.length === 0) return;

      for (const order of processingOrders) {
        const playpinOrderId = order.fazer_order_id;
        if (!playpinOrderId) continue;

        const res = await playpinService.getOrderStatus(playpinOrderId);
        if (res.ok && res.status) {
          const st = res.status.toUpperCase();
          if (st === 'COMPLETED' || st === 'SUCCESS') {
            updateOrderStatus(order.id, 'completed', playpinOrderId, JSON.stringify(res.data));
            await notificationService.notifyUserWebPurchaseCompleted(order.telegram_id, {
              orderId: order.id,
              offerName: order.offer_name,
              categoryName: order.category_name,
              playerId: order.player_id || '',
              priceAzn: order.price_azn,
              playpinOrderId: playpinOrderId,
            });
            console.log(`✅ [WebPurchase Poller] Sifariş #${playpinOrderId} (${order.id}) uğurla tamamlandı və müştəriyə bildiriş göndərildi.`);
          } else if (st === 'FAILED' || st === 'CANCELLED' || st === 'CANCELED' || st === 'REJECTED' || st === 'REFUND' || st === 'REFUNDED') {
            updateOrderStatus(order.id, 'failed', playpinOrderId, JSON.stringify(res.data));
            updateUserBalance(order.telegram_id, order.price_azn);
            const cancelNote = res.data?.comment || res.data?.cancel_reason || res.data?.reason || res.data?.error || '';
            await notificationService.notifyUserOrderCancelled(order.telegram_id, {
              orderId: order.id,
              offerName: order.offer_name,
              categoryName: order.category_name,
              playerId: order.player_id || '',
              priceAzn: order.price_azn,
              playpinOrderId: playpinOrderId,
              reason: cancelNote,
            });
            console.log(`❌ [WebPurchase Poller] Sifariş #${playpinOrderId} (${order.id}) ləğv edildi, məbləğ (${order.price_azn} AZN) müştəriyə geri qaytarıldı və ləğv bildirişi göndərildi.`);
          }
        }
      }
    } catch (err: any) {
      console.error('checkProcessingWebOrders error:', err.message);
    }
  }
}

export const orderService = new OrderService();

