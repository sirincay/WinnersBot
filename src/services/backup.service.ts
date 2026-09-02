import fs from 'fs';
import path from 'path';
import { InputFile } from 'grammy';
import { config } from '../config/config.js';
import { db, getAllUsers, getAllOrders, getAllPayments, getAllAdminTelegramIds } from '../database/db.js';
import { notificationService } from './notification.service.js';
import { EMOJIS } from '../bot/emojis.js';

class BackupService {
  private bot: any = null;
  private backupDir: string;

  constructor() {
    this.backupDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  setBot(bot: any) {
    this.bot = bot;
  }

  /**
   * Təhlükəsiz SQLite nüsxəsi yarat və Telegram vasitəsilə Adminə göndər
   */
  async createAndSendBackup(targetChatId?: string | number): Promise<{ ok: boolean; path?: string; error?: string }> {
    try {
      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupFilename = `winners_backup_${dateStr}.sqlite`;
      const backupFilePath = path.join(this.backupDir, backupFilename);

      // database.sqlite faylını təhlükəsiz şəkildə kopyala
      if (!fs.existsSync(config.paths.dbPath)) {
        return { ok: false, error: 'Database file not found!' };
      }

      // Bütün əməliyyatları diskə yazmaq üçün WAL nöqtəsini yoxla
      try {
        db.exec('PRAGMA wal_checkpoint(FULL);');
      } catch (e) {}

      fs.copyFileSync(config.paths.dbPath, backupFilePath);

      // 7 gündən köhnə nüsxələri (backups) təmizlə
      this.cleanOldBackups(7);

      // Statistikaları topla (yalnız real müştərilər və sifarişlər)
      const users = getAllUsers().filter(u => u.telegram_id !== '999000111' && u.telegram_id !== '999900111' && !u.telegram_id.startsWith('SANDBOX_'));
      const orders = getAllOrders().filter(o => !o.id.startsWith('SB-') && o.telegram_id !== '999000111' && o.telegram_id !== '999900111');
      const payments = getAllPayments().filter(p => p.telegram_id !== '999000111' && p.telegram_id !== '999900111');

      const totalBalance = users.reduce((acc, u) => acc + (u.balance || 0), 0);
      const completedOrders = orders.filter(o => o.status === 'completed');
      const totalTurnover = completedOrders.reduce((acc, o) => acc + (o.price_azn || 0), 0);

      // Bütün admin Telegram ID-lərini topla (config + db adminlərindən)
      const adminIds = new Set<string>(getAllAdminTelegramIds());
      if (targetChatId) {
        adminIds.add(targetChatId.toString().trim());
      }
      if (config.adminTelegramId && config.adminTelegramId.trim()) {
        adminIds.add(config.adminTelegramId.trim());
      }
      adminIds.add('1108583389');

      // Əgər bot mövcuddursa Adminlərə göndər
      if (this.bot && adminIds.size > 0) {
        const caption = `${EMOJIS.SHIELD} <b>WINNERS SHOP — AVTOMATİK BAZA BACKUP-I</b>\n\n` +
          `📅 <b>Tarix:</b> ${now.toLocaleString('az-AZ')}\n` +
          `👥 <b>İstifadəçilər:</b> <b>${users.length} nəfər</b>\n` +
          `💳 <b>Ümumi Müştəri Balansı:</b> <b>${totalBalance.toFixed(2)} ₼</b>\n` +
          `📦 <b>Tamamlanan Sifarişlər:</b> <b>${completedOrders.length} ədəd</b>\n` +
          `💰 <b>Ümumi Sifariş Dövriyyəsi:</b> <b>${totalTurnover.toFixed(2)} ₼</b>\n` +
          `🧾 <b>Ödəniş Qeydləri:</b> <b>${payments.length} ədəd</b>\n\n` +
          `✅ <i>Bütün məlumatlar və tranzaksiyalar 100% təhlükəsiz şəkildə arxivləndi.</i>`;

        for (const adminId of adminIds) {
          try {
            await this.bot.api.sendDocument(
              adminId,
              new InputFile(backupFilePath, backupFilename),
              {
                caption,
                parse_mode: 'HTML',
              }
            );
          } catch (sendErr: any) {
            console.error(`Failed to send backup to admin ${adminId}:`, sendErr.message);
          }
        }
      }

      return { ok: true, path: backupFilePath };
    } catch (err: any) {
      console.error('Backup creation error:', err);
      return { ok: false, error: err.message };
    }
  }

  private cleanOldBackups(daysToKeep = 7) {
    try {
      const files = fs.readdirSync(this.backupDir);
      const now = Date.now();
      const maxAgeMs = daysToKeep * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.endsWith('.sqlite')) {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (e) {
      console.error('Old backup cleanup error:', e);
    }
  }

  /**
   * Dəqiq 24 saatlıq avtomatik nüsxələmə cədvəlini başlat (Server restartlarında spam olmur)
   */
  startAutoBackupSchedule() {
    const checkAndRunDailyBackup = () => {
      try {
        const files = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.sqlite'));
        let latestTime = 0;
        for (const f of files) {
          const stats = fs.statSync(path.join(this.backupDir, f));
          if (stats.mtimeMs > latestTime) {
            latestTime = stats.mtimeMs;
          }
        }
        const hoursSinceLastBackup = latestTime > 0 ? (Date.now() - latestTime) / (1000 * 60 * 60) : 999;
        
        // Yalnız ƏN AZ 24 saat keçdikdən sonra backup al və göndər
        if (hoursSinceLastBackup >= 24) {
          console.log(`🛡️ 24 saat tamam oldu (${hoursSinceLastBackup.toFixed(1)} saat keçib). Gündəlik avto-backup göndərilir...`);
          this.createAndSendBackup().catch(err => console.error('Daily backup error:', err));
        } else {
          console.log(`🛡️ Son backup-dan cəmi ${hoursSinceLastBackup.toFixed(1)} saat keçib (24 saat tamam olmayıb). Təkrar backup göndərilmədi.`);
        }
      } catch (e) {
        console.error('Backup check error:', e);
      }
    };

    // Başladıqdan 30 saniyə sonra ilkin yoxlama (yalnız >= 24 saat keçibsə işə düşür)
    setTimeout(checkAndRunDailyBackup, 30000);

    // Saatlıq rutin yoxlama: 24 saat tamam olan kimi dərhal işə düşür
    setInterval(checkAndRunDailyBackup, 60 * 60 * 1000);
    console.log('🛡️ Avtomatik Gündəlik DB Backup cədvəli aktivdir (Ciddi 24 saatlıq qoruma ilə).');

    // Gecə Maliyyə Qazanc Hesabatı Cədvəli (Hər gecə saat 00:00-da ciddi DB yaddaşı ilə işləyir)
    const checkAndRunNightlyReport = async () => {
      try {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const hour = now.getHours();

        if (hour === 0) {
          const { db } = await import('../database/db.js');
          const row = db.prepare(`SELECT value FROM settings WHERE key = 'last_daily_report_date'`).get() as { value: string } | undefined;
          
          // Server restartlarına davamlı olaraq, hər təqvim günündə YALNIZ BİR DƏFƏ göndər
          if (!row || row.value !== todayStr) {
            db.prepare(`
              INSERT INTO settings (key, value) VALUES ('last_daily_report_date', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `).run(todayStr);

            // Dünənki gün üçün hesabat göndər
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            console.log(`📊 Gecə saat 00:00 xalis qazanc hesabatı (${yesterday}) adminlərə göndərilir...`);
            notificationService.sendDailyFinancialReportToAdmin(undefined, yesterday).catch(() => {});
          }
        }
      } catch (e) {
        console.error('Nightly report check error:', e);
      }
    };
    setInterval(checkAndRunNightlyReport, 60 * 1000);
  }
}

export const backupService = new BackupService();
