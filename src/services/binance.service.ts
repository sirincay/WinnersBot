import crypto from 'crypto';
import axios from 'axios';
import { config } from '../config/config.js';

interface BinancePayTx {
  orderId: string;
  transactionId?: string;
  transactionTime: number;
  amount: string;
  currency: string;
  fundsDetail?: Array<{ currency: string; amount: string }>;
}

interface BinanceDepositRecord {
  id: string;
  amount: string;
  coin: string;
  network: string;
  status: number; // 1 = uğurlu, 0 = gözləyir
  address: string;
  txId: string;
  insertTime: number;
}

class BinanceService {
  private baseUrl = 'https://api.binance.com';

  isConfigured(): boolean {
    const key = config.binance.apiKey || process.env.BINANCE_API_KEY || '';
    const secret = config.binance.apiSecret || process.env.BINANCE_API_SECRET || '';
    return !!(key && secret && key.length > 10 && secret.length > 10);
  }

  private generateSignature(queryString: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
  }

  /**
    * Binance Depozit Tarixçəsi API vasitəsilə on-chain blockchain depozitini (TRC20 / BEP20) təsdiqlə
   */
  async verifyDepositTransaction(txId: string, expectedAmountUsd?: number): Promise<{
    verified: boolean;
    amountUsd?: number;
    currency?: string;
    network?: string;
    transactionTime?: number;
    error?: string;
  }> {
    const apiKey = config.binance.apiKey || process.env.BINANCE_API_KEY || '';
    const apiSecret = config.binance.apiSecret || process.env.BINANCE_API_SECRET || '';

    if (!this.isConfigured()) {
      return { verified: false, error: 'BINANCE_API_NOT_CONFIGURED' };
    }

    try {
      const timestamp = Date.now();
      const params = new URLSearchParams({
        coin: 'USDT',
        status: '1', // 1 = Uğurlu
        timestamp: timestamp.toString(),
      });

      const signature = this.generateSignature(params.toString(), apiSecret);
      const url = `${this.baseUrl}/sapi/v1/capital/deposit/hisrec?${params.toString()}&signature=${signature}`;

      const response = await axios.get(url, {
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (Array.isArray(response.data)) {
        const deposits: BinanceDepositRecord[] = response.data;
        const targetClean = txId.trim().toLowerCase();

        const match = deposits.find(d => 
          (d.txId && d.txId.toLowerCase() === targetClean) ||
          (d.id && d.id.toLowerCase() === targetClean)
        );

        if (match) {
          const paidAmount = parseFloat(match.amount);
          if (expectedAmountUsd && expectedAmountUsd > 0) {
            if (paidAmount < expectedAmountUsd * 0.98) {
              return {
                verified: false,
                amountUsd: paidAmount,
                error: `⚠️ Ödənilən məbləğ (${paidAmount} USDT) seçilən məbləğdən (${expectedAmountUsd} USDT) azdır!`,
              };
            }
          }

          return {
            verified: true,
            amountUsd: paidAmount,
            currency: match.coin || 'USDT',
            network: match.network,
            transactionTime: match.insertTime,
          };
        }
      }

      return {
        verified: false,
        error: '⚠️ Bu Blokçeyn TxID kodu Binance depozitlərinizdə tapılmadı və ya hələ təsdiqlənməyib. Zəhmət olmasa 1 dəqiqə sonra yenidən cəhd edin.',
      };
    } catch (err: any) {
      console.error('Binance Deposit API Verification Error:', err.response?.data || err.message);
      return {
        verified: false,
        error: err.response?.data?.msg || 'Binance Deposit API ilə əlaqə xətası.',
      };
    }
  }

  /**
    * Gələn Binance Pay tranzaksiyasını Binance API vasitəsilə avtomatik təsdiqlə
   */
  async verifyPayTransaction(orderOrTxId: string, expectedAmountUsd?: number): Promise<{
    verified: boolean;
    amountUsd?: number;
    currency?: string;
    transactionTime?: number;
    raw?: any;
    error?: string;
  }> {
    const apiKey = config.binance.apiKey || process.env.BINANCE_API_KEY || '';
    const apiSecret = config.binance.apiSecret || process.env.BINANCE_API_SECRET || '';

    if (!this.isConfigured()) {
      return {
        verified: false,
        error: 'BINANCE_API_NOT_CONFIGURED',
      };
    }

    try {
      const timestamp = Date.now();
      const params = new URLSearchParams({
        timestamp: timestamp.toString(),
        limit: '100',
      });

      const signature = this.generateSignature(params.toString(), apiSecret);
      const url = `${this.baseUrl}/sapi/v1/pay/transactions?${params.toString()}&signature=${signature}`;

      const response = await axios.get(url, {
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.data && response.data.code === '000000' && Array.isArray(response.data.data)) {
        const txList: BinancePayTx[] = response.data.data;
        const targetClean = orderOrTxId.trim().toLowerCase();

        // Sifariş ID (orderId) və ya tranzaksiya ID-nə (transactionId) görə uyğunlaşdır
        const match = txList.find(tx => 
          (tx.orderId && tx.orderId.toLowerCase() === targetClean) ||
          (tx.transactionId && tx.transactionId.toLowerCase() === targetClean)
        );

        if (match) {
          const paidAmount = parseFloat(match.amount);
          if (expectedAmountUsd && expectedAmountUsd > 0) {
            if (paidAmount < expectedAmountUsd * 0.98) {
              return {
                verified: false,
                amountUsd: paidAmount,
                error: `⚠️ Ödənilən məbləğ (${paidAmount} USDT) seçilən məbləğdən (${expectedAmountUsd} USDT) azdır!`,
              };
            }
          }

          return {
            verified: true,
            amountUsd: paidAmount,
            currency: match.currency || 'USDT',
            transactionTime: match.transactionTime,
            raw: match,
          };
        }

        return {
          verified: false,
          error: '⚠️ Bu Sifariş ID-si Binance hesabınızda tapılmadı və ya hələ sistemə düşməyib. Zəhmət olmasa 1 dəqiqə sonra yenidən cəhd edin.',
        };
      }

      return {
        verified: false,
        error: response.data?.message || 'Binance API xətası baş verdi.',
      };
    } catch (err: any) {
      console.error('Binance Pay API Verification Error:', err.response?.data || err.message);
      return {
        verified: false,
        error: err.response?.data?.msg || 'Binance API ilə əlaqə qurularkən xəta baş verdi.',
      };
    }
  }

  /**
   * Vahid Kripto Təsdiqləyici: Həm Binance Pay, həm də On-Chain Depozitləri (TRC20/BEP20) yoxlayır
   */
  async verifyCryptoTransaction(
    code: string,
    method: 'binance' | 'usdt_trc20' | 'usdt_bep20' = 'binance',
    expectedAmountUsd?: number
  ): Promise<{
    verified: boolean;
    amountUsd?: number;
    currency?: string;
    error?: string;
  }> {
    if (method === 'usdt_trc20' || method === 'usdt_bep20') {
      const depRes = await this.verifyDepositTransaction(code, expectedAmountUsd);
      if (depRes.verified) return depRes;
      // İstifadəçi səhvən Pay ID yapışdırıbsa deyə geri dönüş kimi Pay API-ni yoxla
      const payRes = await this.verifyPayTransaction(code, expectedAmountUsd);
      if (payRes.verified) return payRes;
      return depRes;
    } else {
      const payRes = await this.verifyPayTransaction(code, expectedAmountUsd);
      if (payRes.verified) return payRes;
      // İstifadəçi blockchain TxID göndəribsə deyə geri dönüş kimi on-chain depozitini yoxla
      const depRes = await this.verifyDepositTransaction(code, expectedAmountUsd);
      if (depRes.verified) return depRes;
      return payRes;
    }
  }
}

export const binanceService = new BinanceService();
