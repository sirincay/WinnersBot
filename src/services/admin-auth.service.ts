import crypto from 'crypto';
import { settingsService } from './settings.service.js';
import { saveAdminSession, isAdminSessionValid, deleteAdminSession, clearAllAdminSessions } from '../database/db.js';

class AdminAuthService {
  private failedAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();
  private readonly SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCK_TIME_MS = 60 * 1000; // 60 saniyə bloklanma

  private safeCompare(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a || '', 'utf8');
      const bufB = Buffer.from(b || '', 'utf8');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  public login(password: string, ip: string = 'unknown'): { ok: boolean; token?: string; error?: string } {
    const now = Date.now();
    const tracker = this.failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };

    // Brute force (kobud güc) bloklanmasını yoxla
    if (tracker.lockedUntil > now) {
      const waitSeconds = Math.ceil((tracker.lockedUntil - now) / 1000);
      return {
        ok: false,
        error: `Çox sayda uğursuz cəhd! Sistem müvəqqəti bloklanıb. Zəhmət olmasa ${waitSeconds} saniyə gözləyin.`
      };
    }

    const currentPass = settingsService.getAdminPassword();
    if (!password || !this.safeCompare(password, currentPass)) {
      tracker.count += 1;
      if (tracker.count >= this.MAX_FAILED_ATTEMPTS) {
        tracker.lockedUntil = now + this.LOCK_TIME_MS;
        tracker.count = 0;
        this.failedAttempts.set(ip, tracker);
        return {
          ok: false,
          error: 'Təhlükəsizlik şifrəsi yalnışdır! 5 uğursuz cəhddən sonra sistem 60 saniyə müvəqqəti bloklandı.'
        };
      }
      this.failedAttempts.set(ip, tracker);
      return {
        ok: false,
        error: `Təhlükəsizlik şifrəsi yalnışdır! (Qalan cəhd: ${this.MAX_FAILED_ATTEMPTS - tracker.count})`
      };
    }

    // Uğurlu: Uğursuz cəhdləri sıfırla
    this.failedAttempts.delete(ip);

    // Təhlükəsiz sessiya tokeni yarat və SQLite-da saxla
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = now + this.SESSION_DURATION_MS;
    saveAdminSession(token, expiresAt);

    return {
      ok: true,
      token,
    };
  }

  public verifyToken(token?: string): boolean {
    if (!token) return false;
    return isAdminSessionValid(token);
  }

  public logout(token?: string): void {
    if (token) {
      deleteAdminSession(token);
    }
  }

  public changePassword(oldPassword: string, newPassword: string): { ok: boolean; error?: string } {
    const currentPass = settingsService.getAdminPassword();
    if (!oldPassword || !this.safeCompare(oldPassword, currentPass)) {
      return { ok: false, error: 'Mövcud şifrə yalnışdır!' };
    }

    if (!newPassword || newPassword.trim().length < 6) {
      return { ok: false, error: 'Yeni şifrə ən azı 6 simvoldan ibarət olmalıdır!' };
    }

    settingsService.setAdminPassword(newPassword.trim());
    // Yeni şifrə ilə yenidən daxil olmağa məcbur etmək üçün bütün aktiv sessiyaları təmizlə
    clearAllAdminSessions();

    return { ok: true };
  }
}

export const adminAuthService = new AdminAuthService();
