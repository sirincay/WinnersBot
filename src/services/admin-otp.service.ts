import { notificationService, escapeTgHtml } from './notification.service.js';

interface AdminOtpState {
  code: string;
  expiresAt: number;
  attempts: number;
  lockedUntil?: number;
}

const otpStates: Map<string, AdminOtpState> = new Map();
const unauthorizedKeyAttempts: Map<string, number> = new Map();

export const adminOtpService = {
  async generateAndSendOtp(ip: string = 'unknown'): Promise<{ ok: boolean; message: string; error?: string }> {
    const state = otpStates.get(ip);
    if (state?.lockedUntil && Date.now() < state.lockedUntil) {
      const waitMin = Math.ceil((state.lockedUntil - Date.now()) / 60000);
      return {
        ok: false,
        error: `Təhlükəsizlik kilidi aktivdir! Zəhmət olmasa ${waitMin} dəqiqə sonra yenidən cəhd edin.`,
        message: ''
      };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStates.set(ip, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 dəqiqə
      attempts: 0,
    });

    const sent = await notificationService.sendAdminOtpMessage(code);
    if (!sent) {
      return {
        ok: true,
        message: 'Birdəfəlik 6 rəqəmli şifrə yaradıldı. Zəhmət olmasa Telegram botunuzu yoxlayın.',
      };
    }

    return {
      ok: true,
      message: 'Birdəfəlik 6 rəqəmli təhlükəsizlik şifrəsi rəsmi Telegram Admin hesabınıza göndərildi.',
    };
  },

  // Admin Veb Panelindən təqdim edilmiş OTP-ni təsdiqlə
  async verifyOtp(inputOtp: string, ip: string = 'unknown'): Promise<{ ok: boolean; error?: string; remainingAttempts?: number }> {
    const state = otpStates.get(ip);
    if (!state) {
      return { ok: false, error: 'Aktiv təhlükəsizlik şifrəsi tapılmadı. Zəhmət olmasa yeni şifrə tələb edin.' };
    }

    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      const waitMin = Math.ceil((state.lockedUntil - Date.now()) / 60000);
      return { ok: false, error: `Sistem kilidlənib. ${waitMin} dəqiqə sonra cəhd edin.` };
    }

    if (Date.now() > state.expiresAt) {
      otpStates.delete(ip);
      return { ok: false, error: 'Şifrənin etibarlılıq müddəti (5 dəqiqə) bitmişdir. Zəhmət olmasa yeni şifrə tələb edin.' };
    }

    if (inputOtp && inputOtp.trim() === state.code) {
      otpStates.delete(ip); // Tək istifadəlik OTP istifadə edildi
      return { ok: true };
    }

    state.attempts++;
    const remaining = 3 - state.attempts;

    if (state.attempts >= 3) {
      state.code = '';
      state.expiresAt = 0;
      state.lockedUntil = Date.now() + 10 * 60 * 1000; // 10 dəqiqə kilidləmə
      otpStates.set(ip, state);

      await notificationService.sendAdminSecurityAlert(
        `🚨 <b>TƏHLÜKƏSİZLİK XƏBƏRDARLIĞI!</b>\n\n` +
        `Admin panelində API açarlarını görmək üçün <b>3 dəfə ardıcıl yanlış OTP şifrəsi</b> daxil edildi.\n` +
        `Sistem (IP: ${ip}) təhlükəsizlik məqsədilə 10 dəqiqəlik kilidləndi.`
      );

      return {
        ok: false,
        error: '3 dəfə ardıcıl yanlış şifrə daxil edildi. Giriş 10 dəqiqəlik bloklandı.',
        remainingAttempts: 0
      };
    }

    otpStates.set(ip, state);
    return {
      ok: false,
      error: `Yanlış şifrə! Qalan cəhd sayı: ${remaining}`,
      remainingAttempts: remaining
    };
  },

  // Telegram Botunda admin olmayan icazəsiz cəhdləri qeyd et və idarə et
  recordUnauthorizedAttempt(telegramId: string | number, userLabel: string): { attempts: number; isBanned: boolean } {
    const tid = telegramId.toString();
    const cur = (unauthorizedKeyAttempts.get(tid) || 0) + 1;
    unauthorizedKeyAttempts.set(tid, cur);

    if (cur >= 3) {
      return { attempts: cur, isBanned: true };
    }
    return { attempts: cur, isBanned: false };
  }
};
