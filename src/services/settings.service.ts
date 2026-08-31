import { getSetting, setSetting, getAllSettings } from '../database/db.js';
import { config } from '../config/config.js';

class SettingsService {
  getUsdAznRate(): number {
    const val = getSetting('usd_azn_rate', config.payment.defaultUsdAznRate.toString());
    return parseFloat(val) || config.payment.defaultUsdAznRate;
  }

  getMarginPercent(): number {
    const val = getSetting('margin_percent', config.payment.defaultMarginPercent.toString());
    return parseFloat(val) || config.payment.defaultMarginPercent;
  }

  getBinancePayId(): string {
    return getSetting('binance_pay_id', config.payment.binancePayId);
  }

  getUsdtTrc20Address(): string {
    return getSetting('usdt_trc20_address', 'TYDzsYVoWv6GzE1uY8v6Y4zE1uY8v6Y4zE');
  }

  setUsdtTrc20Address(addr: string): void {
    setSetting('usdt_trc20_address', addr);
  }

  getUsdtBep20Address(): string {
    return getSetting('usdt_bep20_address', '0x71C83638379321eaf875fA642533F9C7D4f2B709');
  }

  setUsdtBep20Address(addr: string): void {
    setSetting('usdt_bep20_address', addr);
  }

  getBotUsername(): string {
    return getSetting('bot_username', config.botUsername);
  }

  getAdminPassword(): string {
    return getSetting('admin_password', config.adminPassword);
  }

  setAdminPassword(newPass: string): void {
    setSetting('admin_password', newPass);
  }

  // Ağıllı Mütərəqqi Bazar Marjası ilə USD dəyərindən AZN ilə satış qiymətini hesablayın
  calculateAznPrice(priceUsd: number | string): number {
    const numUsd = typeof priceUsd === 'string' ? parseFloat(priceUsd) : priceUsd;
    if (isNaN(numUsd) || numUsd <= 0) return 0;

    const rate = this.getUsdAznRate();
    const baseMargin = this.getMarginPercent(); // Standart 10%
    const baseAzn = numUsd * rate;

    let effectiveMargin = baseMargin;

    if (baseAzn <= 2.50) {
      // Mikro paketlər (məs. 60 UC, maya dəyəri ~1.51 AZN): Sabit marja (~+0.15 AZN)
      effectiveMargin = Math.max(baseMargin, 10);
      const calculated = baseAzn * (1 + effectiveMargin / 100);
      return Math.max(Math.ceil(calculated * 100) / 100, Math.ceil((baseAzn + 0.15) * 100) / 100);
    } else if (baseAzn <= 10.00) {
      // Kiçik paketlər (məs. 325 UC, maya dəyəri ~7.54 AZN): ~6.5% marja (~+0.49 AZN qazanc)
      effectiveMargin = baseMargin * 0.65;
      const calculated = baseAzn * (1 + effectiveMargin / 100);
      return Math.ceil(calculated * 100) / 100;
    } else if (baseAzn <= 25.00) {
      // Orta paketlər (məs. 660 UC, maya dəyəri ~15.08 AZN): ~5.5% marja (~+0.83 AZN qazanc)
      effectiveMargin = baseMargin * 0.55;
      const calculated = baseAzn * (1 + effectiveMargin / 100);
      return Math.ceil(calculated * 100) / 100;
    } else if (baseAzn <= 50.00) {
      // Böyük paketlər (məs. 1800 UC, maya dəyəri ~37.70 AZN): ~4.5% marja (~+1.70 AZN qazanc)
      effectiveMargin = baseMargin * 0.45;
      const calculated = baseAzn * (1 + effectiveMargin / 100);
      return Math.ceil(calculated * 100) / 100;
    } else {
      // Nəhəng paketlər (məs. 3850 UC & 8100 UC, maya dəyəri ~75 AZN & 150 AZN): ~3.5% marja (~+2.65 AZN & +5.25 AZN qazanc)
      effectiveMargin = baseMargin * 0.35;
      const calculated = baseAzn * (1 + effectiveMargin / 100);
      return Math.ceil(calculated * 100) / 100;
    }
  }

  getLogChannelId(): string {
    return getSetting('log_channel_id', config.logChannelId || '');
  }

  setLogChannelId(channelId: string): void {
    setSetting('log_channel_id', channelId.trim());
  }

  updateSettings(newSettings: Record<string, string>) {
    for (const [key, value] of Object.entries(newSettings)) {
      setSetting(key, value);
    }
  }

  getAll() {
    return {
      usd_azn_rate: this.getUsdAznRate(),
      margin_percent: this.getMarginPercent(),
      binance_pay_id: this.getBinancePayId(),
      usdt_trc20_address: this.getUsdtTrc20Address(),
      usdt_bep20_address: this.getUsdtBep20Address(),
      bot_username: this.getBotUsername(),
      log_channel_id: this.getLogChannelId(),
    };
  }
}

export const settingsService = new SettingsService();
