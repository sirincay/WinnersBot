import { Bot } from 'grammy';
import { config } from '../config/config.js';
import { settingsService } from './settings.service.js';
import { escapeTgHtml } from './notification.service.js';

export type SecurityAlertType = 
  | 'BRUTE_FORCE'
  | 'DDOS_BURST'
  | 'IP_BAN'
  | 'AUTH_FAILURE'
  | 'API_ABUSE'
  | 'SUSPICIOUS_PAYLOAD'
  | 'UNAUTHORIZED_ADMIN_ACCESS'
  | 'HONEYPOT_SCANNER'
  | 'SQLI_XSS_ATTACK'
  | 'PATH_TRAVERSAL';

class LoggerService {
  private bot: Bot | null = null;
  private recentErrorTimes: Map<string, number> = new Map();
  private recentSecurityAlertTimes: Map<string, number> = new Map();

  setBot(botInstance: Bot) {
    this.bot = botInstance;
  }

  getLogTarget(): string {
    const fromSettings = settingsService.getLogChannelId();
    if (fromSettings && fromSettings.trim()) {
      return fromSettings.trim();
    }
    return config.logChannelId ? config.logChannelId.trim() : '';
  }

  // Yerli Bakı / Azərbaycan vaxt möhürü (timestamp) formatı
  private getTimestamp(): string {
    const now = new Date();
    return now.toLocaleString('az-AZ', {
      timeZone: 'Asia/Baku',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  /**
   * Sistem xətasını, runtime istisnasını, bot xətasını və ya poller uğursuzluğunu Log Kanalına göndər
   */
  async sendErrorAlert(source: string, error: any, context?: Record<string, any>) {
    if (!this.bot) return;
    const target = this.getLogTarget();
    if (!target) return; // Kanal hələ konfiqurasiya edilməyib

    const errorMsg = (error?.message || error?.toString() || 'Bilinməyən xəta').toString();
    const errorStack = (error?.stack || '').toString();

    // Dublikat açarı (xəta təkrarlananda kanala spam göndərilməsinin qarşısını almaq üçün)
    const dedupKey = `${source}:${errorMsg.slice(0, 80)}`;
    const now = Date.now();
    const lastTime = this.recentErrorTimes.get(dedupKey) || 0;
    if (now - lastTime < 2 * 60 * 1000) {
      // 2 dəqiqə ərzində təkrarlanan xətanı gizlət
      return;
    }
    this.recentErrorTimes.set(dedupKey, now);

    // Stack trace parçasını formatla (maks. 400 simvol)
    let stackSnippet = '';
    if (errorStack) {
      const lines = errorStack.split('\n').slice(0, 6).join('\n');
      stackSnippet = lines.length > 500 ? lines.slice(0, 500) + '...' : lines;
    }

    let ctxStr = '';
    if (context && Object.keys(context).length > 0) {
      ctxStr = '\n📋 <b>Əlaqəli Məlumatlar (Context):</b>\n';
      for (const [k, v] of Object.entries(context)) {
        ctxStr += `• <b>${escapeTgHtml(k)}:</b> <code>${escapeTgHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</code>\n`;
      }
    }

    const text =
      `🚨 <b>SİSTEM XƏTASI / BUG HESABATI</b>\n\n` +
      `📌 <b>Mənbə (Source):</b> <code>${escapeTgHtml(source)}</code>\n` +
      `💥 <b>Xəta Mesajı:</b> <code>${escapeTgHtml(errorMsg)}</code>\n` +
      `${ctxStr}` +
      `🕒 <b>Tarix / Saat:</b> <code>${this.getTimestamp()}</code>\n` +
      (stackSnippet ? `\n📂 <b>Stack Trace:</b>\n<pre>${escapeTgHtml(stackSnippet)}</pre>` : '');

    try {
      await this.bot.api.sendMessage(target, text, { parse_mode: 'HTML' });
    } catch (e: any) {
      console.error(`[LoggerService] Loq kanalına (${target}) göndərmə xətası:`, e.message);
    }
  }

  /**
    * Təhlükəsizlik xəbərdarlıqları göndər: brute force şifrə cəhdləri, DDoS / Rate-Limit yığılmaları, IP Qadağaları, API sui-istifadə, Honeypotlar
   */
  async sendSecurityAlert(type: SecurityAlertType, data: {
    ip: string;
    endpoint?: string;
    userAgent?: string;
    reason?: string;
    count?: number;
    details?: any;
    actionTaken?: string;
  }) {
    if (!this.bot) return;
    const target = this.getLogTarget();
    if (!target) return;

    // IP və növ üzrə dublikat açarı (eyni IP-dən eyni hücum üçün hər 30 saniyədə maks 1 xəbərdarlıq)
    const dedupKey = `${type}:${data.ip}:${data.endpoint || ''}`;
    const now = Date.now();
    const lastTime = this.recentSecurityAlertTimes.get(dedupKey) || 0;
    if (now - lastTime < 30 * 1000) {
      return;
    }
    this.recentSecurityAlertTimes.set(dedupKey, now);

    let typeTitle = 'Təhlükəsizlik Təhdidi';
    let actionTaken = data.actionTaken || 'Sorğu bloklandı və qeydə alındı';

    switch (type) {
      case 'UNAUTHORIZED_ADMIN_ACCESS':
        typeTitle = '🕵️ İcazəsiz Admin Panelinə Giriş Cəhdi';
        actionTaken = data.actionTaken || 'Giriş qapalı saxlanıldı (Admin Gate göstərildi)';
        break;
      case 'HONEYPOT_SCANNER':
        typeTitle = '🚨 Zərərli Bot / Zəiflik Skaneri Tələsi (Honeypot)';
        actionTaken = data.actionTaken || 'Sorğu bloklandı və IP nəzarətə alındı';
        break;
      case 'SQLI_XSS_ATTACK':
        typeTitle = '💉 SQL Injection / XSS Hücum Cəhdi';
        actionTaken = data.actionTaken || '403 Forbidden ilə dərhal kəsildi';
        break;
      case 'PATH_TRAVERSAL':
        typeTitle = '📁 Directory / Path Traversal Cəhdi';
        actionTaken = data.actionTaken || 'Giriş qadağan edildi';
        break;
      case 'BRUTE_FORCE':
        typeTitle = '🔑 Şifrə Təxmini (Brute-Force Hücumu)';
        actionTaken = data.actionTaken || 'Giriş bloklandı & IP Ban siyahısına əlavə olundu';
        break;
      case 'DDOS_BURST':
        typeTitle = '⚡ Şübhəli Sorğu Axını / DDoS Burst Cəhdi';
        actionTaken = data.actionTaken || 'Rate-Limit (429) tətbiq edildi';
        break;
      case 'IP_BAN':
        typeTitle = '⛔ Bloklanmış IP-dən Giriş Cəhdi';
        actionTaken = 'Giriş 403 Forbidden ilə dərhal kəsildi';
        break;
      case 'AUTH_FAILURE':
        typeTitle = '🚫 İcazəsiz Admin Əməliyyat Cəhdi';
        actionTaken = '401 Unauthorized qaytarıldı';
        break;
      case 'API_ABUSE':
        typeTitle = '⚠️ Reseller API Qeyri-Qanuni İstifadə Cəhdi';
        actionTaken = 'API açarı tələb olundu / Sorğu rədd edildi';
        break;
      case 'SUSPICIOUS_PAYLOAD':
        typeTitle = '🛡️ Zərərli / Şübhəli Payload Cəhdi';
        actionTaken = 'Payload təmizləndi və rədd edildi';
        break;
    }

    let extraDetails = '';
    if (data.details) {
      extraDetails = `\n🔍 <b>Detallar:</b> <code>${escapeTgHtml(typeof data.details === 'object' ? JSON.stringify(data.details).slice(0, 300) : String(data.details))}</code>\n`;
    }

    const text =
      `🛡️ <b>TƏHLÜKƏSİZLİK XƏBƏRDARLIĞI (SECURITY ALERT)</b>\n\n` +
      `⚠️ <b>Təhdid Növü:</b> <b>${typeTitle}</b>\n` +
      `🌐 <b>IP Ünvanı:</b> <code>${escapeTgHtml(data.ip || 'Unknown IP')}</code>\n` +
      (data.endpoint ? `🎯 <b>Hədəf Endpoint:</b> <code>${escapeTgHtml(data.endpoint)}</code>\n` : '') +
      (data.count ? `🔢 <b>Ardıcıl Cəhd Sayı:</b> <b>${data.count}</b>\n` : '') +
      `🛑 <b>Görülən Tədbir:</b> <b>${escapeTgHtml(actionTaken)}</b>\n` +
      (data.reason ? `📝 <b>Səbəb / Qeyd:</b> <i>${escapeTgHtml(data.reason)}</i>\n` : '') +
      (data.userAgent ? `📱 <b>User-Agent:</b> <code>${escapeTgHtml(data.userAgent.slice(0, 100))}</code>\n` : '') +
      `${extraDetails}` +
      `🕒 <b>Tarix / Saat:</b> <code>${this.getTimestamp()}</code>`;

    try {
      await this.bot.api.sendMessage(target, text, { parse_mode: 'HTML' });
    } catch (e: any) {
      console.error(`[LoggerService] Təhlükəsizlik xəbərdarlığı göndərmə xətası:`, e.message);
    }
  }

  /**
   * Botun hədəf kanala yaza bildiyini yoxlamaq üçün canlı test mesajı göndər
   */
  async sendTestMessage(targetChannelId?: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.bot) {
      return { ok: false, error: 'Telegram botu hazırda aktiv deyil.' };
    }
    const target = targetChannelId ? targetChannelId.trim() : this.getLogTarget();
    if (!target) {
      return { ok: false, error: 'Loq kanalı ID-si təyin edilməyib.' };
    }

    const text =
      `🧪 <b>WINNERS SHOP — LOQ KANALI TEST BİLDİRİŞİ</b>\n\n` +
      `✅ <b>Əlaqə Uğurludur!</b>\n` +
      `🤖 Bot bu kanala administrator hüququ ilə qoşulub.\n` +
      `🛡️ <i>Bundan sonra botdakı bütün xətalar, ilişmələr, sayta olan şifrə cəhdləri və DDoS hücum xəbərdarlıqları anında bu kanala göndəriləcəkdir.</i>\n\n` +
      `🕒 <b>Tarix:</b> <code>${this.getTimestamp()}</code>`;

    try {
      await this.bot.api.sendMessage(target, text, { parse_mode: 'HTML' });
      return { ok: true };
    } catch (e: any) {
      return {
        ok: false,
        error: `Kanala mesaj göndərilə bilmədi: ${e.message}. Zəhmət olmasa botu (@${settingsService.getBotUsername()}) həmin kanala ƏLAVƏ EDİB ADMİN (Post Messages) səlahiyyəti verin.`
      };
    }
  }
}

export const loggerService = new LoggerService();
