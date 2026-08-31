import { createPayment, getPaymentById, getPaymentByReference, updatePaymentStatus, updateUserBalance, getOrCreateUser } from '../database/db.js';
import { notificationService } from './notification.service.js';
import { settingsService } from './settings.service.js';
import { binanceService } from './binance.service.js';

class PaymentService {
  // Kripto Ödənişi (Binance Pay / USDT TRC20 / USDT BEP20) Sifariş ID / TxID təqdimatını emal et
  async processCryptoPay(
    telegramId: string | number,
    orderId: string,
    amountAzn: number = 0,
    amountUsd: number = 0,
    method: 'binance' | 'usdt_trc20' | 'usdt_bep20' = 'binance'
  ): Promise<{
    ok: boolean;
    autoApproved?: boolean;
    amountAzn?: number;
    newBalance?: number;
    error?: string;
  }> {
    const cleanOrderId = orderId.trim();
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(cleanOrderId)) {
      return {
        ok: false,
        error: '⚠️ Yanlış Əməliyyat Kodu (TxID / Hash) formatı! Zəhmət olmasa düzgün TxID daxil edin.'
      };
    }

    // Dublikatı yoxla
    const existing = getPaymentByReference(cleanOrderId);
    if (existing) {
      return {
        ok: false,
        error: '⚠️ Bu Əməliyyat Kodu (TxID) artıq sistemdə istifadə edilib və ya qeydə alınıb!'
      };
    }

    const user = getOrCreateUser(telegramId);
    const prefix = method === 'usdt_trc20' ? 'TRC' : (method === 'usdt_bep20' ? 'BEP' : 'BIN');
    const paymentId = `${prefix}-${Date.now().toString().slice(-6)}`;

    // 1. Binance API vasitəsilə 100% avtomatik təsdiqlə (Həm Binance Pay, həm də On-Chain TRC20/BEP20)!
    if (binanceService.isConfigured()) {
      const verifyRes = await binanceService.verifyCryptoTransaction(cleanOrderId, method, amountUsd);
      if (!verifyRes.verified) {
        return {
          ok: false,
          error: verifyRes.error || '⚠️ Binance hesabında bu ödəniş tapılmadı. Zəhmət olmasa düzgün TxID daxil etdiyinizdən əmin olun.',
        };
      }

      // Binance tərəfindən uğurla təsdiqləndi! Balansı avtomatik artır
      const actualUsd = verifyRes.amountUsd || amountUsd;
      const rate = settingsService.getUsdAznRate();
      const finalAzn = amountAzn > 0 ? amountAzn : actualUsd * rate;

      createPayment({
        id: paymentId,
        userId: user.id,
        telegramId: telegramId.toString(),
        method: method,
        amountAzn: finalAzn,
        amountUsd: actualUsd,
        referenceId: cleanOrderId,
        status: 'approved',
      });

      const updatedBalance = updateUserBalance(telegramId, finalAzn);

      await notificationService.notifyUserPaymentApproved(telegramId, finalAzn, updatedBalance);

      return {
        ok: true,
        autoApproved: true,
        amountAzn: finalAzn,
        newBalance: updatedBalance,
      };
    }

    return {
      ok: false,
      error: '⚠️ Binance API sistemi hazırda aktiv deyil. Zəhmət olmasa dəstək ilə əlaqə saxlayın.',
    };
  }

  // Köhnə uyğunluq üçün alias (ad)
  async processBinancePay(
    telegramId: string | number,
    orderId: string,
    amountAzn: number = 0,
    amountUsd: number = 0
  ) {
    return this.processCryptoPay(telegramId, orderId, amountAzn, amountUsd, 'binance');
  }

  // M10 və ya Kart Qəbzinin təqdimatını emal et
  async submitManualReceipt(params: {
    telegramId: string | number;
    username?: string;
    firstName?: string;
    method: 'm10' | 'card';
    receiptPath: string;
    amountAzn?: number;
  }): Promise<{ ok: boolean; paymentId: string }> {
    const user = getOrCreateUser(params.telegramId, params.username, params.firstName);
    const paymentId = `REC-${Date.now().toString().slice(-6)}`;

    const payment = createPayment({
      id: paymentId,
      userId: user.id,
      telegramId: params.telegramId.toString(),
      method: params.method,
      amountAzn: params.amountAzn || 0,
      receiptPath: params.receiptPath,
      status: 'pending',
    });

    // Telegram və Webhook vasitəsilə Adminə bildir
    await notificationService.notifyAdminNewReceipt({
      id: paymentId,
      telegramId: params.telegramId.toString(),
      username: params.username,
      firstName: params.firstName,
      method: params.method,
      amountAzn: params.amountAzn,
      receiptPath: params.receiptPath,
    });

    return { ok: true, paymentId };
  }

  // Admin ödəniş qəbzini təsdiqləyir
  async approveReceipt(paymentId: string, amountAzn: number, adminNote?: string): Promise<{ ok: boolean; error?: string }> {
    const payment = getPaymentById(paymentId);
    if (!payment) {
      return { ok: false, error: 'Ödəniş qeydi tapılmadı.' };
    }

    if (payment.status !== 'pending') {
      return { ok: false, error: `Bu qəbz artıq ${payment.status === 'approved' ? 'təsdiq edilib' : 'imtina edilib'}.` };
    }

    updatePaymentStatus(paymentId, 'approved', adminNote || `Admin təsdiqlədi: ${amountAzn} AZN`);
    const newBalance = updateUserBalance(payment.telegram_id, amountAzn);

    await notificationService.notifyUserPaymentApproved(payment.telegram_id, amountAzn, newBalance);
    return { ok: true };
  }

  // Admin ödəniş qəbzini rədd edir
  async rejectReceipt(paymentId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
    const payment = getPaymentById(paymentId);
    if (!payment) {
      return { ok: false, error: 'Ödəniş qeydi tapılmadı.' };
    }

    if (payment.status !== 'pending') {
      return { ok: false, error: `Bu qəbz artıq ${payment.status === 'approved' ? 'təsdiq edilib' : 'imtina edilib'}.` };
    }

    updatePaymentStatus(paymentId, 'rejected', reason || 'Admin imtina etdi');
    await notificationService.notifyUserPaymentRejected(payment.telegram_id, reason);
    return { ok: true };
  }
}

export const paymentService = new PaymentService();
