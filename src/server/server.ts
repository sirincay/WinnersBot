import express from 'express';
import fs from 'fs';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { config } from '../config/config.js';
import {
  getOrCreateUser,
  getUserById,
  findUserByIdentifier,
  getAllUsers,
  getAllUsersWithStats,
  setUserBalanceDirect,
  setUserRole,
  getUserOrders,
  getAllOrders,
  getPendingPayments,
  getPaymentById,
  getStats,
  getBotSpecificStats,
  updateUserBalance,
  createAuthSession,
  getAuthSessionByCode,
  confirmAuthSession,
  getRatingStats,
  getRecentReviews,
  getAllCustomCategories,
  getCustomCategoryById,
  createCustomCategory,
  toggleCustomCategory,
  deleteCustomCategory,
  getAllCustomProducts,
  getCustomProductsByCategory,
  getCustomProductById,
  createCustomProduct,
  deleteCustomProduct,
  addStockCodes,
  getAvailableStockCount,
  getAllActiveApiCategories,
  getAllApiCategories,
  getSegmentCounts,
  getApiCategory,
  addOrUpdateApiCategory,
  toggleApiCategory,
  deleteApiCategory,
  getCustomPricingForCategory,
  getAllCustomPricing,
  getCustomOfferPrice,
  setCustomOfferPrice,
  getSetting,
  setSetting,
  blockUser,
  unblockUser,
  deleteUserCompletely,
  isUserBlocked,
  updateUserLastIp,
  addBannedIp,
  removeBannedIp,
  isIpBanned,
  getAllBannedIps,
  getUserComprehensiveDetails,
  saveUserSession,
  getUserSession,
  deleteUserSession,
  saveAdminSession,
  isUserAdmin,
  createApiKey,
  getUserApiKeys,
  revokeApiKey,
  getAllApiKeysWithUser,
  toggleApiKeyStatus,
  db
} from '../database/db.js';
import crypto from 'crypto';
import { fazerCardsService } from '../services/fazercards.service.js';
import { playpinService } from '../services/playpin.service.js';
import { settingsService } from '../services/settings.service.js';
import { paymentService } from '../services/payment.service.js';
import { orderService } from '../services/order.service.js';
import { notificationService } from '../services/notification.service.js';
import { adminAuthService } from '../services/admin-auth.service.js';
import { apiGatewayService } from '../services/api-gateway.service.js';
import { adminOtpService } from '../services/admin-otp.service.js';
import { upstreamSyncService } from '../services/upstream-sync.service.js';
import { loggerService } from '../services/logger.service.js';

// Ciddi MIME və İkili Bayt Yoxlayıcısı
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export function validateImageMagicBytes(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // JPEG: 0xFF 0xD8 0xFF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return true;
    }
    // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return true;
    }
    // WebP: RIFF (baytlar 0-3) və WEBP (baytlar 8-11)
    if (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return true;
    }

    return false;
  } catch (err) {
    return false;
  }
}

// Qəbzlər üçün ciddi MIME növ filtri ilə təhlükəsiz fayl yükləməni qur
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.paths.uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (ALLOWED_MIME_TYPES.includes(mime) && ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Təhlükəsizlik xətası: Yalnız JPG, PNG və WEBP formatında qəbz şəkilləri yüklənə bilər!'));
    }
  }
});

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ---------------- @HUSNUTECH CUSTOM SIGNATURE HEADER ----------------
  app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'Express');
    res.setHeader('X-Engineered-By', '@HUSNUTECH');
    next();
  });

  // Qlobal IP Qadağası Tətbiqi və IP Həlledici
  const getClientIp = (req: express.Request): string => {
    const rawIp = (req.headers['cf-connecting-ip'] as string) || 
                  (req.headers['x-real-ip'] as string) || 
                  (req.headers['x-forwarded-for'] as string) || 
                  req.socket.remoteAddress || 
                  req.ip || '';
    return rawIp.split(',')[0].trim().replace(/^::ffff:/, '');
  };

  // Cookie Təhlili Köməkçisi
  const parseCookies = (req: express.Request): Record<string, string> => {
    const list: Record<string, string> = {};
    const rc = req.headers.cookie;
    if (rc) {
      rc.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const key = parts.shift()?.trim();
        if (key) {
          list[key] = decodeURIComponent(parts.join('='));
        }
      });
    }
    return list;
  };

  // İstifadəçi Tokeni Təsdiq Köməkçisi (VULN-01 & VULN-02 Fix: IDOR və icazəsiz balans xərcləməsinin qarşısını alır)
  function getValidatedUserTgId(req: express.Request): string {
    const cookies = parseCookies(req);
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ((req.headers['x-user-token'] as string) || cookies['user_token'] || '').trim();

    if (token) {
      const session = getUserSession(token);
      if (session && session.telegram_id && session.expires_at > Date.now()) {
        return session.telegram_id;
      }
    }
    return '';
  }

  // Sorğu göndərən istifadəçinin Telegram profil məlumatlarını (Ad, Tağ, ID, Balans) çıxaran köməkçi
  function getRequestUser(req: express.Request): { telegramId: string; username?: string | null; firstName?: string | null; balance?: number } | null {
    const tgId = getValidatedUserTgId(req);
    if (tgId) {
      const user = getUserById(tgId);
      if (user) {
        return {
          telegramId: user.telegram_id,
          username: user.username,
          firstName: user.first_name,
          balance: user.balance
        };
      }
      return { telegramId: tgId };
    }
    const cookies = parseCookies(req);
    const queryTgId = (req.query?.telegram_id || req.query?.tg_id || req.headers['x-telegram-id'] || cookies['tg_id'] || cookies['telegram_id']) as string;
    if (queryTgId && typeof queryTgId === 'string' && /^\d{5,15}$/.test(queryTgId.trim())) {
      const user = getUserById(queryTgId.trim());
      if (user) {
        return {
          telegramId: user.telegram_id,
          username: user.username,
          firstName: user.first_name,
          balance: user.balance
        };
      }
    }
    return null;
  }

  // Yaddaşdaxili Sürüşən Pəncərə Sürət İzləyicisi və IP başına DDoS / Yığılma Monitoru
  interface IpRateData {
    count: number;
    firstSeen: number;
    lastAlert: number;
  }
  const ipRateMap = new Map<string, IpRateData>();
  const RATE_WINDOW_MS = 60 * 1000; // 1 minute
  const RATE_LIMIT_BURST = 140; // 140 requests/minute for non-static assets

  // ARCH-03 Fix: Yaddaş sızmasının və RAM DoS-un qarşısını almaq üçün köhnə IP-ləri hər 10 dəqiqədən bir təmizlə
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipRateMap.entries()) {
      if (now - data.firstSeen > RATE_WINDOW_MS && now - data.lastAlert > 60 * 1000) {
        ipRateMap.delete(ip);
      }
    }
  }, 10 * 60 * 1000).unref();

  app.use((req, res, next) => {
    // Statik faylları nəzərə alma (skip)
    const p = req.path.toLowerCase();
    if (p.startsWith('/uploads') || p.endsWith('.css') || p.endsWith('.js') || p.endsWith('.png') || p.endsWith('.jpg') || p.endsWith('.webp') || p.endsWith('.svg') || p.endsWith('.ico')) {
      return next();
    }

    const cleanIp = getClientIp(req);
    if (!cleanIp) return next();

    const now = Date.now();
    const rateData = ipRateMap.get(cleanIp) || { count: 0, firstSeen: now, lastAlert: 0 };

    if (now - rateData.firstSeen > RATE_WINDOW_MS) {
      rateData.count = 1;
      rateData.firstSeen = now;
    } else {
      rateData.count++;
    }

    ipRateMap.set(cleanIp, rateData);

    // Sorğu yığılması təhlükəsizlik limitini aşarsa -> Log kanalına DDoS xəbərdarlığı göndər və rədd et
    if (rateData.count > RATE_LIMIT_BURST) {
      if (now - rateData.lastAlert > 60 * 1000) {
        rateData.lastAlert = now;
        loggerService.sendSecurityAlert('DDOS_BURST', {
          ip: cleanIp,
          endpoint: req.originalUrl || req.path,
          count: rateData.count,
          userAgent: req.headers['user-agent'] as string,
          user: getRequestUser(req),
          reason: `1 dəqiqədə ${rateData.count} intensiv sorğu göndərildi (DDoS / Bot axını təhlükəsi)`
        });
      }

      return res.status(429).json({
        ok: false,
        error: 'Həddindən artıq çox sorğu göndərildi (Too Many Requests). Zəhmət olmasa bir qədər sonra yenidən cəhd edin.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    next();
  });

  // Qlobal IP Qadağa Tutucusu
  app.use((req, res, next) => {
    const cleanIp = getClientIp(req);
    if (cleanIp && isIpBanned(cleanIp)) {
      loggerService.sendSecurityAlert('IP_BAN', {
        ip: cleanIp,
        endpoint: req.originalUrl || req.path,
        user: getRequestUser(req),
        reason: 'Bloklanmış IP vebsayta və ya API-yə girişə cəhd etdi'
      });

      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          ok: false,
          error: `Girişiniz IP ünvanınıza (${cleanIp}) görə bloklanmışdır. Müraciət: @HusnuTech`
        });
      }
      return res.status(403).send(`
        <!DOCTYPE html>
        <html lang="az">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>403 — Giriş Məhdudlaşdırılıb</title>
          <style>
            body { background: #0b0f19; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .ban-box { background: #1e293b; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 16px; padding: 36px 28px; max-width: 480px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
            .ban-icon { width: 56px; height: 56px; background: rgba(239, 68, 68, 0.15); color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 18px auto; border: 1px solid rgba(239, 68, 68, 0.3); }
            h1 { color: #f87171; font-size: 22px; margin: 0 0 12px 0; font-weight: 800; letter-spacing: -0.5px; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
            .ip-tag { background: #0f172a; color: #38bdf8; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 13px; border: 1px solid #334155; display: inline-block; margin-bottom: 20px; }
            .btn-contact { display: inline-block; background: #0284c7; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; transition: background 0.2s; }
            .btn-contact:hover { background: #0369a1; }
          </style>
        </head>
        <body>
          <div class="ban-box">
            <div class="ban-icon">⛔</div>
            <h1>GİRİŞ MƏHDUDLAŞDIRILIB</h1>
            <p>Sistem təhlükəsizliyi qaydalarına əsasən sizin IP ünvanınızdan sayta və xidmətlərə giriş qadağan edilmişdir.</p>
            <div class="ip-tag">Bloklanan IP: ${cleanIp}</div>
            <div>
              <a href="https://t.me/HusnuTech" target="_blank" class="btn-contact">💬 Admin ilə Əlaqə Saxla (@HusnuTech)</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
    next();
  });

  // Avtomatik İstifadəçi Real Vaxt IP İzləmə Ara Proqramı
  app.use((req, res, next) => {
    const clientIp = getClientIp(req);
    const candidateId = req.headers['x-telegram-id'] || 
                        req.query.telegram_id || 
                        (req.body && (req.body.telegram_id || req.body.user_id));
    if (candidateId && clientIp) {
      try {
        updateUserLastIp(candidateId.toString().trim(), clientIp);
      } catch (e) {}
    }
    next();
  });

  // Daxil olan HTTP sorğusunun səlahiyyətli Admin tərəfindən edildiyini yoxlayan köməkçi (ARCH-04 Fix)
  const isRequestAuthorizedAdmin = (req: express.Request): boolean => {
    const cookies = parseCookies(req);
    const authHeader = req.headers.authorization;
    let bearerToken = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7).trim();
    }

    const adminToken = cookies['admin_token'] || bearerToken || (req.headers['x-admin-token'] as string);
    if (adminToken && adminAuthService.verifyToken(adminToken)) {
      return true;
    }

    return false;
  };

  // ---------------- HONEYPOT VƏ SIZMA RADARI ----------------
  
  // Botlar və avtomatlaşdırılmış skanerlər tərəfindən tez-tez yoxlanılan yüksək riskli Honeypot regex nümunələri
  const HONEYPOT_PATTERNS = [
    // Məxfi & Ətraf mühit / Git / SVN / Konfiqurasiya faylları
    /^\/\.env(\..*)?$/i,
    /^\/\.git(\/.*)?$/i,
    /^\/\.svn(\/.*)?$/i,
    /^\/\.aws(\/.*)?$/i,
    /^\/\.ssh(\/.*)?$/i,
    /^\/\.ds_store$/i,
    /^\/\.htaccess$/i,
    /^\/web\.config$/i,
    /^\/config\.(json|js|yml|yaml|ini|php|bak)$/i,
    /^\/settings\.(json|js|php)$/i,
    /^\/database\.(sqlite|db|sql)$/i,
    /^\/(backup|dump|db|database|schema)\.(sql|tar|zip|gz|rar|bak)$/i,

    // Verilənlər bazası veb alətləri
    /^\/(phpmyadmin|pma|myadmin|adminer|adminer\.php|sqladmin|mysqladmin|dbadmin)(\/.*)?$/i,

    // Veb Shell və Arxa Qapılar (Backdoors)
    /^\/(shell|cmd|wso|alfa|c99|r57|b374k|eval-stdin|upload|uploader|up)\.(php|asp|aspx|jsp|cgi)$/i,
    /^\/cgi-bin(\/.*)?$/i,

    // CMS və Freymvork Boşluqları (Exploits)
    /^\/(wp-admin|wp-login\.php|wp-content|wp-includes|xmlrpc\.php)(\/.*)?$/i,
    /^\/(joomla|administrator|typo3|bitrix|manager\/html|invoker\/JMXInvokerServlet)(\/.*)?$/i,
    /^\/(solr|autodiscover|remote\/login|telescope|_profiler|debug\/pprof)(\/.*)?$/i,

    // Aktuatorlar və Swagger API Zibillikləri
    /^\/actuator(\/.*)?$/i,
    /^\/(swagger-ui|api-docs|v[1-3]\/api-docs)(\/.*)?$/i,
  ];

  // SQL Enjeksiyon, Path Traversal və XSS Nümunələri
  const MALICIOUS_INJECTION_PATTERN = /(\.\.[\/\\]|union\s+select|information_schema|waitfor\s+delay|<script|javascript:|etc\/passwd|windows\/win\.ini)/i;

  // Yaddaşdaxili Skaner Sorğu Pozuntu İzləyicisi (IP -> pozuntular)
  interface ScannerOffense {
    count: number;
    firstSeen: number;
    lastSeen: number;
    probes: string[];
  }
  const honeypotOffenseMap = new Map<string, ScannerOffense>();

  // Honeypot və Hücum Səthi Tutucu Ara Proqramı
  app.use((req, res, next) => {
    const rawPath = req.path || '';
    const fullUrl = req.originalUrl || '';
    const cleanIp = getClientIp(req);

    // 1. URL və ya Sorğu sətirində Path Traversal və ya Enjeksiyon yoxla
    if (MALICIOUS_INJECTION_PATTERN.test(fullUrl) || MALICIOUS_INJECTION_PATTERN.test(JSON.stringify(req.query || {}))) {
      loggerService.sendSecurityAlert('SQLI_XSS_ATTACK', {
        ip: cleanIp,
        endpoint: fullUrl,
        userAgent: req.headers['user-agent'] as string,
        user: getRequestUser(req),
        reason: 'Şübhəli SQL Injection, XSS və ya Path Traversal payload-u aşkarlandı',
        details: { url: fullUrl, query: req.query }
      });

      if (cleanIp && cleanIp !== '127.0.0.1' && cleanIp !== '::1') {
        addBannedIp(cleanIp, `Avtomatik Ban: Zərərli Injection / Path Traversal hücumu (${fullUrl.slice(0, 100)})`);
      }
      return res.status(403).json({ ok: false, error: 'Forbidden: Malicious payload detected.' });
    }

    // 2. Honeypot skaner sorğularını yoxla
    const isHoneypotHit = HONEYPOT_PATTERNS.some(pattern => pattern.test(rawPath));
    if (isHoneypotHit) {
      const now = Date.now();
      const offense = honeypotOffenseMap.get(cleanIp) || { count: 0, firstSeen: now, lastSeen: now, probes: [] };
      offense.count++;
      offense.lastSeen = now;
      if (!offense.probes.includes(rawPath)) {
        offense.probes.push(rawPath);
      }
      honeypotOffenseMap.set(cleanIp, offense);

      // Telegram Log Kanalına xəbərdarlıq göndər
      loggerService.sendSecurityAlert('HONEYPOT_SCANNER', {
        ip: cleanIp,
        endpoint: fullUrl,
        count: offense.count,
        userAgent: req.headers['user-agent'] as string,
        user: getRequestUser(req),
        reason: `Hacker/Bot tərəfindən həssas fayl/zəiflik axtarışı: ${rawPath}`,
        details: { method: req.method, totalProbes: offense.probes }
      });

      // Əgər skaner 2 və ya daha çox həssas honeypot hədəfinə dəyərsə avtomatik blokla
      if (offense.count >= 2 && cleanIp && cleanIp !== '127.0.0.1' && cleanIp !== '::1') {
        addBannedIp(cleanIp, `Avtomatik Ban: Honeypot / Zəiflik Skaneri (${offense.probes.slice(0, 3).join(', ')})`);
        loggerService.sendSecurityAlert('IP_BAN', {
          ip: cleanIp,
          endpoint: fullUrl,
          count: offense.count,
          user: getRequestUser(req),
          reason: `Ardıcıl ${offense.count} həssas tələyə düşdüyü üçün IP avtomatik Ban edildi`
        });
      }

      return res.status(404).send('Not Found');
    }

    next();
  });

  // 🛡️ Qorunan Admin Panel Marşrutu — Server Səviyyəsində Qoruma və Şifrə Giriş Qapısı
  app.get(['/admin.html', '/admin', '/admin-panel', '/panel-admin'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    // 1. Əgər admin_token ilə artıq avtorizasiya olunubsa -> admin.html aç
    const isAuth = isRequestAuthorizedAdmin(req);
    if (isAuth) {
      return res.sendFile(path.resolve(process.cwd(), 'src', 'views', 'admin.html'));
    }

    // 2. Yoxla: İstifadəçi sayta Telegram ilə daxil olubmu və Admin hüququ varmı?
    const userTgId = getValidatedUserTgId(req);
    const isSiteAdmin = userTgId ? isUserAdmin(userTgId) : false;

    if (isSiteAdmin) {
      // Saytda Admin kimi daxil olubsa -> Şifrə Təsdiq Qapısını (admin-gate.html) göstər
      return res.sendFile(path.resolve(process.cwd(), 'src', 'views', 'admin-gate.html'));
    }

    // 3. Əgər istifadəçi sayta daxil olmayıbsa və ya Admin hüququ yoxdursa -> Loq kanalına bildiriş göndər və əsas səhifəyə yönləndir
    const cleanIp = getClientIp(req);
    const reqUser = getRequestUser(req);
    const userDisplayName = reqUser?.firstName || (reqUser?.username ? `@${reqUser.username}` : (userTgId ? `ID: ${userTgId}` : 'Anonim'));

    loggerService.sendSecurityAlert('UNAUTHORIZED_ADMIN_ACCESS', {
      ip: cleanIp,
      endpoint: req.path || '/admin',
      userAgent: (req.headers['user-agent'] as string) || 'Bilinməyən Brauzer',
      user: reqUser,
      reason: userTgId 
        ? `Saytda daxil olmuş adi istifadəçi (${userDisplayName}) veb admin panelinə (${req.path}) cəhd etdi`
        : `Sayta daxil olmamış anonim istifadəçi veb admin panelinə (${req.path}) cəhd etdi`,
      actionTaken: 'Giriş bloklandı və əsas səhifəyə yönləndirildi'
    });

    return res.redirect('/');
  });

  // Statik fayllar
  app.use(express.static(path.resolve(process.cwd(), 'public')));
  // Humans.txt - Qlobal Developer İmza Standartı
  app.get('/humans.txt', (req, res) => {
    res.type('text/plain').send(`   |\\  |\\                                                              /|  /|   
   | \\ | \\  +-------------------------------------------------------+  / | / |   
   |  \\|  \\ |   *                                               *   | /  |/  |   
   |   |   \\|       _   _ _   _ ____  _   _ _   _               |/   |   |   
   |   |   ||      | | | | | | / ___|| \\ | | | | |              ||   |   |   
   |   |   ||      | |_| | | | \\___ \\|  \\| | | | |              ||   |   |   
   |   |   ||      |  _  | |_| |___) | |\\  | |_| |              ||   |   |   
   |   |   ||      |_| |_|\\___/|____/|_| \\_|\\___/               ||   |   |   
   |   |   ||                                                       ||   |   |   
   |   |   ||                    @ H U S N U T E C H                ||   |   |   
   |   |   ||                                                       ||   |   |   
   |   |   ||     SENIOR FULL-STACK & TELEGRAM BOT DEVELOPER        ||   |   |   
   |   |   ||                                                       ||   |   |   
   |   |   ||       Telegram: @HusnuTech  •  WhatsApp: +994 77 211 70 11  ||   |   |   
   |   |   ||   *                                               *   ||   |   |   
   |   |   |+-------------------------------------------------------+|   |   |   
   |  /|  /                                                           \\  |\\  |   
   | / | /  =========================================================  \\ | \\ |   
   |/  |/                                                               \\|  \\|   
          ( )   ( )   ( )      ( )   ( )   ( )      ( )   ( )   ( )            
         [===] [===] [===]    [===] [===] [===]    [===] [===] [===]           
         /| |\\ /| |\\ /| |\\    /| |\\ /| |\\ /| |\\    /| |\\ /| |\\ /| |\\           
`);
  });

  // Security.txt - Qlobal Təhlükəsizlik və Mühəndis Standartı
  app.get(['/.well-known/security.txt', '/security.txt'], (req, res) => {
    const host = req.headers.host || 'winners.pro';
    res.type('text/plain').send(`Contact: https://t.me/HusnuTech
Contact: https://wa.me/994772117011
Canonical: https://${host}/.well-known/security.txt
Acknowledgments: Core Platform Architecture & Systems Engineered by @HUSNUTECH (https://t.me/HusnuTech)
Hiring: For custom enterprise web and Telegram bot systems contact @HusnuTech`);
  });

  // API Health & Version Monitor
  app.get(['/api/health', '/api/version'], (req, res) => {
    res.json({
      ok: true,
      status: 'operational',
      engine: 'Winners Global Enterprise Core v3.5.0',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      architect: {
        developer: '@HUSNUTECH',
        telegram: 'https://t.me/HusnuTech',
        whatsapp: '+994 77 211 70 11'
      }
    });
  });

  // Portal Əlavə Adları (Aliases)
  app.get(['/dashboard', '/profile', '/portal', '/cabinet'], (req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'public', 'dashboard.html'));
  });

  // ---------------- İCTİMAİ / MAĞAZA API ----------------

  // İstifadəçi autentifikasiyasını tamamlamaq köməkçisi (VULN-01 Fix: adminToken yalnız /api/admin/auth/login vasitəsilə verilir)
  const handleUserAuthSuccess = (res: express.Response, user: any) => {
    const isAdmin = isUserAdmin(user.telegram_id);
    const token = crypto.randomBytes(32).toString('hex');
    saveUserSession(token, user.telegram_id, Date.now() + 30 * 24 * 3600 * 1000);

    const cookies = [`user_token=${token}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax; HttpOnly`];
    res.setHeader('Set-Cookie', cookies);
    return {
      ok: true,
      user: { ...user, is_admin: isAdmin ? 1 : 0 },
      isAdmin,
      token
    };
  };

  // Telegram ID ilə cari daxil olmuş istifadəçi profilini al və IP-ni yenilə
  app.get('/api/auth/me', (req, res) => {
    const effectiveTgId = getValidatedUserTgId(req);
    if (!effectiveTgId) {
      return res.status(401).json({ ok: false, error: 'Sessiya tapılmadı və ya vaxtı bitib. Zəhmət olmasa daxil olun.', code: 'UNAUTHORIZED' });
    }
    const user = getOrCreateUser(effectiveTgId);
    const clientIp = getClientIp(req);
    if (clientIp) {
      updateUserLastIp(effectiveTgId, clientIp);
    }
    const isAdmin = isUserAdmin(user.telegram_id);
    res.json({ ok: true, user: { ...user, is_admin: isAdmin ? 1 : 0, last_ip: clientIp || user.last_ip }, isAdmin });
  });

  // İstifadəçi sessiya sinxronizasiyası nöqtəsi (Sessiya tokeni tələb edir)
  app.post('/api/user/sync', (req, res) => {
    const effectiveTgId = getValidatedUserTgId(req);
    if (!effectiveTgId) {
      return res.status(401).json({ ok: false, error: 'İcazəsiz sorğu. Zəhmət olmasa Telegram ilə daxil olun.', code: 'UNAUTHORIZED' });
    }
    const user = getOrCreateUser(effectiveTgId, req.body.username || '', req.body.first_name || '');
    const clientIp = getClientIp(req);
    if (clientIp) {
      updateUserLastIp(effectiveTgId, clientIp);
    }
    const result = handleUserAuthSuccess(res, { ...user, last_ip: clientIp || user.last_ip });
    res.json(result);
  });

  // Veb İstifadəçini Qeydiyyatdan Keçir (VULN-01 Fix: Yalnız rəsmi Telegram Botu ilə qeydiyyat qəbul edilir)
  app.post('/api/auth/register', (req, res) => {
    return res.status(403).json({
      ok: false,
      error: 'Qeydiyyat yalnız rəsmi Telegram Botu vasitəsilə aparılır. Zəhmət olmasa "Telegram ilə Giriş" metodundan istifadə edin.',
      code: 'DIRECT_REGISTER_DISABLED'
    });
  });

  // Veb İstifadəçi Girişi (VULN-01 Fix: Şifrəsiz birbaşa giriş bağlanıb)
  app.post('/api/auth/login', (req, res) => {
    return res.status(403).json({
      ok: false,
      error: 'Təhlükəsizlik səbəbilə şifrəsiz birbaşa giriş dayandırılıb. Zəhmət olmasa "Telegram ilə Giriş" (QR / OTP) metodundan istifadə edin.',
      code: 'DIRECT_LOGIN_DISABLED'
    });
  });

  // ---------------- TELEGRAM BOT GİRİŞ İNTEQRASİYASI ----------------
  
  // 1. Telegram Giriş sessiyasını başlat
  app.post('/api/auth/telegram/init', (req, res) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    createAuthSession(code);
    const botUser = settingsService.getBotUsername();
    const botUrl = `https://t.me/${botUser}?start=auth_${code}`;

    res.json({
      ok: true,
      code,
      botUrl,
      botUsername: botUser
    });
  });

  // 2. Telegram Giriş sessiyası statusunu yoxla
  app.get('/api/auth/telegram/poll', (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).json({ ok: false, error: 'code tələb olunur.' });
    }
    const session = getAuthSessionByCode(code.trim().toUpperCase());
    if (!session) {
      return res.json({ ok: false, error: 'Sessiya tapılmadı.' });
    }

    if (session.status === 'confirmed' && session.telegram_id) {
      const user = getOrCreateUser(session.telegram_id, session.username || '', session.first_name || '');
      const clientIp = getClientIp(req);
      if (clientIp) {
        updateUserLastIp(session.telegram_id, clientIp);
      }
      const result = handleUserAuthSuccess(res, { ...user, last_ip: clientIp || user.last_ip });
      return res.json({
        ...result,
        confirmed: true
      });
    }

    res.json({
      ok: true,
      confirmed: false,
      status: session.status
    });
  });

  // 3. OTP kodunu əllə təsdiqlə
  app.post('/api/auth/telegram/verify-code', (req, res) => {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ ok: false, error: 'Kod daxil edilməlidir.' });
    }
    const session = getAuthSessionByCode(code.toString().trim().toUpperCase());
    if (!session) {
      return res.status(404).json({ ok: false, error: 'Daxil edilən kod tapılmadı.' });
    }
    if (session.status !== 'confirmed' || !session.telegram_id) {
      return res.status(400).json({ ok: false, error: 'Bu kod hələ Telegram botunda təsdiqlənməyib. Zəhmət olmasa Telegram botunda "Start" düyməsini sıxın.' });
    }
    const user = getOrCreateUser(session.telegram_id, session.username || '', session.first_name || '');
    const clientIp = getClientIp(req);
    if (clientIp) {
      updateUserLastIp(session.telegram_id, clientIp);
    }
    const result = handleUserAuthSuccess(res, { ...user, last_ip: clientIp || user.last_ip });
    res.json(result);
  });

  // Get store configuration (payment rekvizitləri, rates)
  app.get('/api/settings', (req, res) => {
    res.json({
      ok: true,
      settings: settingsService.getAll(),
    });
  });

  // Əsas vitrin (Hero) və sürətli alış üçün aktiv kateqoriyalardan seçilmiş məhsulları gətir
  app.get('/api/products/featured', async (req, res) => {
    const activeCats = getAllActiveApiCategories();
    const margin = settingsService.getMarginPercent();

    const mapped = await Promise.all(activeCats.map(async c => {
      const isPlaypin = c.category_id === 'pubg_mobile_epin' || c.category_id === 'pubg_mobile_web' || (c.note && c.note.includes('PlayPin'));
      
      let minUsd = 0;
      let minAzn = 0;

      try {
        const data = await fazerCardsService.getOffers(c.category_id, c.type as any);
        if (data && data.ok && data.offers && data.offers.length > 0) {
          const prices = data.offers.map(o => {
            const rawUsd = parseFloat(o.price_usd as any) || 0;
            const finalUsd = rawUsd * (1 + margin / 100);
            const finalAzn = settingsService.calculateAznPrice(rawUsd);
            return { finalUsd, finalAzn };
          });
          prices.sort((a, b) => a.finalUsd - b.finalUsd);
          minUsd = parseFloat(prices[0].finalUsd.toFixed(2));
          minAzn = parseFloat(prices[0].finalAzn.toFixed(2));
        }
      } catch (e) {}

      return {
        id: c.category_id,
        name: c.name,
        type: c.type,
        icon: c.icon || (isPlaypin ? '🎮' : '⚡'),
        tag: isPlaypin ? 'PlayPin API' : 'FazerCards',
        min_price_usd: minUsd || 0.89,
        min_price_azn: minAzn || 1.66
      };
    }));

    res.json({ ok: true, products: mapped });
  });

  app.get('/api/categories/featured', (req, res) => {
    res.redirect('/api/products/featured');
  });

  // FazerCards API-dən bütün kateqoriyaları gətir
  app.get('/api/products/all', async (req, res) => {
    try {
      const { topups, giftcards } = await fazerCardsService.fetchAllCategories();
      res.json({ ok: true, topups, giftcards });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  app.get('/api/categories/all', async (req, res) => {
    try {
      const { topups, giftcards } = await fazerCardsService.fetchAllCategories();
      res.json({ ok: true, topups, giftcards });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Müştəri rəylərini və reytinq statistikalarını gətir
  app.get('/api/reviews', (req, res) => {
    const limit = parseInt(req.query.limit as string || '20', 10);
    const stats = getRatingStats();
    const reviews = getRecentReviews(limit);
    res.json({ ok: true, stats, reviews });
  });

  // Hesablanmış AZN qiymətləri ilə kateqoriyaya aid təklifləri gətir
  const getOffersHandler = async (req: express.Request, res: express.Response) => {
    const categoryId = req.query.category_id as string;
    const type = (req.query.type as 'topup' | 'giftcard') || 'topup';

    if (!categoryId) {
      return res.status(400).json({ ok: false, error: 'category_id tələb olunur.' });
    }

    try {
      const data = await fazerCardsService.getOffers(categoryId, type);
      if (!data.ok) {
        return res.status(404).json({ ok: false, error: data.error || 'Təkliflər tapılmadı.' });
      }

      // Hər təklifə hesablanmış AZN qiymətini əlavə et
      const offersWithAzn = (data.offers || []).map(off => ({
        ...off,
        price_azn: settingsService.calculateAznPrice(off.price_usd),
      }));

      res.json({
        ok: true,
        category_id: data.category_id,
        name: data.name,
        fields: data.fields,
        note: data.note,
        offers: offersWithAzn,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  };

  app.get('/api/products/offers', getOffersHandler);
  app.get('/api/offers', getOffersHandler);

  // Oyunçu ID-ni Təsdiqlə
  app.post('/api/products/validate-id', async (req, res) => {
    const { category_id, fields } = req.body;
    if (!category_id || !fields) {
      return res.status(400).json({ ok: false, error: 'category_id və fields tələb olunur.' });
    }
    const result = await fazerCardsService.validatePlayerId(category_id, fields);
    res.json(result);
  });

  // Topup Sifarişi Ver (VULN-01 & VULN-02 Fix: Yalnız daxil olmuş sessiya sahibi sifariş verə bilər)
  app.post('/api/orders/topup', async (req, res) => {
    const { category_id, category_name, offer_id, offer_name, price_usd, player_id, additional_fields } = req.body;

    const effectiveTgId = getValidatedUserTgId(req);
    if (!effectiveTgId) {
      return res.status(401).json({ ok: false, error: 'İcazəsiz sorğu! Zəhmət olmasa Telegram vasitəsilə daxil olun.', code: 'UNAUTHORIZED' });
    }

    if (!category_id || !offer_id || !price_usd || !player_id) {
      return res.status(400).json({ ok: false, error: 'Bütün tələb olunan məlumatları doldurun.' });
    }

    const result = await orderService.processTopupOrder({
      telegramId: effectiveTgId,
      categoryId: category_id,
      categoryName: category_name || category_id,
      offerId: offer_id,
      offerName: offer_name || offer_id,
      priceUsd: parseFloat(price_usd),
      playerId: player_id,
      additionalFields: additional_fields,
    });

    res.json(result);
  });

  // Hədiyyə Kartı Sifarişi Ver (VULN-01 & VULN-02 Fix)
  app.post('/api/orders/giftcard', async (req, res) => {
    const { category_id, category_name, offer_id, offer_name, price_usd, count } = req.body;

    const effectiveTgId = getValidatedUserTgId(req);
    if (!effectiveTgId) {
      return res.status(401).json({ ok: false, error: 'İcazəsiz sorğu! Zəhmət olmasa Telegram vasitəsilə daxil olun.', code: 'UNAUTHORIZED' });
    }

    if (!category_id || !offer_id || !price_usd) {
      return res.status(400).json({ ok: false, error: 'Məlumatlar çatışmır.' });
    }

    const result = await orderService.processGiftcardOrder({
      telegramId: effectiveTgId,
      categoryId: category_id,
      categoryName: category_name || category_id,
      offerId: offer_id,
      offerName: offer_name || offer_id,
      priceUsd: parseFloat(price_usd),
      count: count ? parseInt(count, 10) : 1,
    });

    res.json(result);
  });

  // İstifadəçi sifariş tarixçəsi (VULN-01 & VULN-02 Fix)
  app.get('/api/orders/history', (req, res) => {
    const effectiveTgId = getValidatedUserTgId(req);
    if (!effectiveTgId) {
      return res.status(401).json({ ok: false, error: 'İcazəsiz giriş! Zəhmət olmasa daxil olun.', code: 'UNAUTHORIZED' });
    }
    const orders = getUserOrders(effectiveTgId, 50);
    res.json({ ok: true, orders });
  });

  // Müştəri İstifadəçi API Açar İdarəetməsi (Telegram Bot ilə Sinxron)
  app.get('/api/user/api-key', (req, res) => {
    const effectiveTgId = getValidatedUserTgId(req);
    if (!effectiveTgId) {
      return res.status(401).json({ ok: false, error: 'İcazəsiz giriş! Zəhmət olmasa daxil olun.', code: 'UNAUTHORIZED' });
    }

    let keys = getUserApiKeys(effectiveTgId);
    if (!keys || keys.length === 0) {
      createApiKey(effectiveTgId, 'Web Client API');
      keys = getUserApiKeys(effectiveTgId);
    }

    const activeKey = keys[0];
    res.json({
      ok: true,
      apiKey: activeKey ? activeKey.api_key : null,
      name: activeKey ? activeKey.name : 'Web Client API',
      total_orders: activeKey ? activeKey.total_orders : 0,
      total_spent_azn: activeKey ? activeKey.total_spent_azn : 0,
      created_at: activeKey ? activeKey.created_at : null,
    });
  });

  app.post('/api/user/api-key/regenerate', (req, res) => {
    const effectiveTgId = getValidatedUserTgId(req);
    if (!effectiveTgId) {
      return res.status(401).json({ ok: false, error: 'İcazəsiz giriş! Zəhmət olmasa daxil olun.', code: 'UNAUTHORIZED' });
    }

    const existingKeys = getUserApiKeys(effectiveTgId);
    for (const k of existingKeys) {
      revokeApiKey(k.id, effectiveTgId);
    }

    const newKey = createApiKey(effectiveTgId, 'Web Client API');
    res.json({
      ok: true,
      apiKey: newKey ? newKey.key : null,
      message: 'Yeni API açarı uğurla yaradıldı! Köhnə açar ləğv edildi.'
    });
  });

  // Binance Pay Sifariş ID-ni Təqdim Et
  app.post('/api/payments/binance', async (req, res) => {
    const { telegram_id, order_id } = req.body;
    if (!telegram_id || !order_id) {
      return res.status(400).json({ ok: false, error: 'telegram_id və order_id tələb olunur.' });
    }

    const result = await paymentService.processBinancePay(telegram_id, order_id);
    res.json(result);
  });

  // M10 / Bank Kartı Qəbzini Təqdim Et
  app.post('/api/payments/receipt', upload.single('receipt'), async (req, res) => {
    const { telegram_id, username, first_name, method, amount_azn } = req.body;

    if (!telegram_id || !req.file) {
      return res.status(400).json({ ok: false, error: 'Şəkil və telegram_id tələb olunur.' });
    }

    // İkili MIME Yoxlama Təsdiqi (Magic Baytlar)
    const isAuthenticImage = validateImageMagicBytes(req.file.path);
    if (!isAuthenticImage) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
      return res.status(400).json({
        ok: false,
        error: 'Təhlükəsizlik xətası: Yüklənən fayl etibarlı JPEG, PNG və ya WEBP şəkli deyil (MIME Sniffing rədd edildi).'
      });
    }

    const result = await paymentService.submitManualReceipt({
      telegramId: telegram_id,
      username,
      firstName: first_name,
      method: (method as 'm10' | 'card') || 'm10',
      receiptPath: `/uploads/${req.file.filename}`,
      amountAzn: amount_azn ? parseFloat(amount_azn) : 0,
    });

    res.json(result);
  });

  // ---------------- WHITELABEL B2B SATICI API (V1) ----------------

  // B2B API sorğularını autentifikasiya etmək üçün ara proqram (Bearer və ya X-API-KEY)
  const apiV1Auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const xApiKey = (req.headers['x-api-key'] || req.headers['x-api-token'] || req.query.api_key) as string;

    const authRes = apiGatewayService.authenticate(authHeader, xApiKey);
    if (!authRes.ok || !authRes.context) {
      return res.status(401).json({
        ok: false,
        error: authRes.error || 'Autentifikasiya uğursuz oldu. API Key mütləqdir.',
        code: 'UNAUTHORIZED',
      });
    }

    (req as any).apiContext = authRes.context;
    next();
  };

  // Canlı İnteraktiv Oyun Meydançası üçün Demo Token Köməkçisi
  app.get('/api/v1/demo-token', (req, res) => {
    try {
      const demoId = '999000111';
      const demoUser = getOrCreateUser(demoId, 'SandboxPartner', 'Sandbox Reseller B2B');
      // Demo istifadəçi yenidirsə və ya balansı 0-dırsa, ilkin 850 AZN ($500 USD) ver
      if (demoUser.balance <= 0) {
        updateUserBalance(demoId, 850);
      }
      const keys = getUserApiKeys(demoId);
      let activeKey = keys.find(k => k.is_active);
      if (!activeKey) {
        const created = createApiKey(demoId, 'Sandbox Reseller API Key');
        return res.json({ ok: true, apiKey: created.key, telegramId: demoId });
      }
      res.json({ ok: true, apiKey: activeKey.api_key, telegramId: demoId });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 1. Məni Gətir / Hesab Məlumatı və Balans
  app.get('/api/v1/getMe', apiV1Auth, (req, res) => {
    const ctx = (req as any).apiContext;
    const freshUser = getOrCreateUser(ctx.user.telegram_id);
    res.json({
      ok: true,
      service: 'Winners Reseller API v1',
      account: {
        telegram_id: ctx.user.telegram_id,
        username: ctx.user.username,
        first_name: ctx.user.first_name,
        balance_azn: freshUser.balance,
        currency: 'AZN',
      },
      api_key_info: {
        name: ctx.apiKey.name,
        total_orders: ctx.apiKey.total_orders,
        total_spent_azn: ctx.apiKey.total_spent_azn,
        created_at: ctx.apiKey.created_at,
      }
    });
  });

  // 2. Bütün Whitelabel Kateqoriyalarını Gətir
  app.get('/api/v1/categories', apiV1Auth, (req, res) => {
    const categories = apiGatewayService.getCategories();
    res.json({
      ok: true,
      count: categories.length,
      categories,
    });
  });

  // 3. Whitelabel Təklifləri və Satış Qiymətlərini Gətir
  app.get('/api/v1/offers', apiV1Auth, async (req, res) => {
    const categoryId = (req.query.category_id || req.query.id) as string;
    if (!categoryId) {
      return res.status(400).json({ ok: false, error: 'category_id parametri tələb olunur.' });
    }
    const result = await apiGatewayService.getOffers(categoryId.trim());
    if (!result.ok) {
      return res.status(404).json(result);
    }
    res.json(result);
  });

  // 3.1 Oyunçu ID-ni Təsdiqlə / Oyundaxili İstifadəçi Adı Axtarışı
  app.post('/api/v1/validate-player-id', apiV1Auth, async (req, res) => {
    const { category_id, player_id, additional_fields } = req.body;
    const result = await apiGatewayService.validatePlayerId(category_id, player_id, additional_fields);
    res.json(result);
  });
  app.post('/api/v1/validate-id', apiV1Auth, async (req, res) => {
    const { category_id, player_id, additional_fields } = req.body;
    const result = await apiGatewayService.validatePlayerId(category_id, player_id, additional_fields);
    res.json(result);
  });

  // 4. Birbaşa ID Top-up Sifarişi Ver
  app.post('/api/v1/orders/topup', apiV1Auth, async (req, res) => {
    const ctx = (req as any).apiContext;
    const { category_id, offer_id, player_id, additional_fields } = req.body;
    const result = await apiGatewayService.processTopup(ctx, {
      category_id,
      offer_id,
      player_id,
      additional_fields,
    });
    if (!result.ok) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // 5. Hədiyyə Kartı / E-Pin Alış Sifarişi Ver
  app.post('/api/v1/orders/giftcard', apiV1Auth, async (req, res) => {
    const ctx = (req as any).apiContext;
    const { category_id, offer_id, count } = req.body;
    const result = await apiGatewayService.processGiftcard(ctx, {
      category_id,
      offer_id,
      count,
    });
    if (!result.ok) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // 6. Xüsusi Sifariş Statusunu Yoxla
  app.get('/api/v1/orders/:orderId', apiV1Auth, (req, res) => {
    const ctx = (req as any).apiContext;
    const orderId = req.params.orderId;
    const result = apiGatewayService.getOrderStatus(orderId, ctx);
    if (!result.ok) {
      return res.status(404).json(result);
    }
    res.json(result);
  });

  // 6.1 API vasitəsilə Son Sifarişləri Yoxla (Satıcı Jurnalı)
  app.get('/api/v1/user-orders', apiV1Auth, (req, res) => {
    const ctx = (req as any).apiContext;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
    const orders = getUserOrders(ctx.user.telegram_id, limit);
    res.json({
      ok: true,
      total: orders.length,
      orders: orders.map(o => {
        let codes: string[] | null = null;
        if (o.fazer_response) {
          try {
            const parsed = JSON.parse(o.fazer_response);
            if (Array.isArray(parsed.codes)) {
              codes = parsed.codes;
            } else if (parsed.code) {
              codes = [parsed.code];
            } else if (Array.isArray(parsed.delivered_codes)) {
              codes = parsed.delivered_codes;
            }
          } catch (e) {}
        }
        return {
          id: o.id,
          product_type: o.product_type,
          category_name: o.category_name,
          offer_name: o.offer_name,
          player_id: o.player_id,
          price_azn: o.price_azn,
          price_usd: o.price_usd,
          status: o.status,
          delivered_codes: codes,
          created_at: o.created_at,
        };
      })
    });
  });

  // İnteraktiv Sandbox üçün Demo Balans Enjektoru
  app.post('/api/v1/demo-add-balance', apiV1Auth, (req, res) => {
    const ctx = (req as any).apiContext;
    const amount = Number(req.body.amount) || 85;
    const bounded = Math.min(Math.max(amount, 10), 1000);
    updateUserBalance(ctx.user.telegram_id, bounded);
    const fresh = getOrCreateUser(ctx.user.telegram_id);
    const balanceUsd = parseFloat((fresh.balance / 1.70).toFixed(2));
    res.json({ ok: true, balance: fresh.balance, balance_usd: balanceUsd, added: bounded });
  });

  // ---------------- İSTİFADƏÇİ ÖZÜ-XİDMƏT API AÇARLARI ----------------
  app.get('/api/user/api-keys', (req, res) => {
    const tgId = getValidatedUserTgId(req);
    if (!tgId) return res.status(401).json({ ok: false, error: 'Daxil olunmayıb.' });
    const keys = getUserApiKeys(tgId);
    res.json({ ok: true, keys });
  });

  app.post('/api/user/api-keys/generate', (req, res) => {
    const tgId = getValidatedUserTgId(req);
    if (!tgId) return res.status(401).json({ ok: false, error: 'Daxil olunmayıb.' });
    const name = (req.body.name || 'My API Client').toString().slice(0, 50);
    const newKey = createApiKey(tgId, name);
    res.json({ ok: true, apiKey: newKey });
  });

  app.delete('/api/user/api-keys/:id', (req, res) => {
    const tgId = getValidatedUserTgId(req);
    if (!tgId) return res.status(401).json({ ok: false, error: 'Daxil olunmayıb.' });
    const keyId = parseInt(req.params.id, 10);
    const success = revokeApiKey(keyId, tgId);
    res.json({ ok: success });
  });

  // ---------------- ADMİN AUTENTİFİKASİYA VƏ TƏHLÜKƏSİZLİK ----------------
  const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const cookies = parseCookies(req);
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers['x-admin-token']) {
      token = req.headers['x-admin-token'] as string;
    } else if (cookies['admin_token']) {
      token = cookies['admin_token'];
    }

    if (!token || !adminAuthService.verifyToken(token)) {
      const cleanIp = getClientIp(req);
      const reqUser = getRequestUser(req);
      loggerService.sendSecurityAlert('UNAUTHORIZED_ADMIN_ACCESS', {
        ip: cleanIp,
        endpoint: req.originalUrl || req.path,
        userAgent: (req.headers['user-agent'] as string) || 'Bilinməyən Brauzer',
        user: reqUser,
        reason: `İcazəsiz admin API sorğusu: ${req.method} ${req.originalUrl || req.path}`,
        actionTaken: 'HTTP 401 Unauthorized qaytarıldı'
      });
      return res.status(401).json({
        ok: false,
        error: 'Təhlükəsizlik icazəsi yoxdur! Zəhmət olmasa admin şifrəsi ilə daxil olun.',
        code: 'UNAUTHORIZED'
      });
    }

    next();
  };

  // IP başına Brute Force Giriş İzləyicisi (10-dəqiqəlik sürüşən pəncərə)
  interface FailedLoginTracker {
    attempts: number;
    firstAttempt: number;
  }
  const failedLoginMap = new Map<string, FailedLoginTracker>();

  // ARCH-03 Fix: failedLoginMap yaddaş təmizləyicisi (RAM DoS qorunması)
  setInterval(() => {
    const now = Date.now();
    for (const [ip, tracker] of failedLoginMap.entries()) {
      if (now - tracker.firstAttempt > 10 * 60 * 1000) {
        failedLoginMap.delete(ip);
      }
    }
  }, 10 * 60 * 1000).unref();

  // Şəxsi şifrə ilə Admin girişi və Brute-Force / Hücum Monitoru
  app.post('/api/admin/auth/login', (req, res) => {
    const cleanIp = getClientIp(req);
    const now = Date.now();

    const tracker = failedLoginMap.get(cleanIp) || { attempts: 0, firstAttempt: now };
    if (now - tracker.firstAttempt > 10 * 60 * 1000) {
      tracker.attempts = 0;
      tracker.firstAttempt = now;
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ ok: false, error: 'Şifrə daxil edilməlidir.' });
    }

    const result = adminAuthService.login(password.toString().trim(), cleanIp);
    if (!result.ok) {
      tracker.attempts++;
      failedLoginMap.set(cleanIp, tracker);

      // 3 və ya daha çox uğursuz cəhd olarsa -> Kanala təhlükəsizlik xəbərdarlığı göndər
      if (tracker.attempts >= 3) {
        loggerService.sendSecurityAlert('BRUTE_FORCE', {
          ip: cleanIp,
          endpoint: '/api/admin/auth/login',
          count: tracker.attempts,
          userAgent: req.headers['user-agent'] as string,
          user: getRequestUser(req),
          reason: `Admin panelinə ardıcıl ${tracker.attempts} yanlış şifrə daxil edildi`
        });
      }

      // 5 və ya daha çox uğursuz cəhd olarsa -> Avtomatik IP qadağası və rədd
      if (tracker.attempts >= 5) {
        addBannedIp(cleanIp, `Ardıcıl ${tracker.attempts} uğursuz admin login şifrə cəhdi (Brute-Force)`);
        loggerService.sendSecurityAlert('IP_BAN', {
          ip: cleanIp,
          endpoint: '/api/admin/auth/login',
          count: tracker.attempts,
          user: getRequestUser(req),
          reason: '5 uğursuz şifrə cəhdindən sonra IP avtomatik olaraq Ban edildi'
        });

        return res.status(403).json({
          ok: false,
          error: 'Çox sayda yanlış şifrə daxil edildiyi üçün IP ünvanınız avtomatik bloklandı.'
        });
      }

      return res.status(401).json(result);
    }

    // Uğurlu giriş -> uğursuz cəhdləri təmizlə və cookie təyin et
    failedLoginMap.delete(cleanIp);
    if (result.token) {
      res.setHeader('Set-Cookie', `admin_token=${result.token}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`);
    }
    res.json(result);
  });

  // Aktiv admin sessiyasını təsdiqlə
  app.get('/api/admin/auth/verify', (req, res) => {
    const cookies = parseCookies(req);
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers['x-admin-token']) {
      token = req.headers['x-admin-token'] as string;
    } else if (cookies['admin_token']) {
      token = cookies['admin_token'];
    }
    const isValid = adminAuthService.verifyToken(token);
    res.json({ ok: isValid });
  });

  // Admin çıxışı
  app.post('/api/admin/auth/logout', (req, res) => {
    const cookies = parseCookies(req);
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (cookies['admin_token']) {
      token = cookies['admin_token'];
    }
    adminAuthService.logout(token);
    res.setHeader('Set-Cookie', 'admin_token=; Path=/; Max-Age=0; SameSite=Lax');
    res.json({ ok: true });
  });

  // Admin şifrəsini dəyiş
  app.post('/api/admin/auth/change-password', requireAdminAuth, (req, res) => {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({ ok: false, error: 'Mövcud və yeni şifrə tələb olunur.' });
    }
    const result = adminAuthService.changePassword(old_password, new_password);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // ---------------- ADMİN QORUNAN İDARƏETMƏ PANELİ API ----------------

  // Admin ümumi statistikaları
  app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
    const stats = getStats();
    const [fazerBalance, playpinRes] = await Promise.all([
      fazerCardsService.getBalance(),
      playpinService.getMe(),
    ]);

    res.json({
      ok: true,
      stats: {
        ...stats,
        fazerBalance: fazerBalance.balance,
        fazerCurrency: fazerBalance.currency,
        fazerOk: fazerBalance.ok,
        playpinBalance: playpinRes.ok && playpinRes.data ? playpinRes.data.balance.toFixed(2) : '0.00',
        playpinCurrency: 'USD',
        playpinOk: playpinRes.ok,
        playpinUser: playpinRes.data?.username || '',
        playpinConfigured: playpinService.isConfigured(),
        usdRate: settingsService.getUsdAznRate(),
        marginPercent: settingsService.getMarginPercent(),
      }
    });
  });

  // Gözləyən qəbz ödənişləri
  app.get('/api/admin/payments/pending', requireAdminAuth, (req, res) => {
    const pending = getPendingPayments();
    res.json({ ok: true, payments: pending });
  });

  // Proksi / Birbaşa Qəbz Şəklini Təqdim Et (Telegram file_id, yerli yükləmələr və ya xarici URL-ləri həll edir)
  app.get('/api/admin/receipt-image/:paymentId', requireAdminAuth, async (req, res) => {
    try {
      const { paymentId } = req.params;
      const payment = getPaymentById(paymentId);
      if (!payment || !payment.receipt_path) {
        return sendReceiptUnavailableSvg(res, 'Qəbz Tapılmadı');
      }

      const receiptPath = payment.receipt_path.trim();

      // 1. Yerli keşlənmiş və ya yerli fayl yükləməsidirsə
      const localCachedName = `receipt_${paymentId}.jpg`;
      const localCachedPath = path.resolve(config.paths.uploadsDir, localCachedName);
      if (fs.existsSync(localCachedPath)) {
        return res.sendFile(localCachedPath);
      }

      if (receiptPath.startsWith('/uploads/') || receiptPath.startsWith('uploads/')) {
        const fileName = path.basename(receiptPath);
        const absUploadsPath = path.resolve(config.paths.uploadsDir, fileName);
        const absPublicPath = path.resolve(process.cwd(), 'public', 'uploads', fileName);
        if (fs.existsSync(absUploadsPath)) {
          return res.sendFile(absUploadsPath);
        } else if (fs.existsSync(absPublicPath)) {
          return res.sendFile(absPublicPath);
        }
      }

      // 2. Xarici HTTP URL-dirsə
      if (receiptPath.startsWith('http://') || receiptPath.startsWith('https://')) {
        return res.redirect(receiptPath);
      }

      // 3. Telegram file_id-dir
      const bot = notificationService.getBot();
      const botToken = config.botToken;
      if (bot && botToken) {
        try {
          const file = await bot.api.getFile(receiptPath);
          if (file && file.file_path) {
            const directUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
            const fetchRes = await fetch(directUrl);
            if (fetchRes.ok) {
              const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
              const arrayBuf = await fetchRes.arrayBuffer();
              const buf = Buffer.from(arrayBuf);

              // Gələcək sorğular üçün yerli diske yaz
              try {
                if (!fs.existsSync(config.paths.uploadsDir)) {
                  fs.mkdirSync(config.paths.uploadsDir, { recursive: true });
                }
                fs.writeFileSync(localCachedPath, buf);
              } catch (writeErr) {}

              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'public, max-age=86400');
              return res.send(buf);
            }
          }
        } catch (botErr: any) {
          // Telegram file_id vaxtı keçib və ya əvvəlki bot tokeni ilə yüklənib
        }
      }

      return sendReceiptUnavailableSvg(res, 'Qəbz Şəkli Əlçatan Deyil');
    } catch (err: any) {
      return sendReceiptUnavailableSvg(res, 'Xəta Baş Verdi');
    }
  });

  function sendReceiptUnavailableSvg(res: any, msg: string) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
      <rect width="100%" height="100%" fill="#0f172a" rx="8"/>
      <rect x="10" y="10" width="280" height="180" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1.5" stroke-dasharray="4"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="28">🧾</text>
      <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="bold">${msg}</text>
      <text x="50%" y="78%" dominant-baseline="middle" text-anchor="middle" fill="#475569" font-family="sans-serif" font-size="10">Telegram faylı arxivləşdirilib</text>
    </svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(svg);
  }

  // Ödənişi təsdiqlə
  app.post('/api/admin/payments/approve', requireAdminAuth, async (req, res) => {
    const { payment_id, amount_azn, note } = req.body;
    if (!payment_id || !amount_azn) {
      return res.status(400).json({ ok: false, error: 'payment_id və amount_azn tələb olunur.' });
    }
    const result = await paymentService.approveReceipt(payment_id, parseFloat(amount_azn), note);
    res.json(result);
  });

  // Ödənişi rədd et
  app.post('/api/admin/payments/reject', requireAdminAuth, async (req, res) => {
    const { payment_id, reason } = req.body;
    if (!payment_id) {
      return res.status(400).json({ ok: false, error: 'payment_id tələb olunur.' });
    }
    const result = await paymentService.rejectReceipt(payment_id, reason);
    res.json(result);
  });

  // Bütün son sifarişlər
  app.get('/api/admin/orders', requireAdminAuth, (req, res) => {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const orders = getAllOrders(limit);
    res.json({ ok: true, orders });
  });

  // Əllə Başlatma: FazerCards və PlayPin-dən Sifarişləri Sinxronlaşdır
  app.post('/api/admin/sync-upstream', requireAdminAuth, async (req, res) => {
    try {
      const result = await upstreamSyncService.syncAllUpstreamOrders();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Geniş statistikalarla bütün istifadəçilər
  app.get('/api/admin/users', requireAdminAuth, (req, res) => {
    const users = getAllUsersWithStats();
    res.json({ ok: true, users });
  });

  // İstifadəçi balansını əllə yenilə (əlavə et, çıx, təyin et)
  app.post('/api/admin/users/balance', requireAdminAuth, async (req, res) => {
    const { telegram_id, amount_azn, action } = req.body;
    if (!telegram_id || amount_azn === undefined) {
      return res.status(400).json({ ok: false, error: 'Məlumatlar çatışmır.' });
    }
    const val = parseFloat(amount_azn);
    let newBal: number;

    if (action === 'set') {
      newBal = setUserBalanceDirect(telegram_id, val);
    } else if (action === 'subtract') {
      newBal = updateUserBalance(telegram_id, -Math.abs(val));
    } else {
      newBal = updateUserBalance(telegram_id, Math.abs(val));
    }

    try {
      await notificationService.notifyUserPaymentApproved(telegram_id, val, newBal);
    } catch (e) {}

    res.json({ ok: true, newBalance: newBal });
  });

  // İstifadəçi rolunu yenilə (Admin / User)
  app.post('/api/admin/users/role', requireAdminAuth, (req, res) => {
    const { telegram_id, is_admin } = req.body;
    if (!telegram_id) {
      return res.status(400).json({ ok: false, error: 'telegram_id tələb olunur.' });
    }
    const ok = setUserRole(telegram_id, is_admin ? 1 : 0);
    res.json({ ok });
  });

  // İstifadəçini blokla (Hesabı Deaktiv Et)
  app.post('/api/admin/users/block', requireAdminAuth, (req, res) => {
    const { telegram_id, reason } = req.body;
    if (!telegram_id) {
      return res.status(400).json({ ok: false, error: 'telegram_id tələb olunur.' });
    }
    const ok = blockUser(telegram_id, reason || 'Qaydaların pozulması');
    res.json({ ok });
  });

  // İstifadəçini blokdan çıxart (Hesabı Yenidən Aktivləşdir)
  app.post('/api/admin/users/unblock', requireAdminAuth, (req, res) => {
    const { telegram_id } = req.body;
    if (!telegram_id) {
      return res.status(400).json({ ok: false, error: 'telegram_id tələb olunur.' });
    }
    const ok = unblockUser(telegram_id);
    res.json({ ok });
  });

  // İstifadəçini və əlaqəli bütün qeydləri bazadan həmişəlik sil
  app.delete('/api/admin/users/:telegram_id', requireAdminAuth, (req, res) => {
    const { telegram_id } = req.params;
    if (!telegram_id) {
      return res.status(400).json({ ok: false, error: 'telegram_id tələb olunur.' });
    }
    const ok = deleteUserCompletely(telegram_id);
    res.json({ ok });
  });

  // Ətraflı 360-Dərəcə İstifadəçi Detallarını və Tarixçəsini Gətir
  app.get('/api/admin/users/:telegram_id/details', requireAdminAuth, (req, res) => {
    const { telegram_id } = req.params;
    if (!telegram_id) {
      return res.status(400).json({ ok: false, error: 'telegram_id tələb olunur.' });
    }
    const data = getUserComprehensiveDetails(telegram_id);
    if (!data) {
      return res.status(404).json({ ok: false, error: 'İstifadəçi tapılmadı.' });
    }
    res.json({ ok: true, data });
  });

  // Admin Bütün B2B API Açarlarını Gətir
  app.get('/api/admin/api-keys', requireAdminAuth, (req, res) => {
    const keys = getAllApiKeysWithUser();
    res.json({ ok: true, keys });
  });

  // Admin B2B API Açarını Aç/Bağla / Ləğv Et
  app.post('/api/admin/api-keys/toggle', requireAdminAuth, (req, res) => {
    const { key_id, is_active } = req.body;
    if (!key_id) {
      return res.status(400).json({ ok: false, error: 'key_id tələb olunur.' });
    }
    const success = toggleApiKeyStatus(parseInt(key_id, 10), is_active ? 1 : 0);
    res.json({ ok: success });
  });

  // Bütün Bloklanmış IP-ləri Gətir
  app.get('/api/admin/ip/banned', requireAdminAuth, (req, res) => {
    const list = getAllBannedIps();
    res.json({ ok: true, bannedIps: list });
  });

  // IP ünvanını blokla
  app.post('/api/admin/ip/ban', requireAdminAuth, (req, res) => {
    const { ip, reason } = req.body;
    if (!ip) {
      return res.status(400).json({ ok: false, error: 'IP ünvanı tələb olunur.' });
    }
    const cleanIp = ip.trim();
    if (config.adminWhitelistIps && config.adminWhitelistIps.includes(cleanIp)) {
      return res.status(400).json({ 
        ok: false, 
        error: `Bu IP (${cleanIp}) Admin Whitelist-dədir və qorunur. Özünüzü bloklaya bilməzsiniz!` 
      });
    }
    const ok = addBannedIp(cleanIp, reason || 'Təhlükəsizlik qaydalarının pozulması');
    if (!ok) {
      return res.status(500).json({ ok: false, error: 'IP bloklanarkən verilənlər bazası xətası baş verdi.' });
    }
    res.json({ ok: true });
  });

  // IP ünvanını blokdan çıxart
  app.post('/api/admin/ip/unban', requireAdminAuth, (req, res) => {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({ ok: false, error: 'IP ünvanı tələb olunur.' });
    }
    const ok = removeBannedIp(ip.trim());
    res.json({ ok });
  });

  // ---------------- TELEGRAM BOT XÜSUSİ ANALİTİKA VƏ MƏHSULLAR API ----------------
  app.get('/api/admin/bot-analytics', requireAdminAuth, async (req, res) => {
    try {
      const stats = getBotSpecificStats();
      const botUser = settingsService.getBotUsername();
      const usdRate = settingsService.getUsdAznRate();
      const margin = settingsService.getMarginPercent();

      // Real DB-dən canlı qiymətlər və status ilə Bot Aktiv Kateqoriyalar Kataloqu
      const activeCats = getAllActiveApiCategories();
      const liveBotProducts = [];

      for (const prod of activeCats) {
        let minPriceAzn = 0;
        let offersCount = 0;
        let liveStatus = 'online';

        const isPlaypin = prod.category_id === 'pubg_mobile_epin' || 
                          prod.category_id === 'pubg_mobile_web' || 
                          (prod.note && prod.note.includes('PlayPin'));
        const provider = isPlaypin ? 'playpin' : 'fazercards';
        const providerLabel = isPlaypin ? 'PlayPin API' : 'FazerCards API';

        try {
          const offersRes = await fazerCardsService.getOffers(prod.category_id, prod.type as 'topup' | 'giftcard');
          if (offersRes.ok && offersRes.offers && offersRes.offers.length > 0) {
            offersCount = offersRes.offers.length;
            const customPricings = getCustomPricingForCategory(prod.category_id);
            const customMap = new Map(customPricings.map(p => [p.offer_id, p]));

            const sorted = offersRes.offers
              .map(o => {
                const custom = customMap.get(o.offer_id);
                if (custom && typeof custom.custom_price_azn === 'number' && custom.custom_price_azn > 0) {
                  return custom.custom_price_azn;
                }
                return settingsService.calculateAznPrice(parseFloat(o.price_usd));
              })
              .filter(p => p > 0)
              .sort((a, b) => a - b);
            minPriceAzn = sorted[0] || 0;
          } else {
            liveStatus = 'no_offers';
          }
        } catch (e) {
          liveStatus = 'error';
        }

        // Bu oyun üçün statistikaları tap
        const gameStat = stats.gameBreakdown.find(g => g.category_id === prod.category_id) || {
          total_orders: 0,
          completed_orders: 0,
          revenue_azn: 0,
          cost_usd: 0,
        };

        liveBotProducts.push({
          id: prod.category_id,
          name: prod.name,
          type: prod.type,
          icon: prod.icon || (isPlaypin ? '🎮' : '⚡'),
          provider: provider,
          provider_label: providerLabel,
          min_price_azn: minPriceAzn,
          offers_count: offersCount,
          status: liveStatus,
          total_orders: gameStat.total_orders,
          completed_orders: gameStat.completed_orders,
          revenue_azn: Number((gameStat.revenue_azn || 0).toFixed(2)),
          cost_azn: Number(((gameStat.cost_usd || 0) * usdRate).toFixed(2)),
          profit_azn: Number(((gameStat.revenue_azn || 0) - ((gameStat.cost_usd || 0) * usdRate)).toFixed(2)),
        });
      }

      const totalBotCostAzn = stats.totalCostUsd * usdRate;
      const totalBotProfitAzn = stats.totalRevenueAzn - totalBotCostAzn;

      res.json({
        ok: true,
        botInfo: {
          username: `@${botUser}`,
          status: 'Aktiv (Online)',
          link: `https://t.me/${botUser}`,
          polling: true,
        },
        metrics: {
          totalUsers: stats.usersCount,
          totalOrders: stats.totalOrders,
          completedOrders: stats.completedOrders,
          totalRevenueAzn: stats.totalRevenueAzn,
          totalCostAzn: Number(totalBotCostAzn.toFixed(2)),
          totalProfitAzn: Number(totalBotProfitAzn.toFixed(2)),
          usdRate,
          marginPercent: margin,
        },
        products: liveBotProducts,
        topBuyers: stats.topBuyers,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ---------------- ADMIN CANLI İNVENTAR VƏ MƏHSULLAR API ----------------
  app.get('/api/admin/products', requireAdminAuth, async (req, res) => {
    try {
      const cats = await fazerCardsService.fetchAllCategories();
      const featured = fazerCardsService.getFeaturedCategories();
      const balance = await fazerCardsService.getBalance();

      const allTopups = cats.topups.map(t => {
        const isFeatured = featured.some(f => f.id === t.category_id);
        return {
          id: t.category_id,
          name: t.name,
          note: t.note,
          type: 'topup',
          isFeatured,
          status: 'live',
        };
      });

      const allGiftcards = cats.giftcards.map(g => {
        const isFeatured = featured.some(f => f.id === g.category_id);
        return {
          id: g.category_id,
          name: g.name,
          note: g.note,
          type: 'giftcard',
          isFeatured,
          status: 'live',
        };
      });

      res.json({
        ok: true,
        stats: {
          totalTopups: allTopups.length,
          totalGiftcards: allGiftcards.length,
          supplierBalance: balance.balance,
          supplierCurrency: balance.currency,
          supplierOk: balance.ok,
        },
        featured,
        products: [...allTopups, ...allGiftcards],
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/admin/products/:categoryId/offers', requireAdminAuth, async (req, res) => {
    try {
      const { categoryId } = req.params;
      const type = (req.query.type as 'topup' | 'giftcard') || 'topup';
      const offersRes = await fazerCardsService.getOffers(categoryId, type);

      if (!offersRes.ok || !offersRes.offers) {
        return res.json({
          ok: false,
          error: offersRes.error || 'Təkliflər tapılmadı və ya təchizatçıda müvəqqəti qeyri-aktivdir.',
          offers: []
        });
      }

      const usdRate = settingsService.getUsdAznRate();

      const enrichedOffers = offersRes.offers.map(off => {
        const priceUsd = parseFloat(off.price_usd);
        const baseAzn = priceUsd * usdRate;
        const priceAzn = settingsService.calculateAznPrice(priceUsd);
        const profitAzn = priceAzn - baseAzn;

        return {
          ...off,
          price_usd_num: priceUsd,
          base_azn: parseFloat(baseAzn.toFixed(2)),
          price_azn: priceAzn,
          profit_azn: parseFloat(profitAzn.toFixed(2)),
          stock_status: 'instock',
        };
      });

      res.json({
        ok: true,
        category_id: categoryId,
        name: offersRes.name,
        offers: enrichedOffers
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Hədəfli və Seqmentli Kütləvi Mesaj Göndər
  app.post('/api/admin/broadcast', requireAdminAuth, async (req, res) => {
    const { message, photo_url, segment } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ ok: false, error: 'Mesaj mətni tələb olunur.' });
    }
    const result = await notificationService.broadcastSegmented({
      segment: segment || 'all',
      text: message.trim(),
      photoUrl: photo_url || undefined,
    });
    res.json({ ok: true, result });
  });

  // Hədəf Seqmentləri üzrə İstifadəçi Sayları
  app.get('/api/admin/broadcast-segments', requireAdminAuth, (req, res) => {
    try {
      const counts = getSegmentCounts();
      res.json({ ok: true, segments: counts });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // =========================================================================
  // TELEGRAM XÜSUSİ KATEQORİYALAR VƏ MƏHSULLAR ADMİN API (ŞƏKİL TƏLƏB OLUNMUR)
  // =========================================================================

  // 1. Bütün xüsusi kateqoriyaları gətir
  app.get('/api/admin/custom-categories', requireAdminAuth, (req, res) => {
    try {
      const categories = getAllCustomCategories(true);
      res.json({ ok: true, categories });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 2. Xüsusi kateqoriya yarat
  app.post('/api/admin/custom-categories', requireAdminAuth, (req, res) => {
    try {
      const { name, icon, type, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ ok: false, error: 'Kateqoriya adı tələb olunur.' });
      }
      const cat = createCustomCategory(name, icon || '🎮', type || 'topup', description || '');
      res.json({ ok: true, category: cat });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 3. Xüsusi kateqoriya aktiv vəziyyətini dəyişdir
  app.post('/api/admin/custom-categories/:id/toggle', requireAdminAuth, (req, res) => {
    try {
      const active = toggleCustomCategory(req.params.id);
      res.json({ ok: true, is_active: active ? 1 : 0 });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 4. Xüsusi kateqoriyanı sil
  app.delete('/api/admin/custom-categories/:id', requireAdminAuth, (req, res) => {
    try {
      deleteCustomCategory(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 5. Bütün xüsusi məhsulları və ya kateqoriya üzrə məhsulları gətir
  app.get('/api/admin/custom-products', requireAdminAuth, (req, res) => {
    try {
      const categoryId = req.query.category_id as string;
      const products = categoryId ? getCustomProductsByCategory(categoryId, true) : getAllCustomProducts();
      res.json({ ok: true, products });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 6. Xüsusi məhsul yarat
  app.post('/api/admin/custom-products', requireAdminAuth, (req, res) => {
    try {
      const { category_id, name, price_usd, price_azn, delivery_type, api_offer_id, codes } = req.body;
      if (!category_id || !name || !name.trim()) {
        return res.status(400).json({ ok: false, error: 'Kateqoriya və Məhsul adı tələb olunur.' });
      }

      const usdRate = settingsService.getUsdAznRate();
      const pUsd = parseFloat(price_usd) || 0;
      let pAzn = parseFloat(price_azn);
      if (isNaN(pAzn) || pAzn <= 0) {
        pAzn = Number((pUsd * usdRate).toFixed(2));
      }

      let parsedCodes: string[] = [];
      if (typeof codes === 'string') {
        parsedCodes = codes.split('\n').map((c: string) => c.trim()).filter(Boolean);
      } else if (Array.isArray(codes)) {
        parsedCodes = codes.map((c: any) => String(c).trim()).filter(Boolean);
      }

      const product = createCustomProduct(
        category_id,
        name,
        pUsd,
        pAzn,
        delivery_type || 'manual',
        api_offer_id || '',
        parsedCodes
      );

      res.json({ ok: true, product });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 7. Xüsusi məhsulu sil
  app.delete('/api/admin/custom-products/:id', requireAdminAuth, (req, res) => {
    try {
      deleteCustomProduct(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 8. Məhsula stok kodları əlavə et
  app.post('/api/admin/custom-products/:id/stock', requireAdminAuth, (req, res) => {
    try {
      const { codes } = req.body;
      let parsedCodes: string[] = [];
      if (typeof codes === 'string') {
        parsedCodes = codes.split('\n').map((c: string) => c.trim()).filter(Boolean);
      } else if (Array.isArray(codes)) {
        parsedCodes = codes.map((c: any) => String(c).trim()).filter(Boolean);
      }

      if (parsedCodes.length === 0) {
        return res.status(400).json({ ok: false, error: 'Ən azı 1 kod daxil edin.' });
      }

      const added = addStockCodes(req.params.id, parsedCodes);
      const totalAvailable = getAvailableStockCount(req.params.id);

      res.json({ ok: true, added, total_available: totalAvailable });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // =========================================================================
  // FAZER API KATALOQU VƏ XÜSUSİ QİYMƏTLƏNDİRMƏ NÖQTƏLƏRİ (ENDPOINTS)
  // =========================================================================

  // 1. Bütün FazerCards API kataloqunu (Topuplar və Hədiyyə Kartları) is_added statusu ilə gətir
  app.get('/api/admin/fazer/all-catalog', requireAdminAuth, async (req, res) => {
    try {
      const { topups, giftcards } = await fazerCardsService.fetchAllCategories();
      const addedCats = getAllApiCategories() || [];
      const addedMap = new Map(addedCats.map(c => [c.category_id, c]));

      const processList = (list: typeof topups = [], type: 'topup' | 'giftcard') => {
        if (!Array.isArray(list)) return [];
        return list.map(item => {
          if (!item) return null;
          const added = addedMap.get(item.category_id);
          const isPlaypin = item.category_id === 'pubg_mobile_epin' || 
                            item.category_id === 'pubg_mobile_web' || 
                            (item.note && item.note.includes('PlayPin'));
          return {
            category_id: item.category_id,
            name: item.name || item.category_id,
            note: item.note || '',
            type,
            provider: isPlaypin ? 'playpin' : 'fazercards',
            provider_label: isPlaypin ? 'PlayPin API' : 'FazerCards API',
            is_added: !!added,
            is_active: added ? added.is_active : 0,
            icon: added ? added.icon : (isPlaypin ? '🎮' : '⚡')
          };
        }).filter(Boolean);
      };

      const topupList = processList(topups, 'topup');
      const giftcardList = processList(giftcards, 'giftcard');

      res.json({
        ok: true,
        topups: topupList,
        giftcards: giftcardList,
        total_count: topupList.length + giftcardList.length
      });
    } catch (e: any) {
      console.error('all-catalog error:', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 2. Xüsusi API kateqoriyası üçün ağıllı və xüsusi qiymətləndirmə ilə canlı təklifləri gətir
  app.get('/api/admin/fazer/category-offers/:categoryId', requireAdminAuth, async (req, res) => {
    try {
      const categoryId = req.params.categoryId;
      const type = (req.query.type as 'topup' | 'giftcard') || 'topup';

      const offersRes = await fazerCardsService.getOffers(categoryId, type);
      if (!offersRes.ok || !offersRes.offers) {
        return res.status(404).json({ ok: false, error: offersRes.error || 'Təkliflər tapılmadı' });
      }

      const isPlaypin = categoryId === 'pubg_mobile_epin' || categoryId === 'pubg_mobile_web';
      const provider = isPlaypin ? 'playpin' : 'fazercards';
      const providerLabel = isPlaypin ? 'PlayPin API' : 'FazerCards API';

      const usdRate = settingsService.getUsdAznRate();
      const customPricings = getCustomPricingForCategory(categoryId);
      const customMap = new Map(customPricings.map(p => [p.offer_id, p]));

      const enrichedOffers = offersRes.offers.map(offer => {
        const numUsd = parseFloat(offer.price_usd) || 0;
        const baseAzn = Number((numUsd * usdRate).toFixed(2));
        const calculatedAzn = settingsService.calculateAznPrice(numUsd);
        const custom = customMap.get(offer.offer_id);

        const customPriceAzn = custom && typeof custom.custom_price_azn === 'number' ? custom.custom_price_azn : null;
        const customPriceUsd = custom && typeof custom.custom_price_usd === 'number' ? custom.custom_price_usd : null;
        const sellingPriceAzn = customPriceAzn !== null ? customPriceAzn : calculatedAzn;
        const profitAzn = Number((sellingPriceAzn - baseAzn).toFixed(2));
        const isDisabled = custom ? custom.is_disabled : 0;

        let stockVal: number | string = 0;
        // pubg_mobile_web indi real stok saylarına malik Kateqoriya 22 istifadə edir
        if (type ==='giftcard' || categoryId === 'pubg_mobile_epin' || categoryId === 'pubg_mobile_web') {
          stockVal = typeof offer.stock === 'number' ? offer.stock : (parseInt(offer.stock as any, 10) || 0);
        } else {
          stockVal = isPlaypin ? 'playpin_operator' : 'fazercards_direct';
        }

        return {
          offer_id: offer.offer_id,
          name: offer.name,
          cost_usd: numUsd,           // ← Geliş / Maya qiyməti (USD)
          cost_azn: baseAzn,          // ← Geliş / Maya qiyməti (AZN)
          price_usd_num: numUsd,
          base_azn: baseAzn,
          calculated_azn: calculatedAzn,
          custom_price_azn: customPriceAzn,
          custom_price_usd: customPriceUsd,
          selling_price_azn: sellingPriceAzn,
          profit_azn: profitAzn,
          is_disabled: isDisabled,
          has_custom_price: customPriceAzn !== null,
          stock: stockVal,
          provider: provider,
          provider_label: providerLabel
        };
      });

      res.json({
        ok: true,
        category_id: categoryId,
        name: offersRes.name || categoryId,
        type,
        provider,
        provider_label: providerLabel,
        offers: enrichedOffers
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 3. Bütün əlavə edilmiş API kateqoriyalarını gətir
  app.get('/api/admin/api-categories', requireAdminAuth, async (req, res) => {
    try {
      const categories = getAllApiCategories();
      const allCustomPricing = getAllCustomPricing();

      const enriched = categories.map(cat => {
        const customForCat = allCustomPricing.filter((p: any) => p.category_id === cat.category_id);
        const isPlaypin = cat.category_id === 'pubg_mobile_epin' || 
                          cat.category_id === 'pubg_mobile_web' || 
                          (cat.note && cat.note.includes('PlayPin'));
        return {
          ...cat,
          provider: isPlaypin ? 'playpin' : 'fazercards',
          provider_label: isPlaypin ? 'PlayPin API' : 'FazerCards API',
          custom_pricing_count: customForCat.length
        };
      });

      res.json({ ok: true, categories: enriched });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 4. API kateqoriyasını və xüsusi qiymətləndirməni Əlavə et/Yenilə
  app.post('/api/admin/api-categories', requireAdminAuth, (req, res) => {
    try {
      const { category_id, name, icon, type, note, custom_emoji_id, packages } = req.body;
      if (!category_id || !name) {
        return res.status(400).json({ ok: false, error: 'category_id və name tələb olunur.' });
      }

      const cat = addOrUpdateApiCategory(category_id, name, icon || '🎮', type || 'topup', note || '', custom_emoji_id || '');

      // Əgər xüsusi qiymətləri olan paketlər göndərilibsə
      if (Array.isArray(packages)) {
        for (const pkg of packages) {
          if (pkg.offer_id) {
            const pAzn = typeof pkg.custom_price_azn === 'number' && pkg.custom_price_azn > 0 ? pkg.custom_price_azn : null;
            const pUsd = typeof pkg.custom_price_usd === 'number' && pkg.custom_price_usd > 0 ? pkg.custom_price_usd : null;
            setCustomOfferPrice(
              category_id,
              pkg.offer_id,
              pkg.offer_name || pkg.name || pkg.offer_id,
              parseFloat(pkg.base_usd || pkg.price_usd_num) || 0,
              pAzn,
              pUsd,
              pkg.is_disabled ? 1 : 0
            );
          }
        }
      }

      res.json({ ok: true, category: cat });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 5. API Kateqoriyasını aktivləşdir/deaktivləşdir
  app.post('/api/admin/api-categories/:categoryId/toggle', requireAdminAuth, (req, res) => {
    try {
      const success = toggleApiCategory(req.params.categoryId);
      res.json({ ok: success });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 6. API Kateqoriyasını Sil
  app.delete('/api/admin/api-categories/:categoryId', requireAdminAuth, (req, res) => {
    try {
      deleteApiCategory(req.params.categoryId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // 7. Bir kateqoriyadakı paketlər üçün xüsusi qiymətləndirməni yadda saxla
  app.post('/api/admin/api-categories/:categoryId/pricing', requireAdminAuth, (req, res) => {
    try {
      const categoryId = req.params.categoryId;
      const { packages, offer_id, offer_name, base_usd, custom_price_azn, custom_price_usd, is_disabled } = req.body;

      if (Array.isArray(packages)) {
        for (const pkg of packages) {
          if (pkg.offer_id) {
            const pAzn = typeof pkg.custom_price_azn === 'number' && pkg.custom_price_azn > 0 ? pkg.custom_price_azn : (pkg.custom_price_azn === null ? null : undefined);
            const pUsd = typeof pkg.custom_price_usd === 'number' && pkg.custom_price_usd > 0 ? pkg.custom_price_usd : (pkg.custom_price_usd === null ? null : undefined);
            setCustomOfferPrice(
              categoryId,
              pkg.offer_id,
              pkg.offer_name || pkg.name || pkg.offer_id,
              parseFloat(pkg.base_usd || pkg.price_usd_num) || 0,
              pAzn === undefined ? null : pAzn,
              pUsd === undefined ? null : pUsd,
              pkg.is_disabled ? 1 : 0
            );
          }
        }
        return res.json({ ok: true, saved: packages.length });
      }

      if (offer_id) {
        const pAzn = typeof custom_price_azn === 'number' && custom_price_azn > 0 ? custom_price_azn : null;
        const pUsd = typeof custom_price_usd === 'number' && custom_price_usd > 0 ? custom_price_usd : null;
        setCustomOfferPrice(
          categoryId,
          offer_id,
          offer_name || offer_id,
          parseFloat(base_usd) || 0,
          pAzn,
          pUsd,
          is_disabled ? 1 : 0
        );
        return res.json({ ok: true });
      }

      res.status(400).json({ ok: false, error: 'Paket məlumatları tapılmadı.' });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------------- ADMIN TELEGRAM XÜSUSİ EMOJİLƏR API ----------------
  app.get('/api/admin/custom-emojis', requireAdminAuth, (req, res) => {
    try {
      const configPath = path.resolve(process.cwd(), 'custom-emojis.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const data = JSON.parse(raw);
        return res.json({ ok: true, emojis: data });
      }
      res.json({ ok: true, emojis: {} });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/admin/custom-emojis', requireAdminAuth, (req, res) => {
    try {
      const configPath = path.resolve(process.cwd(), 'custom-emojis.json');
      let currentData: Record<string, any> = {};
      if (fs.existsSync(configPath)) {
        currentData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }

      const { emojis, key, custom_emoji_id } = req.body;

      if (key && custom_emoji_id !== undefined) {
        if (!currentData[key]) {
          currentData[key] = { name: key, default: '🔹', custom_emoji_id: '' };
        }
        currentData[key].custom_emoji_id = String(custom_emoji_id).trim();
      } else if (emojis && typeof emojis === 'object') {
        for (const k of Object.keys(emojis)) {
          if (currentData[k]) {
            currentData[k].custom_emoji_id = String(emojis[k].custom_emoji_id || '').trim();
            if (emojis[k].default) currentData[k].default = emojis[k].default;
            if (emojis[k].name) currentData[k].name = emojis[k].name;
          } else {
            currentData[k] = emojis[k];
          }
        }
      }

      fs.writeFileSync(configPath, JSON.stringify(currentData, null, 2), 'utf8');
      res.json({ ok: true, message: 'Telegram Premium emojiləri uğurla yadda saxlanıldı.' });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/admin/api-categories/:categoryId/custom-emoji', requireAdminAuth, (req, res) => {
    try {
      const { categoryId } = req.params;
      const { custom_emoji_id, icon } = req.body;

      db.prepare(`
        UPDATE api_categories 
        SET custom_emoji_id = ?, icon = COALESCE(?, icon)
        WHERE category_id = ?
      `).run(custom_emoji_id ? String(custom_emoji_id).trim() : null, icon || null, categoryId);

      // Həmçinin bu kateqoriyanın custom-emojis.json-da mövcud olub-olmadığını yoxla və uyğundursa sinxronlaşdır
      try {
        const configPath = path.resolve(process.cwd(), 'custom-emojis.json');
        if (fs.existsSync(configPath)) {
          const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          const upperKey = categoryId.toUpperCase();
          if (data[upperKey]) {
            data[upperKey].custom_emoji_id = custom_emoji_id ? String(custom_emoji_id).trim() : '';
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
          }
        }
      } catch (e) {}

      res.json({ ok: true, message: 'Kateqoriyanın emojisi uğurla yeniləndi.' });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------------- ADMİN PARAMETRLƏRİ (KRİPTO ÜNVANLAR VƏ MƏZƏNNƏLƏR VƏ API AÇARLAR VƏ LOG KANAL) API ----------------
  app.get('/api/admin/settings', requireAdminAuth, (req, res) => {
    try {
      res.json({
        ok: true,
        settings: {
          usd_azn_rate: settingsService.getUsdAznRate(),
          margin_percent: settingsService.getMarginPercent(),
          fazercards_api_key: fazerCardsService.getApiKey(),
          playpin_api_key: playpinService.getApiKey(),
          binance_pay_id: settingsService.getBinancePayId(),
          usdt_trc20_address: settingsService.getUsdtTrc20Address(),
          usdt_bep20_address: settingsService.getUsdtBep20Address(),
          bot_username: settingsService.getBotUsername(),
          log_channel_id: settingsService.getLogChannelId(),
        }
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/admin/settings', requireAdminAuth, (req, res) => {
    try {
      const { usd_azn_rate, margin_percent, fazercards_api_key, playpin_api_key, binance_pay_id, usdt_trc20_address, usdt_bep20_address, log_channel_id } = req.body;
      if (usd_azn_rate !== undefined) setSetting('usd_azn_rate', String(usd_azn_rate));
      if (margin_percent !== undefined) setSetting('margin_percent', String(margin_percent));
      if (fazercards_api_key !== undefined) setSetting('fazercards_api_key', String(fazercards_api_key).trim());
      if (playpin_api_key !== undefined) setSetting('playpin_api_key', String(playpin_api_key).trim());
      if (binance_pay_id !== undefined) setSetting('binance_pay_id', String(binance_pay_id));
      if (usdt_trc20_address !== undefined) settingsService.setUsdtTrc20Address(String(usdt_trc20_address));
      if (usdt_bep20_address !== undefined) settingsService.setUsdtBep20Address(String(usdt_bep20_address));
      if (log_channel_id !== undefined) settingsService.setLogChannelId(String(log_channel_id));

      res.json({ ok: true, message: 'Tənzimləmələr və Loq Kanalı parametrləri uğurla yadda saxlanıldı.' });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------------- ADMIN TEST LOG KANALI TESTÇİSİ ----------------
  app.post('/api/admin/logger/test', requireAdminAuth, async (req, res) => {
    try {
      const { channel_id } = req.body;
      const result = await loggerService.sendTestMessage(channel_id);
      if (result.ok) {
        res.json({ ok: true, message: 'Test mesajı Telegram loq kanalına uğurla göndərildi!' });
      } else {
        res.status(400).json({ ok: false, error: result.error });
      }
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------------- ADMIN API AÇARLARI 2FA / OTP NƏZARƏTÇİLƏRİ ----------------
  app.post('/api/admin/keys/request-otp', requireAdminAuth, async (req, res) => {
    try {
      const result = await adminOtpService.generateAndSendOtp(req.ip || 'unknown');
      if (!result.ok) {
        return res.status(400).json({ ok: false, error: result.error });
      }
      res.json({ ok: true, message: result.message });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/admin/keys/verify-otp', requireAdminAuth, async (req, res) => {
    try {
      const { otp } = req.body;
      if (!otp || typeof otp !== 'string') {
        return res.status(400).json({ ok: false, error: 'Şifrə daxil edilməyib.' });
      }
      const result = await adminOtpService.verifyOtp(otp.trim(), req.ip || 'unknown');
      if (!result.ok) {
        return res.status(400).json({ ok: false, error: result.error, remainingAttempts: result.remainingAttempts });
      }
      res.json({ ok: true, message: 'Təhlükəsizlik şifrəsi təsdiqləndi! Açarlar açıldı.' });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------------- QLOBAL EXPRESS XƏTA İDARƏEDİCİSİ (LOG KANALINA 500 BİLDİRİR) ----------------
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express Server Xətası:', err);
    try {
      loggerService.sendErrorAlert('Web Server (Express 500 Route Error)', err, {
        method: req.method,
        path: req.originalUrl || req.path,
        ip: getClientIp(req),
        query: req.query,
      });
    } catch (e) {}

    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ ok: false, error: 'Daxili server xətası baş verdi.' });
  });

  return app;
}
