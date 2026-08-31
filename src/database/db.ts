import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config/config.js';

// Uploads qovluğunun mövcudluğundan əmin olun
if (!fs.existsSync(config.paths.uploadsDir)) {
  fs.mkdirSync(config.paths.uploadsDir, { recursive: true });
}

export const db = new DatabaseSync(config.paths.dbPath);

export function initDatabase() {
  // Sürətli ardıcıllıq üçün WAL rejimi
  db.exec(`PRAGMA journal_mode = WAL;`);

  // İstifadəçilər Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      balance REAL DEFAULT 0.00,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Sifarişlər Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      telegram_id TEXT NOT NULL,
      product_type TEXT NOT NULL,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      offer_id TEXT NOT NULL,
      offer_name TEXT NOT NULL,
      player_id TEXT,
      additional_fields TEXT,
      price_usd REAL NOT NULL,
      price_azn REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      fazer_order_id TEXT,
      fazer_response TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ödənişlər Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      telegram_id TEXT NOT NULL,
      method TEXT NOT NULL,
      amount_azn REAL NOT NULL,
      amount_usd REAL DEFAULT 0.00,
      reference_id TEXT,
      receipt_path TEXT,
      status TEXT DEFAULT 'pending',
      admin_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT
    );
  `);

  // Parametrlər Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Telegram Web Login Təsdiqi üçün Auth Sessiyaları Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      telegram_id TEXT,
      username TEXT,
      first_name TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TEXT
    );
  `);

  // Rəylər Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT,
      user_id INTEGER,
      telegram_id TEXT NOT NULL,
      username TEXT,
      first_name TEXT,
      product_name TEXT,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Referallar Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id TEXT NOT NULL,
      referred_id TEXT UNIQUE NOT NULL,
      total_commission REAL DEFAULT 0.00,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Promokodlar Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS promocodes (
      code TEXT PRIMARY KEY,
      amount_azn REAL NOT NULL,
      max_uses INTEGER DEFAULT 50,
      used_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Promokod İstifadələri Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS promocode_uses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      telegram_id TEXT NOT NULL,
      amount_azn REAL NOT NULL,
      used_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(code, telegram_id)
    );
  `);

  // Telegram Bot və Mağaza üçün Xüsusi Kateqoriyalar Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '🎮',
      type TEXT DEFAULT 'topup',
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Xüsusi Məhsullar Cədvəlini Yarat (Təkliflər / Paketlər)
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_products (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price_usd REAL NOT NULL,
      price_azn REAL NOT NULL,
      delivery_type TEXT DEFAULT 'manual',
      api_offer_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Telegram Bot və Web üçün API Kateqoriyalar Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_categories (
      category_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '🎮',
      type TEXT NOT NULL,
      note TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // API Xüsusi Qiymətləndirmə Cədvəlini Yarat (xüsusi AZN/USD satış qiymətləri üçün)
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_custom_pricing (
      category_id TEXT NOT NULL,
      offer_id TEXT NOT NULL,
      offer_name TEXT NOT NULL,
      base_usd REAL NOT NULL,
      custom_price_azn REAL,
      custom_price_usd REAL,
      is_disabled INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (category_id, offer_id)
    );
  `);

  // Əgər boşdursa və ya köhnədirsə standart populyar API kateqoriyalarını yüklə
  try {
    const ensureCat = db.prepare(`
      INSERT INTO api_categories (category_id, name, icon, type, note, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(category_id) DO UPDATE SET name = excluded.name, type = excluded.type, note = excluded.note
    `);
    ensureCat.run('pubg_mobile_auto', 'PUBG Mobile (Auto Direct ID)', '🔫', 'topup', 'FazerCards Direct ID', 1);
    ensureCat.run('pubg_mobile_epin', 'PUBG Mobile (E-Pin Voucher)', '🎟️','giftcard', 'PlayPin Category 1 E-Pin', 2);
    ensureCat.run('pubg_mobile_web', 'PUBG Mobile (Web Purchase)', '🌐', 'topup', 'PlayPin Web Direct ID', 3);
    try {
      db.prepare("UPDATE api_categories SET name = 'PUBG Mobile (Web Purchase)' WHERE category_id = 'pubg_mobile_web'").run();
    } catch (e: any) { console.error("Database error:", e?.message || e); }

    const seedStmt = db.prepare(`
      INSERT OR IGNORE INTO api_categories (category_id, name, icon, type, is_active, sort_order)
      VALUES (?, ?, ?, ?, 1, ?)
    `);
    seedStmt.run('free_fire_cis', 'Free Fire (CIS)', '🔥', 'topup', 4);
    seedStmt.run('valorant_tr', 'Valorant VP (TR)', '🎯','giftcard', 5);
    seedStmt.run('brawl_stars_turkey', 'Brawl Stars', '⭐', 'topup', 6);
    seedStmt.run('mobile_legends_direct', 'Mobile Legends', '⚔️', 'topup', 7);
    seedStmt.run('roblox_global', 'Roblox (Global)', '🧱','giftcard', 8);
    seedStmt.run('steam_usd', 'Steam Pulqabı (Wallet) USD', '🎮','giftcard', 9);
    seedStmt.run('telegram_stars', 'Telegram Stars', '⭐️', 'topup', 10);
    seedStmt.run('telegram_premium_gift', 'Telegram Premium', '👑', 'topup', 11);
    seedStmt.run('8_ball_pool', '8 Ball Pool', '🎱', 'topup', 12);
    seedStmt.run('eafc_mobile_id', 'EA Sports FC Mobile', '⚽', 'topup', 13);
    seedStmt.run('codm_garena_sgmy', 'Call of Duty Mobile', '🎖️', 'topup', 14);
    seedStmt.run('delta_force', 'Delta Force', '🔫', 'topup', 15);
    seedStmt.run('discord_global', 'Discord Nitro', '💎', 'giftcard', 16);
    seedStmt.run('netflix_us', 'Netflix (US)', '🎬', 'giftcard', 17);
    seedStmt.run('spotify_us', 'Spotify (US)', '🎵', 'giftcard', 18);
    seedStmt.run('afk_journey', 'AFK Journey', '✨', 'topup', 19);
    seedStmt.run('app_store_itunes_us', 'App Store & iTunes (US)', '🍏', 'giftcard', 20);
    seedStmt.run('epic_games_us', 'Epic Games (US)', '🎮', 'giftcard', 21);
    seedStmt.run('point_blank_id', 'Point Blank', '🎯', 'topup', 22);
    seedStmt.run('ea_sports_fctm_26_ea_points', 'EA Sports FC Points', '⚽', 'giftcard', 23);
  } catch (e: any) { console.error("Database error:", e?.message || e); }

  // Xüsusi Stok Kodları Cədvəlini Yarat (Telegram botda ani rəqəmsal çatdırılma üçün)
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_stock_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      code TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      used_by_telegram_id TEXT,
      order_id TEXT,
      used_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Admin Daimi Sessiyalar Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Qadağan edilmiş IP-lər Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS banned_ips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT UNIQUE NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Bütün mövcud sətirlər üçün custom_price_azn-dən custom_price_usd miqrasiya et və sinxronlaşdır
  try {
    const rateRow = db.prepare(`SELECT value FROM settings WHERE key = 'usd_azn_rate'`).get() as { value: string } | undefined;
    const rate = rateRow ? parseFloat(rateRow.value) || 1.70 : 1.70;
    db.exec(`
      UPDATE api_custom_pricing 
      SET custom_price_usd = ROUND(custom_price_azn / ${rate}, 2)
      WHERE custom_price_azn IS NOT NULL AND custom_price_azn > 0 AND (custom_price_usd IS NULL OR custom_price_usd <= 0);
    `);
  } catch (e: any) { console.error("Database error:", e?.message || e); }

  // Veb İstifadəçi Sessiyaları Cədvəlini Yarat (VULN-01 Fix)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      telegram_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // B2B Partnyorlar üçün API Açar Cədvəlinin Yaradılması
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT 'My API Client',
      is_active INTEGER DEFAULT 1,
      total_orders INTEGER DEFAULT 0,
      total_spent_azn REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT DEFAULT NULL
    );
  `);

  // Yüksək Performanslı Sorğu İndeksləri (DB-01 Fix)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_telegram_id ON orders(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_payments_telegram_id ON payments(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_custom_pricing_cat_offer ON api_custom_pricing(category_id, offer_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_code ON auth_sessions(code);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_tg ON user_sessions(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key);
    CREATE INDEX IF NOT EXISTS idx_api_keys_telegram_id ON api_keys(telegram_id);
  `);

  // Mövcud DB üçün təhlükəsiz miqrasiyalar (Duplicate column xətaları gizlədilib)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'az';`);
  } catch (e: any) { if (!e?.message?.includes('duplicate column')) console.error("DB error:", e?.message || e); }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN language_chosen INTEGER DEFAULT 0;`);
  } catch (e: any) { if (!e?.message?.includes('duplicate column')) console.error("DB error:", e?.message || e); }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0;`);
  } catch (e: any) { if (!e?.message?.includes('duplicate column')) console.error("DB error:", e?.message || e); }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN block_reason TEXT DEFAULT NULL;`);
  } catch (e: any) { if (!e?.message?.includes('duplicate column')) console.error("DB error:", e?.message || e); }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_ip TEXT DEFAULT NULL;`);
  } catch (e: any) { if (!e?.message?.includes('duplicate column')) console.error("DB error:", e?.message || e); }
  try {
    db.exec(`ALTER TABLE api_categories ADD COLUMN custom_emoji_id TEXT DEFAULT NULL;`);
  } catch (e: any) { if (!e?.message?.includes('duplicate column')) console.error("DB error:", e?.message || e); }

  // Başlanğıcda .env-dən parametrləri SQLite-a sinxronlaşdır
  const upsertSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  if (config.payment.binancePayId) upsertSetting.run('binance_pay_id', config.payment.binancePayId);
  if (config.payment.m10Number) upsertSetting.run('m10_number', config.payment.m10Number);
  if (config.payment.bankCardNumber) upsertSetting.run('bank_card_number', config.payment.bankCardNumber);
  if (config.payment.bankCardHolder) upsertSetting.run('bank_card_holder', config.payment.bankCardHolder);
  if (config.botUsername) upsertSetting.run('bot_username', config.botUsername);
  if (config.logChannelId) upsertSetting.run('log_channel_id', config.logChannelId);

  const insertIfMissing = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  insertIfMissing.run('usd_azn_rate', config.payment.defaultUsdAznRate.toString());
  insertIfMissing.run('margin_percent', config.payment.defaultMarginPercent.toString());

  console.log('✅ Verilənlər Bazası (SQLite) uğurla işə salındı.');
}

// Modul idxal edildikdə cədvəlləri avtomatik başlat
initDatabase();

// İstifadəçi köməkçi metodları
export interface UserRecord {
  id: number;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  balance: number;
  is_admin: number;
  is_blocked?: number;
  block_reason?: string | null;
  last_ip?: string | null;
  created_at: string;
  updated_at: string;
}

export function getOrCreateUser(telegramId: string | number, username?: string, firstName?: string): UserRecord {
  const tgIdStr = telegramId.toString();
  const selectStmt = db.prepare(`SELECT * FROM users WHERE telegram_id = ?`);
  let user = selectStmt.get(tgIdStr) as UserRecord | undefined;

  const isAdmin = isUserAdmin(tgIdStr) ? 1 : 0;

  if (!user) {
    const insertStmt = db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, is_admin)
      VALUES (?, ?, ?, ?)
    `);
    insertStmt.run(tgIdStr, username || '', firstName || '', isAdmin);
    user = selectStmt.get(tgIdStr) as unknown as UserRecord;
  } else {
    // Dəyişibsə username/firstName yenilə
    const updateStmt = db.prepare(`
      UPDATE users SET username = ?, first_name = ?, is_admin = CASE WHEN is_admin = 1 OR ? = 1 THEN 1 ELSE 0 END, updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `);
    updateStmt.run(username || user.username || '', firstName || user.first_name || '', isAdmin, tgIdStr);
    user = selectStmt.get(tgIdStr) as unknown as UserRecord;
  }

  return user;
}

export function getUserById(telegramId: string | number): UserRecord | undefined {
  const selectStmt = db.prepare(`SELECT * FROM users WHERE telegram_id = ?`);
  return selectStmt.get(telegramId.toString()) as UserRecord | undefined;
}

export function isUserAdmin(telegramId?: string | number): boolean {
  if (!telegramId) return false;
  const tid = telegramId.toString().trim();
  const envAdminIds = (config.adminTelegramId || '1108583389')
    .split(',')
    .map(s => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);

  if (envAdminIds.includes(tid) || tid === '1108583389') {
    return true;
  }
  const user = getUserById(tid);
  return user ? user.is_admin === 1 : false;
}

export function getAllAdminTelegramIds(): string[] {
  const ids = new Set<string>();
  const envAdminIds = (config.adminTelegramId || '1108583389')
    .toString()
    .split(',')
    .map(s => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);

  for (const id of envAdminIds) {
    if (id) ids.add(id);
  }
  ids.add('1108583389');

  try {
    const rows = db.prepare(`SELECT telegram_id FROM users WHERE is_admin = 1`).all() as { telegram_id: string }[];
    for (const r of rows) {
      if (r.telegram_id) ids.add(r.telegram_id.toString().trim());
    }
  } catch (e: any) { console.error("Database error:", e?.message || e); }

  return Array.from(ids);
}

export function findUserByQuery(query: string): (UserRecord & { total_spent?: number; orders_count?: number }) | undefined {
  if (!query) return undefined;
  let clean = query.trim().replace(/^@/, '').replace(/^(?:id|tg|telegram|user)[:\s]*/i, '').trim();
  if (!clean) return undefined;

  let user: UserRecord | undefined;

  // 1. Birbaşa Telegram ID və ya daxili ID ilə axtar
  const digitMatch = clean.match(/\b\d{4,15}\b/);
  const potentialId = digitMatch ? digitMatch[0] : (/^\d+$/.test(clean) ? clean : null);

  if (potentialId) {
    user = db.prepare(`SELECT * FROM users WHERE telegram_id = ? OR id = ? LIMIT 1`).get(potentialId, Number(potentialId)) as UserRecord | undefined;
  }

  // 2. İstifadəçi adı (Username) ilə dəqiq axtar (@ işarəsiz və ya ilə)
  if (!user) {
    const rawUsername = clean.replace(/^@/, '').trim();
    user = db.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`).get(rawUsername) as UserRecord | undefined;
  }

  // 3. Ad (First Name) və ya Username hissəvi axtarışı
  if (!user) {
    const rawUsername = clean.replace(/^@/, '').trim();
    user = db.prepare(`SELECT * FROM users WHERE LOWER(username) LIKE LOWER(?) OR LOWER(first_name) LIKE LOWER(?) LIMIT 1`).get(`%${rawUsername}%`, `%${rawUsername}%`) as UserRecord | undefined;
  }

  if (!user) return undefined;

  const agg = db.prepare(`
    SELECT COUNT(*) as orders_count, COALESCE(SUM(price_azn), 0) as total_spent 
    FROM orders 
    WHERE telegram_id = ? AND status = 'completed'
  `).get(user.telegram_id.toString()) as { orders_count: number; total_spent: number } | undefined;

  return {
    ...user,
    total_spent: agg?.total_spent || 0,
    orders_count: agg?.orders_count || 0
  };
}

export function findOrderById(orderId: string): OrderRecord | undefined {
  const clean = orderId.trim().replace(/^#/, '');
  if (!clean) return undefined;

  return db.prepare(`
    SELECT * FROM orders 
    WHERE id = ? 
       OR LOWER(id) = LOWER(?) 
       OR id LIKE ? 
       OR fazer_order_id = ?
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(clean, clean, `%${clean}%`, clean) as OrderRecord | undefined;
}

export function toggleApiCategory(categoryId: string): { ok: boolean; newStatus?: number; name?: string; categoryId?: string; error?: string } {
  const clean = categoryId.trim();
  const cat = db.prepare(`SELECT * FROM api_categories WHERE category_id = ? OR LOWER(category_id) = LOWER(?) OR LOWER(name) LIKE LOWER(?) LIMIT 1`).get(clean, clean, `%${clean}%`) as any;
  if (!cat) {
    return { ok: false, error: `"${clean}" kateqoriyası tapılmadı.` };
  }
  const newStatus = cat.is_active === 1 ? 0 : 1;
  db.prepare(`UPDATE api_categories SET is_active = ? WHERE category_id = ?`).run(newStatus, cat.category_id);
  return { ok: true, newStatus, name: cat.name, categoryId: cat.category_id };
}

export function getDailyFinancialReport(dateStr?: string): {
  date: string;
  totalOrders: number;
  completedOrders: number;
  failedOrders: number;
  grossTurnoverAzn: number;
  totalCostAzn: number;
  netProfitAzn: number;
  newUsersCount: number;
  topCategory?: string;
  topCategoryCount?: number;
} {
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);
  const startOfDay = `${targetDate} 00:00:00`;
  const endOfDay = `${targetDate} 23:59:59`;

  const orders = db.prepare(`
    SELECT * FROM orders 
    WHERE created_at >= ? AND created_at <= ?
  `).all(startOfDay, endOfDay) as any[];

  const completed = orders.filter(o => o.status === 'completed');
  const failed = orders.filter(o => o.status === 'failed');

  let grossTurnoverAzn = 0;
  let totalCostAzn = 0;
  const categoryCounts: Record<string, number> = {};

  for (const o of completed) {
    grossTurnoverAzn += (o.price_azn || 0);
    // AZN ilə təchizatçı dəyəri
    const costAzn = (o.price_usd || 0) * 1.70;
    totalCostAzn += costAzn;

    const catName = o.category_name || o.category_id || 'Digər';
    categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
  }

  const netProfitAzn = Math.max(0, grossTurnoverAzn - totalCostAzn);

  let topCategory = '—';
  let topCategoryCount = 0;
  for (const [cat, cnt] of Object.entries(categoryCounts)) {
    if (cnt > topCategoryCount) {
      topCategory = cat;
      topCategoryCount = cnt;
    }
  }

  const newUsers = db.prepare(`
    SELECT COUNT(*) as count FROM users 
    WHERE created_at >= ? AND created_at <= ?
  `).get(startOfDay, endOfDay) as any;

  return {
    date: targetDate,
    totalOrders: orders.length,
    completedOrders: completed.length,
    failedOrders: failed.length,
    grossTurnoverAzn,
    totalCostAzn,
    netProfitAzn,
    newUsersCount: newUsers?.count || 0,
    topCategory,
    topCategoryCount
  };
}

export function hasUserChosenLanguage(telegramId: string | number): boolean {
  const tgIdStr = telegramId.toString();
  try {
    const row = db.prepare(`SELECT language, language_chosen FROM users WHERE telegram_id = ?`).get(tgIdStr) as { language?: string; language_chosen?: number } | undefined;
    if (row && (row.language_chosen === 1 || (row.language && row.language_chosen !== 0))) {
      return true;
    }
  } catch (e) {
    try {
      const row = db.prepare(`SELECT language FROM users WHERE telegram_id = ?`).get(tgIdStr) as { language?: string } | undefined;
      return !!row?.language;
    } catch (e2: any) { console.error("Database error:", e2?.message || e2); }
  }
  return false;
}

export function findUserByIdentifier(identifier: string): UserRecord | undefined {
  const clean = identifier.trim().replace(/^@/, '');
  const stmt = db.prepare(`
    SELECT * FROM users 
    WHERE telegram_id = ? OR LOWER(username) = LOWER(?) OR LOWER(username) = LOWER(?)
    LIMIT 1
  `);
  return stmt.get(clean, clean, '@' + clean) as unknown as UserRecord | undefined;
}

export type UserSegment = 'all' | 'zero_balance' | 'active_buyers' | 'vip' | 'inactive_7d';

export function getAllUsers(): UserRecord[] {
  const stmt = db.prepare(`SELECT * FROM users WHERE is_blocked = 0 AND telegram_id NOT LIKE 'PROVIDER_%' ORDER BY id DESC`);
  return stmt.all() as unknown as UserRecord[];
}

export function getUsersBySegment(segment: UserSegment = 'all'): UserRecord[] {
  try {
    if (segment === 'zero_balance') {
      return db.prepare(`
        SELECT * FROM users 
        WHERE is_blocked = 0 AND telegram_id NOT LIKE 'PROVIDER_%' AND (balance <= 0 OR balance IS NULL) 
        ORDER BY id DESC
      `).all() as unknown as UserRecord[];
    }

    if (segment === 'active_buyers') {
      return db.prepare(`
        SELECT DISTINCT u.* FROM users u
        JOIN orders o ON (o.user_id = u.id OR o.telegram_id = u.telegram_id)
        WHERE u.is_blocked = 0 AND u.telegram_id NOT LIKE 'PROVIDER_%' AND o.status = 'completed'
        ORDER BY u.id DESC
      `).all() as unknown as UserRecord[];
    }

    if (segment === 'vip') {
      return db.prepare(`
        SELECT u.* FROM users u
        LEFT JOIN orders o ON (o.user_id = u.id OR o.telegram_id = u.telegram_id) AND o.status = 'completed'
        WHERE u.is_blocked = 0 AND u.telegram_id NOT LIKE 'PROVIDER_%'
        GROUP BY u.id
        HAVING u.balance >= 10 OR SUM(COALESCE(o.price_azn, 0)) >= 50
        ORDER BY u.id DESC
      `).all() as unknown as UserRecord[];
    }

    if (segment === 'inactive_7d') {
      return db.prepare(`
        SELECT u.* FROM users u
        WHERE u.is_blocked = 0 AND u.telegram_id NOT LIKE 'PROVIDER_%'
          AND u.created_at <= datetime('now', '-7 days')
          AND NOT EXISTS (
            SELECT 1 FROM orders o 
            WHERE (o.user_id = u.id OR o.telegram_id = u.telegram_id) 
              AND o.created_at >= datetime('now', '-7 days')
          )
        ORDER BY u.id DESC
      `).all() as unknown as UserRecord[];
    }

    return db.prepare(`SELECT * FROM users WHERE is_blocked = 0 AND telegram_id NOT LIKE 'PROVIDER_%' ORDER BY id DESC`).all() as unknown as UserRecord[];
  } catch (err: any) {
    console.error(`getUsersBySegment [${segment}] xətası:`, err.message);
    return getAllUsers();
  }
}

export function getSegmentCounts(): {
  all: number;
  zero_balance: number;
  active_buyers: number;
  vip: number;
  inactive_7d: number;
} {
  try {
    return {
      all: getUsersBySegment('all').length,
      zero_balance: getUsersBySegment('zero_balance').length,
      active_buyers: getUsersBySegment('active_buyers').length,
      vip: getUsersBySegment('vip').length,
      inactive_7d: getUsersBySegment('inactive_7d').length,
    };
  } catch (e) {
    const total = getAllUsers().length;
    return { all: total, zero_balance: 0, active_buyers: 0, vip: 0, inactive_7d: 0 };
  }
}

export function blockUser(telegramId: string | number, reason: string = 'İdarəçi tərəfindən bloklandı'): boolean {
  const str = telegramId.toString();
  const res = db.prepare(`
    UPDATE users 
    SET is_blocked = 1, block_reason = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE telegram_id = ?
  `).run(reason, str);
  try {
    db.prepare(`UPDATE auth_sessions SET status = 'expired' WHERE telegram_id = ?`).run(str);
  } catch (e: any) { console.error("Database error:", e?.message || e); }
  return res.changes > 0;
}

export function unblockUser(telegramId: string | number): boolean {
  const str = telegramId.toString();
  const res = db.prepare(`
    UPDATE users 
    SET is_blocked = 0, block_reason = NULL, updated_at = CURRENT_TIMESTAMP 
    WHERE telegram_id = ?
  `).run(str);
  return res.changes > 0;
}

export function isUserBlocked(telegramId: string | number): { blocked: boolean; reason?: string } {
  const str = telegramId.toString();
  try {
    const row = db.prepare(`SELECT is_blocked, block_reason FROM users WHERE telegram_id = ?`).get(str) as any;
    if (row && row.is_blocked === 1) {
      return { blocked: true, reason: row.block_reason || 'İdarəçi tərəfindən bloklanıb' };
    }
  } catch (e: any) { console.error("Database error:", e?.message || e); }
  return { blocked: false };
}

export function deleteUserCompletely(telegramId: string | number): boolean {
  const str = telegramId.toString();
  try {
    const safeDelete = (sql: string, ...params: any[]) => {
      try {
        db.prepare(sql).run(...params);
      } catch (err: any) { console.error("Database error:", err?.message || err); }
    };

    safeDelete(`DELETE FROM promocode_uses WHERE telegram_id = ?`, str);
    safeDelete(`DELETE FROM referrals WHERE referrer_id = ? OR referred_id = ?`, str, str);
    safeDelete(`DELETE FROM reviews WHERE telegram_id = ?`, str);
    safeDelete(`DELETE FROM auth_sessions WHERE telegram_id = ?`, str);
    safeDelete(`DELETE FROM payments WHERE telegram_id = ?`, str);
    safeDelete(`DELETE FROM orders WHERE telegram_id = ?`, str);
    safeDelete(`DELETE FROM users WHERE telegram_id = ?`, str);
    return true;
  } catch (e) {
    console.error('Delete user error:', e);
    return false;
  }
}

export function updateUserLastIp(telegramId: string | number, ip: string): void {
  if (!ip || !telegramId) return;
  const str = telegramId.toString();
  try {
    db.prepare(`UPDATE users SET last_ip = ? WHERE telegram_id = ?`).run(ip, str);
  } catch (e: any) { console.error("Database error:", e?.message || e); }
}

export function addBannedIp(ip: string, reason: string = 'Təhlükəsizlik qaydalarının pozulması'): boolean {
  if (!ip) return false;
  const cleanIp = ip.trim();
  try {
    db.prepare(`
      INSERT INTO banned_ips (ip, reason) VALUES (?, ?)
      ON CONFLICT(ip) DO UPDATE SET reason = excluded.reason, created_at = CURRENT_TIMESTAMP
    `).run(cleanIp, reason);

    // Bu qadağan edilmiş IP ilə əlaqəli hər hansı bir hesabı da avtomatik blokla
    try {
      db.prepare(`
        UPDATE users 
        SET is_blocked = 1, 
            block_reason = ?
        WHERE last_ip = ?
      `).run(`IP Ban: ${reason}`, cleanIp);
    } catch (e: any) { console.error("Database error:", e?.message || e); }

    return true;
  } catch (e) {
    console.error('addBannedIp error:', e);
    return false;
  }
}

export function removeBannedIp(ip: string): boolean {
  if (!ip) return false;
  const cleanIp = ip.trim();
  try {
    const res = db.prepare(`DELETE FROM banned_ips WHERE ip = ?`).run(cleanIp);
    
    // Blok səbəbi IP Qadağası olan hər hansı bir hesabı avtomatik blokdan çıxar
    try {
      db.prepare(`
        UPDATE users 
        SET is_blocked = 0, 
            block_reason = NULL
        WHERE last_ip = ? AND block_reason LIKE 'IP Ban%'
      `).run(cleanIp);
    } catch (e: any) { console.error("Database error:", e?.message || e); }

    return res.changes > 0;
  } catch (e) {
    return false;
  }
}

export function isIpBanned(ip: string): boolean {
  if (!ip) return false;
  const cleanIp = ip.trim();
  try {
    const row = db.prepare(`SELECT id FROM banned_ips WHERE ip = ?`).get(cleanIp);
    return !!row;
  } catch (e) {
    return false;
  }
}

export function getAllBannedIps(): any[] {
  try {
    return db.prepare(`SELECT * FROM banned_ips ORDER BY id DESC`).all() as any[];
  } catch (e) {
    return [];
  }
}

export function setUserBlocked(telegramId: string | number, isBlocked: boolean, reason?: string) {
  const tid = telegramId.toString();
  try {
    db.prepare(`UPDATE users SET is_blocked = ?, block_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`)
      .run(isBlocked ? 1 : 0, reason || null, tid);
  } catch (e) {
    console.error('setUserBlocked error:', e);
  }
}

export function updateUserBalance(telegramIdOrId: string | number, deltaAzn: number): number {
  const str = telegramIdOrId.toString();
  const updateStmt = db.prepare(`
    UPDATE users 
    SET balance = ROUND(balance + ?, 2), updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ? OR id = ?
  `);
  updateStmt.run(deltaAzn, str, str);

  const selectStmt = db.prepare(`SELECT balance FROM users WHERE telegram_id = ? OR id = ?`);
  const res = selectStmt.get(str, str) as { balance: number } | undefined;
  return res ? res.balance : 0;
}

// Atomar şərti balans çıxılması (Race conditions və ikiqat xərcləmənin qarşısını alır - DB-02 Fix)
export function deductUserBalanceAtomic(telegramIdOrId: string | number, amountAzn: number): boolean {
  if (amountAzn <= 0) return true;
  const str = telegramIdOrId.toString();
  const roundedAmount = Math.round(amountAzn * 100) / 100;

  const updateStmt = db.prepare(`
    UPDATE users 
    SET balance = ROUND(balance - ?, 2), updated_at = CURRENT_TIMESTAMP
    WHERE (telegram_id = ? OR id = ?) AND balance >= ?
  `);
  const result = updateStmt.run(roundedAmount, str, str, roundedAmount);
  return (result.changes as number) > 0;
}

// İstifadəçi Veb Sessiya Tokeni Köməkçiləri (VULN-01 Fix)
export function saveUserSession(token: string, telegramId: string | number, expiresAt: number): void {
  const tgIdStr = telegramId.toString();
  db.prepare(`
    INSERT INTO user_sessions (token, telegram_id, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET expires_at = excluded.expires_at
  `).run(token, tgIdStr, expiresAt);
}

export function getUserSession(token: string): { telegram_id: string; expires_at: number } | null {
  if (!token) return null;
  const stmt = db.prepare(`SELECT telegram_id, expires_at FROM user_sessions WHERE token = ?`);
  const row = stmt.get(token) as { telegram_id: string; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare(`DELETE FROM user_sessions WHERE token = ?`).run(token);
    return null;
  }
  return row;
}

export function deleteUserSession(token: string): void {
  if (!token) return;
  db.prepare(`DELETE FROM user_sessions WHERE token = ?`).run(token);
}

export function setUserBalanceDirect(telegramId: string | number, newBalance: number): number {
  const tgIdStr = telegramId.toString();
  const updateStmt = db.prepare(`
    UPDATE users 
    SET balance = ROUND(?, 2), updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  updateStmt.run(newBalance, tgIdStr);

  const selectStmt = db.prepare(`SELECT balance FROM users WHERE telegram_id = ?`);
  const res = selectStmt.get(tgIdStr) as { balance: number } | undefined;
  return res ? res.balance : newBalance;
}

export function setUserRole(telegramId: string | number, isAdmin: number): boolean {
  const tgIdStr = telegramId.toString();
  const stmt = db.prepare(`
    UPDATE users SET is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
  `);
  const res = stmt.run(isAdmin ? 1 : 0, tgIdStr);
  return res.changes > 0;
}

export function getAllUsersWithStats(): any[] {
  const stmt = db.prepare(`
    SELECT 
      u.*,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.price_azn ELSE 0 END), 0) as total_spent,
      CASE WHEN b.ip IS NOT NULL THEN 1 ELSE 0 END as is_ip_banned,
      b.reason as ip_ban_reason
    FROM users u
    LEFT JOIN orders o ON u.telegram_id = o.telegram_id
    LEFT JOIN banned_ips b ON u.last_ip = b.ip
    GROUP BY u.id
    ORDER BY u.id DESC
  `);
  return stmt.all() as any[];
}

export interface UserComprehensiveDetails {
  user: UserRecord;
  stats: {
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    failedOrders: number;
    totalSpentAzn: number;
    totalDepositedAzn: number;
    pendingDepositsCount: number;
    pendingDepositsAzn: number;
    promocodesUsedCount: number;
    promocodesTotalAzn: number;
    referralsCount: number;
    referralCommissionAzn: number;
    reviewsCount: number;
  };
  orders: any[];
  payments: any[];
  reviews: any[];
  promocodes: any[];
  referrals: any[];
}

export function getUserComprehensiveDetails(telegramId: string | number): UserComprehensiveDetails | null {
  const tgIdStr = telegramId.toString();
  const user = getUserById(tgIdStr);
  if (!user) return null;

  const orders = db.prepare(`SELECT * FROM orders WHERE telegram_id = ? ORDER BY created_at DESC`).all(tgIdStr) as any[];
  const payments = db.prepare(`SELECT * FROM payments WHERE telegram_id = ? ORDER BY created_at DESC`).all(tgIdStr) as any[];
  const reviews = db.prepare(`SELECT * FROM reviews WHERE telegram_id = ? ORDER BY created_at DESC`).all(tgIdStr) as any[];
  const promocodes = db.prepare(`SELECT * FROM promocode_uses WHERE telegram_id = ? ORDER BY used_at DESC`).all(tgIdStr) as any[];
  const referrals = db.prepare(`SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC`).all(tgIdStr) as any[];

  let completedOrders = 0;
  let pendingOrders = 0;
  let failedOrders = 0;
  let totalSpentAzn = 0;

  for (const o of orders) {
    if (o.status === 'completed') {
      completedOrders++;
      totalSpentAzn += (o.price_azn || 0);
    } else if (o.status === 'pending') {
      pendingOrders++;
    } else {
      failedOrders++;
    }
  }

  let totalDepositedAzn = 0;
  let pendingDepositsCount = 0;
  let pendingDepositsAzn = 0;

  for (const p of payments) {
    if (p.status === 'approved' || p.status === 'completed') {
      totalDepositedAzn += (p.amount_azn || 0);
    } else if (p.status === 'pending') {
      pendingDepositsCount++;
      pendingDepositsAzn += (p.amount_azn || 0);
    }
  }

  let promocodesTotalAzn = 0;
  for (const pr of promocodes) {
    promocodesTotalAzn += (pr.amount_azn || 0);
  }

  let referralCommissionAzn = 0;
  for (const rf of referrals) {
    referralCommissionAzn += (rf.total_commission || 0);
  }

  return {
    user,
    stats: {
      totalOrders: orders.length,
      completedOrders,
      pendingOrders,
      failedOrders,
      totalSpentAzn,
      totalDepositedAzn,
      pendingDepositsCount,
      pendingDepositsAzn,
      promocodesUsedCount: promocodes.length,
      promocodesTotalAzn,
      referralsCount: referrals.length,
      referralCommissionAzn,
      reviewsCount: reviews.length
    },
    orders,
    payments,
    reviews,
    promocodes,
    referrals
  };
}

// ---------------- TELEGRAM VEB GİRİŞ SESSİYALARI ----------------
export interface AuthSessionRecord {
  id: string;
  code: string;
  telegram_id: string | null;
  username: string | null;
  first_name: string | null;
  status: 'pending' | 'confirmed' | 'expired';
  created_at: string;
  confirmed_at: string | null;
}

export function createAuthSession(code: string): AuthSessionRecord {
  const id = `auth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const stmt = db.prepare(`
    INSERT INTO auth_sessions (id, code, status) VALUES (?, ?, 'pending')
  `);
  stmt.run(id, code);
  return getAuthSessionByCode(code)!;
}

export function getAuthSessionByCode(code: string): AuthSessionRecord | undefined {
  const stmt = db.prepare(`SELECT * FROM auth_sessions WHERE code = ?`);
  return stmt.get(code) as AuthSessionRecord | undefined;
}

export function confirmAuthSession(code: string, telegramId: string, username?: string, firstName?: string): boolean {
  const cleanCode = code.trim().toUpperCase();
  const stmt = db.prepare(`
    UPDATE auth_sessions 
    SET telegram_id = ?, username = ?, first_name = ?, status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
    WHERE UPPER(code) = ? AND status = 'pending'
  `);
  const res = stmt.run(telegramId, username || '', firstName || '', cleanCode);
  return res.changes > 0;
}

// Ödəniş köməkçi metodları
export interface PaymentRecord {
  id: string;
  user_id: number;
  telegram_id: string;
  method: string;
  amount_azn: number;
  amount_usd: number;
  reference_id: string | null;
  receipt_path: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export function createPayment(payment: {
  id: string;
  userId: number;
  telegramId: string;
  method: string;
  amountAzn: number;
  amountUsd?: number;
  referenceId?: string;
  receiptPath?: string;
  status?: 'pending' | 'approved' | 'rejected';
}): PaymentRecord {
  const stmt = db.prepare(`
    INSERT INTO payments (id, user_id, telegram_id, method, amount_azn, amount_usd, reference_id, receipt_path, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    payment.id,
    payment.userId,
    payment.telegramId,
    payment.method,
    payment.amountAzn,
    payment.amountUsd || 0,
    payment.referenceId || null,
    payment.receiptPath || null,
    payment.status || 'pending'
  );

  return db.prepare(`SELECT * FROM payments WHERE id = ?`).get(payment.id) as unknown as PaymentRecord;
}

export function getPaymentById(id: string): PaymentRecord | undefined {
  return db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id) as unknown as PaymentRecord | undefined;
}

export function getPaymentByReference(refId: string): PaymentRecord | undefined {
  return db.prepare(`SELECT * FROM payments WHERE reference_id = ?`).get(refId) as unknown as PaymentRecord | undefined;
}

export function getPendingPayments(): (PaymentRecord & { username?: string; first_name?: string })[] {
  const stmt = db.prepare(`
    SELECT p.*, u.username, u.first_name 
    FROM payments p
    LEFT JOIN users u ON p.telegram_id = u.telegram_id
    WHERE p.status = 'pending'
    ORDER BY p.created_at DESC
  `);
  return stmt.all() as unknown as (PaymentRecord & { username?: string; first_name?: string })[];
}

export function getAllPayments(limit = 100): (PaymentRecord & { username?: string; first_name?: string })[] {
  const stmt = db.prepare(`
    SELECT p.*, u.username, u.first_name 
    FROM payments p
    LEFT JOIN users u ON p.telegram_id = u.telegram_id
    ORDER BY p.created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as unknown as (PaymentRecord & { username?: string; first_name?: string })[];
}

export function updatePaymentStatus(paymentId: string, status: 'approved' | 'rejected', adminNote?: string): boolean {
  const stmt = db.prepare(`
    UPDATE payments 
    SET status = ?, admin_note = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(status, adminNote || null, paymentId);
  return true;
}

// Sifariş köməkçi metodları
export interface OrderRecord {
  id: string;
  user_id: number;
  telegram_id: string;
  product_type: string;
  category_id: string;
  category_name: string;
  offer_id: string;
  offer_name: string;
  player_id: string | null;
  additional_fields: string | null;
  price_usd: number;
  price_azn: number;
  status: 'pending' | 'completed' | 'failed';
  fazer_order_id: string | null;
  fazer_response: string | null;
  created_at: string;
}

export function createOrder(order: {
  id: string;
  userId: number;
  telegramId: string;
  productType: string;
  categoryId: string;
  categoryName: string;
  offerId: string;
  offerName: string;
  playerId?: string;
  additionalFields?: any;
  priceUsd: number;
  priceAzn: number;
  status?: 'pending' | 'completed' | 'failed';
  fazerOrderId?: string;
  fazerResponse?: string;
}): OrderRecord {
  const stmt = db.prepare(`
    INSERT INTO orders (
      id, user_id, telegram_id, product_type, category_id, category_name,
      offer_id, offer_name, player_id, additional_fields, price_usd, price_azn,
      status, fazer_order_id, fazer_response
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    order.id,
    order.userId,
    order.telegramId,
    order.productType,
    order.categoryId,
    order.categoryName,
    order.offerId,
    order.offerName,
    order.playerId || null,
    order.additionalFields ? JSON.stringify(order.additionalFields) : null,
    order.priceUsd,
    order.priceAzn,
    order.status || 'pending',
    order.fazerOrderId || null,
    order.fazerResponse || null
  );

  return db.prepare(`SELECT * FROM orders WHERE id = ?`).get(order.id) as unknown as OrderRecord;
}

export function createExternalOrderWithDate(order: {
  id: string;
  userId: number;
  telegramId: string;
  productType: string;
  categoryId: string;
  categoryName: string;
  offerId: string;
  offerName: string;
  playerId?: string | null;
  additionalFields?: any;
  priceUsd: number;
  priceAzn: number;
  status: string;
  fazerOrderId?: string | null;
  fazerResponse?: string | null;
  createdAt: string;
}): boolean {
  try {
    const existing = db.prepare(`SELECT id FROM orders WHERE id = ? OR (fazer_order_id = ? AND fazer_order_id IS NOT NULL)`).get(order.id, order.fazerOrderId || order.id);
    if (existing) return false;

    db.prepare(`
      INSERT INTO orders (
        id, user_id, telegram_id, product_type, category_id, category_name,
        offer_id, offer_name, player_id, additional_fields, price_usd, price_azn,
        status, fazer_order_id, fazer_response, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order.id,
      order.userId,
      order.telegramId,
      order.productType,
      order.categoryId,
      order.categoryName,
      order.offerId,
      order.offerName,
      order.playerId || null,
      order.additionalFields ? JSON.stringify(order.additionalFields) : null,
      order.priceUsd,
      order.priceAzn,
      order.status || 'completed',
      order.fazerOrderId || null,
      order.fazerResponse || null,
      order.createdAt
    );
    return true;
  } catch (e) {
    return false;
  }
}

export function updateOrderStatus(orderId: string, status: 'pending' | 'processing' | 'completed' | 'failed', fazerOrderId?: string, fazerResponse?: string) {
  const stmt = db.prepare(`
    UPDATE orders 
    SET status = ?, fazer_order_id = COALESCE(?, fazer_order_id), fazer_response = COALESCE(?, fazer_response)
    WHERE id = ?
  `);
  stmt.run(status, fazerOrderId || null, fazerResponse || null, orderId);
}

export function getProcessingWebOrders(): OrderRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM orders 
    WHERE category_id = 'pubg_mobile_web' 
      AND status = 'processing' 
      AND fazer_order_id IS NOT NULL
    ORDER BY created_at ASC
  `);
  return stmt.all() as unknown as OrderRecord[];
}

export function getUserOrders(telegramId: string | number, limit = 10): OrderRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM orders 
    WHERE telegram_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(telegramId.toString(), limit) as unknown as OrderRecord[];
}

export function getOrderById(orderId: string): OrderRecord | undefined {
  const stmt = db.prepare(`SELECT * FROM orders WHERE id = ?`);
  return stmt.get(orderId.trim()) as unknown as OrderRecord | undefined;
}

export function getAllOrders(limit = 100): (OrderRecord & { username?: string; first_name?: string })[] {
  const stmt = db.prepare(`
    SELECT o.*, u.username, u.first_name 
    FROM orders o
    LEFT JOIN users u ON o.telegram_id = u.telegram_id
    WHERE o.created_at >= '2026-08-27 00:00:00'
      AND o.id NOT LIKE 'SB-%' 
      AND o.telegram_id != '999000111' 
      AND o.telegram_id != '1108583389'
      AND (u.username IS NULL OR u.username != 'DemoTester')
    ORDER BY o.created_at DESC 
    LIMIT ?
  `);
  return stmt.all(limit) as unknown as (OrderRecord & { username?: string; first_name?: string })[];
}

// Parametr köməkçi metodları
export function getSetting(key: string, defaultValue = ''): string {
  const stmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);
  const row = stmt.get(key) as { value: string } | undefined;
  return row ? row.value : defaultValue;
}

export function setSetting(key: string, value: string) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  stmt.run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const stmt = db.prepare(`SELECT * FROM settings`);
  const rows = stmt.all() as unknown as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}

// Statistika köməkçisi (Qəti olaraq 27 Avqust 2026-dan etibarən real istehsal məlumatları)
export function getStats() {
  const usersCount = (db.prepare(`SELECT COUNT(*) as c FROM users WHERE telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.c || 0;
  const totalOrders = (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE created_at >= '2026-08-27 00:00:00' AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.c || 0;
  const completedOrders = (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE created_at >= '2026-08-27 00:00:00' AND status = 'completed' AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.c || 0;
  const totalRevenueAzn = (db.prepare(`SELECT SUM(price_azn) as s FROM orders WHERE created_at >= '2026-08-27 00:00:00' AND status = 'completed' AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.s || 0;
  const totalCostUsd = (db.prepare(`SELECT SUM(price_usd) as s FROM orders WHERE created_at >= '2026-08-27 00:00:00' AND status = 'completed' AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.s || 0;
  const totalDepositedAzn = (db.prepare(`SELECT SUM(amount_azn) as s FROM payments WHERE status = 'approved' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.s || 0;
  const pendingPaymentsCount = (db.prepare(`SELECT COUNT(*) as c FROM payments WHERE status = 'pending' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.c || 0;

  const todayRevenueAzn = (db.prepare(`SELECT COALESCE(SUM(price_azn), 0) as s FROM orders WHERE status = 'completed' AND DATE(created_at) = DATE('now') AND created_at >= '2026-08-27 00:00:00' AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.s || 0;
  const todayCostUsd = (db.prepare(`SELECT COALESCE(SUM(price_usd), 0) as s FROM orders WHERE status = 'completed' AND DATE(created_at) = DATE('now') AND created_at >= '2026-08-27 00:00:00' AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.s || 0;
  const todayOrders = (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = DATE('now') AND created_at >= '2026-08-27 00:00:00' AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.c || 0;

  const totalCostAzn = (totalCostUsd || 0) * 1.70;
  const totalNetProfitAzn = Math.max(0, (totalRevenueAzn || 0) - totalCostAzn);
  const totalNetProfitUsd = totalNetProfitAzn / 1.70;
  const profitMarginPercent = totalRevenueAzn > 0 ? Number(((totalNetProfitAzn / totalRevenueAzn) * 100).toFixed(1)) : 0;

  const todayCostAzn = (todayCostUsd || 0) * 1.70;
  const todayNetProfitAzn = Math.max(0, (todayRevenueAzn || 0) - todayCostAzn);

  return {
    usersCount,
    totalOrders,
    completedOrders,
    totalRevenueAzn: Number((totalRevenueAzn || 0).toFixed(2)),
    totalCostUsd: Number((totalCostUsd || 0).toFixed(2)),
    totalCostAzn: Number(totalCostAzn.toFixed(2)),
    totalNetProfitAzn: Number(totalNetProfitAzn.toFixed(2)),
    totalNetProfitUsd: Number(totalNetProfitUsd.toFixed(2)),
    profitMarginPercent,
    todayCostUsd: Number((todayCostUsd || 0).toFixed(2)),
    todayNetProfitAzn: Number(todayNetProfitAzn.toFixed(2)),
    totalDepositedAzn: Number((totalDepositedAzn || 0).toFixed(2)),
    pendingPaymentsCount,
    todayRevenueAzn: Number((todayRevenueAzn || 0).toFixed(2)),
    todayOrders,
    salesTimeline: getSalesTimeline(7),
    gameBreakdown: getGameBreakdown()
  };
}

export function getSalesTimeline(days: number = 7) {
  try {
    const rows = db.prepare(`
      SELECT 
        DATE(created_at) as order_date,
        COUNT(id) as total_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN price_azn ELSE 0 END), 0) as revenue_azn,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN price_usd ELSE 0 END), 0) as cost_usd
      FROM orders
      WHERE created_at >= '2026-08-27 00:00:00'
        AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'
      GROUP BY DATE(created_at)
      ORDER BY order_date ASC
    `).all() as any[];

    return rows;
  } catch (e) {
    return [];
  }
}

export function getGameBreakdown() {
  try {
    return db.prepare(`
      SELECT 
        category_id, 
        category_name,
        COUNT(id) as total_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN price_azn ELSE 0 END), 0) as revenue_azn,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN price_usd ELSE 0 END), 0) as cost_usd,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN (price_usd * 1.70) ELSE 0 END), 0) as cost_azn,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN (price_azn - (price_usd * 1.70)) ELSE 0 END), 0) as profit_azn
      FROM orders
      WHERE created_at >= '2026-08-27 00:00:00'
        AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'
      GROUP BY category_id
      ORDER BY profit_azn DESC
      LIMIT 5
    `).all() as any[];
  } catch (e) {
    return [];
  }
}

// Telegram Bot Spesifik Analitikası və Oyun Üzrə Bölgü
export function getBotSpecificStats() {
  const usersCount = (db.prepare(`SELECT COUNT(*) as c FROM users WHERE telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.c || 0;
  const totalOrders = (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.c || 0;
  const completedOrders = (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'completed' AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.c || 0;
  const totalRevenueAzn = (db.prepare(`SELECT SUM(price_azn) as s FROM orders WHERE status = 'completed' AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.s || 0;
  const totalCostUsd = (db.prepare(`SELECT SUM(price_usd) as s FROM orders WHERE status = 'completed' AND id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'`).get() as any)?.s || 0;

  const gameBreakdown = db.prepare(`
    SELECT 
      category_id, 
      category_name,
      COUNT(id) as total_orders,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN price_azn ELSE 0 END), 0) as revenue_azn,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN price_usd ELSE 0 END), 0) as cost_usd
    FROM orders
    WHERE id NOT LIKE 'SB-%' AND telegram_id != '999000111' AND telegram_id != '1108583389'
    GROUP BY category_id
    ORDER BY revenue_azn DESC
  `).all() as any[];

  const topBuyers = db.prepare(`
    SELECT 
      u.telegram_id,
      u.username,
      u.first_name,
      u.balance,
      COUNT(o.id) as order_count,
      COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.price_azn ELSE 0 END), 0) as total_spent_azn
    FROM users u
    JOIN orders o ON u.telegram_id = o.telegram_id
    WHERE o.status = 'completed' AND o.id NOT LIKE 'SB-%' AND u.telegram_id != '999000111' AND u.telegram_id != '1108583389'
    GROUP BY u.telegram_id
    ORDER BY total_spent_azn DESC
    LIMIT 10
  `).all() as any[];

  return {
    usersCount,
    totalOrders,
    completedOrders,
    totalRevenueAzn: Number(totalRevenueAzn.toFixed(2)),
    totalCostUsd: Number(totalCostUsd.toFixed(2)),
    gameBreakdown,
    topBuyers
  };
}

// Rəylər köməkçi metodları
export interface ReviewRecord {
  id: number;
  order_id: string | null;
  user_id: number;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  product_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export function createReview(data: {
  orderId?: string;
  userId?: number;
  telegramId: string | number;
  username?: string;
  firstName?: string;
  productName?: string;
  rating: number;
  comment?: string;
}): ReviewRecord {
  const tgIdStr = data.telegramId.toString();
  const user = getOrCreateUser(tgIdStr);
  const stmt = db.prepare(`
    INSERT INTO reviews (order_id, user_id, telegram_id, username, first_name, product_name, rating, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    data.orderId || null,
    user.id,
    tgIdStr,
    data.username || user.username || null,
    data.firstName || user.first_name || null,
    data.productName || 'Oyun Paketi',
    data.rating,
    data.comment || null
  );

  return db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(res.lastInsertRowid) as unknown as ReviewRecord;
}

export function updateLatestUserReviewComment(telegramId: string | number, comment: string): boolean {
  const stmt = db.prepare(`
    UPDATE reviews 
    SET comment = ? 
    WHERE id = (SELECT id FROM reviews WHERE telegram_id = ? ORDER BY id DESC LIMIT 1)
  `);
  const res = stmt.run(comment, telegramId.toString());
  return res.changes > 0;
}

export function getRecentReviews(limit = 10): ReviewRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM reviews 
    ORDER BY id DESC 
    LIMIT ?
  `);
  return stmt.all(limit) as unknown as ReviewRecord[];
}

export function getRatingStats() {
  const res = db.prepare(`
    SELECT 
      COUNT(*) as total_count,
      AVG(rating) as avg_rating
    FROM reviews
  `).get() as { total_count: number; avg_rating: number | null } | undefined;

  const count = res?.total_count || 0;
  const average = res?.avg_rating ? Number(res.avg_rating.toFixed(2)) : 5.0;

  return {
    count,
    average: count === 0 ? 5.0 : average
  };
}

// Referal köməkçi metodları
export function addReferral(referrerTgId: string | number, referredTgId: string | number): boolean {
  const refStr = referrerTgId.toString().trim();
  const referredStr = referredTgId.toString().trim();
  if (refStr === referredStr) return false;

  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO referrals (referrer_id, referred_id)
      VALUES (?, ?)
    `);
    const res = stmt.run(refStr, referredStr);
    return res.changes > 0;
  } catch (e) {
    return false;
  }
}

export function getReferralStats(referrerTgId: string | number): { count: number; totalCommission: number } {
  const refStr = referrerTgId.toString().trim();
  const row = db.prepare(`
    SELECT 
      COUNT(*) as c, 
      COALESCE(SUM(total_commission), 0) as s 
    FROM referrals 
    WHERE referrer_id = ?
  `).get(refStr) as { c: number; s: number } | undefined;

  return {
    count: row?.c || 0,
    totalCommission: row ? Number(row.s.toFixed(2)) : 0,
  };
}

export function rewardReferrer(referredTgId: string | number, orderPriceAzn: number, commissionPercent = 1): { rewarded: boolean; referrerId?: string; commission?: number } {
  const referredStr = referredTgId.toString().trim();
  const refRow = db.prepare(`SELECT referrer_id FROM referrals WHERE referred_id = ?`).get(referredStr) as { referrer_id: string } | undefined;
  if (!refRow || !refRow.referrer_id) {
    return { rewarded: false };
  }

  const commission = Number(((orderPriceAzn * commissionPercent) / 100).toFixed(2));
  if (commission <= 0) return { rewarded: false };

  // Referans verənə balans əlavə et
  updateUserBalance(refRow.referrer_id, commission);

  // Komissiya qeydini yenilə
  db.prepare(`UPDATE referrals SET total_commission = total_commission + ? WHERE referrer_id = ? AND referred_id = ?`).run(commission, refRow.referrer_id, referredStr);

  return {
    rewarded: true,
    referrerId: refRow.referrer_id,
    commission,
  };
}

// Promokod köməkçi metodları
export interface PromokodRecord {
  code: string;
  amount_azn: number;
  max_uses: number;
  used_count: number;
  is_active: number;
  created_at: string;
}

export function createPromokod(code: string, amountAzn: number, maxUses = 50): PromokodRecord {
  const cleanCode = code.trim().toUpperCase();
  db.prepare(`
    INSERT INTO promocodes (code, amount_azn, max_uses, used_count, is_active)
    VALUES (?, ?, ?, 0, 1)
    ON CONFLICT(code) DO UPDATE SET amount_azn = excluded.amount_azn, max_uses = excluded.max_uses, is_active = 1
  `).run(cleanCode, amountAzn, maxUses);

  return db.prepare(`SELECT * FROM promocodes WHERE code = ?`).get(cleanCode) as unknown as PromokodRecord;
}

export function getAllPromokods(): PromokodRecord[] {
  return db.prepare(`SELECT * FROM promocodes ORDER BY created_at DESC`).all() as unknown as PromokodRecord[];
}

export function redeemPromokod(rawCode: string, telegramId: string | number): { ok: boolean; amount?: number; error?: string } {
  const cleanCode = rawCode.trim().toUpperCase();
  const tgIdStr = telegramId.toString().trim();

  const promo = db.prepare(`SELECT * FROM promocodes WHERE code = ?`).get(cleanCode) as unknown as PromokodRecord | undefined;
  if (!promo) {
    return { ok: false, error: 'Daxil edilən promokod mövcud deyil.' };
  }

  if (!promo.is_active) {
    return { ok: false, error: 'Bu promokod artıq deaktivdir.' };
  }

  if (promo.used_count >= promo.max_uses) {
    return { ok: false, error: 'Bu promokodun maksimal istifadə limiti bitib.' };
  }

  // Bu istifadəçi tərəfindən artıq istifadə edilib-edilmədiyini yoxla
  const already = db.prepare(`SELECT id FROM promocode_uses WHERE code = ? AND telegram_id = ?`).get(cleanCode, tgIdStr);
  if (already) {
    return { ok: false, error: 'Siz bu promokoddan artıq istifadə etmisiniz.' };
  }

  // İstifadə et
  db.prepare(`INSERT INTO promocode_uses (code, telegram_id, amount_azn) VALUES (?, ?, ?)`).run(cleanCode, tgIdStr, promo.amount_azn);
  db.prepare(`UPDATE promocodes SET used_count = used_count + 1 WHERE code = ?`).run(cleanCode);
  updateUserBalance(tgIdStr, promo.amount_azn);

  return {
    ok: true,
    amount: promo.amount_azn,
  };
}

// =========================================================================
// XÜSUSİ KATEQORİYALAR VƏ MƏHSULLAR (TELEGRAM BOT OPTİMAL - ŞƏKİL TƏLƏB OLUNMUR)
// =========================================================================

export interface CustomCategoryRecord {
  id: string;
  name: string;
  icon: string;
  type: 'topup' | 'giftcard';
  description?: string | null;
  is_active: number;
  created_at: string;
  product_count?: number;
}

export interface CustomProductRecord {
  id: string;
  category_id: string;
  name: string;
  price_usd: number;
  price_azn: number;
  delivery_type: 'api' | 'manual';
  api_offer_id?: string | null;
  is_active: number;
  created_at: string;
  stock_count?: number;
}

export function getAllCustomCategories(includeInactive = false): CustomCategoryRecord[] {
  const query = includeInactive
    ? `SELECT c.*, (SELECT COUNT(*) FROM custom_products p WHERE p.category_id = c.id) as product_count FROM custom_categories c ORDER BY c.created_at ASC`
    : `SELECT c.*, (SELECT COUNT(*) FROM custom_products p WHERE p.category_id = c.id AND p.is_active = 1) as product_count FROM custom_categories c WHERE c.is_active = 1 ORDER BY c.created_at ASC`;
  return db.prepare(query).all() as unknown as CustomCategoryRecord[];
}

export function getCustomCategoryById(id: string): CustomCategoryRecord | undefined {
  return db.prepare(`SELECT * FROM custom_categories WHERE id = ?`).get(id) as unknown as CustomCategoryRecord | undefined;
}

export function createCustomCategory(name: string, icon = '🎮', type: 'topup' | 'giftcard' = 'topup', description = ''): CustomCategoryRecord {
  const rawId = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const id = `custom_${rawId}_${Date.now().toString().slice(-4)}`;
  const cleanIcon = icon.trim() || '🎮';

  db.prepare(`
    INSERT INTO custom_categories (id, name, icon, type, description, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, name.trim(), cleanIcon, type, description?.trim() || '');

  return getCustomCategoryById(id)!;
}

export function toggleCustomCategory(id: string): boolean {
  db.prepare(`UPDATE custom_categories SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?`).run(id);
  const cat = getCustomCategoryById(id);
  return Boolean(cat?.is_active);
}

export function deleteCustomCategory(id: string): boolean {
  db.prepare(`DELETE FROM custom_stock_codes WHERE product_id IN (SELECT id FROM custom_products WHERE category_id = ?)`).run(id);
  db.prepare(`DELETE FROM custom_products WHERE category_id = ?`).run(id);
  db.prepare(`DELETE FROM custom_categories WHERE id = ?`).run(id);
  return true;
}

export function getAllCustomProducts(): CustomProductRecord[] {
  return db.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM custom_stock_codes s WHERE s.product_id = p.id AND s.status = 'available') as stock_count
    FROM custom_products p
    ORDER BY p.created_at ASC
  `).all() as unknown as CustomProductRecord[];
}

export function getCustomProductsByCategory(categoryId: string, includeInactive = false): CustomProductRecord[] {
  const query = includeInactive
    ? `SELECT p.*, (SELECT COUNT(*) FROM custom_stock_codes s WHERE s.product_id = p.id AND s.status = 'available') as stock_count FROM custom_products p WHERE p.category_id = ? ORDER BY p.price_azn ASC`
    : `SELECT p.*, (SELECT COUNT(*) FROM custom_stock_codes s WHERE s.product_id = p.id AND s.status = 'available') as stock_count FROM custom_products p WHERE p.category_id = ? AND p.is_active = 1 ORDER BY p.price_azn ASC`;
  return db.prepare(query).all(categoryId) as unknown as CustomProductRecord[];
}

export function getCustomProductById(id: string): CustomProductRecord | undefined {
  return db.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM custom_stock_codes s WHERE s.product_id = p.id AND s.status = 'available') as stock_count
    FROM custom_products p
    WHERE p.id = ?
  `).get(id) as unknown as CustomProductRecord | undefined;
}

export function createCustomProduct(
  categoryId: string,
  name: string,
  priceUsd: number,
  priceAzn: number,
  deliveryType: 'api' | 'manual' = 'manual',
  apiOfferId = '',
  initialCodes: string[] = []
): CustomProductRecord {
  const rawId = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const id = `prod_${categoryId}_${rawId}_${Date.now().toString().slice(-4)}`;

  db.prepare(`
    INSERT INTO custom_products (id, category_id, name, price_usd, price_azn, delivery_type, api_offer_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, categoryId, name.trim(), priceUsd, priceAzn, deliveryType, apiOfferId || null);

  if (initialCodes && initialCodes.length > 0) {
    addStockCodes(id, initialCodes);
  }

  return getCustomProductById(id)!;
}

export function deleteCustomProduct(id: string): boolean {
  db.prepare(`DELETE FROM custom_stock_codes WHERE product_id = ?`).run(id);
  db.prepare(`DELETE FROM custom_products WHERE id = ?`).run(id);
  return true;
}

export function addStockCodes(productId: string, codes: string[]): number {
  const insertStmt = db.prepare(`
    INSERT INTO custom_stock_codes (product_id, code, status)
    VALUES (?, ?, 'available')
  `);

  let added = 0;
  for (const c of codes) {
    const clean = c.trim();
    if (clean) {
      insertStmt.run(productId, clean);
      added++;
    }
  }
  return added;
}

export function getAvailableStockCount(productId: string): number {
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM custom_stock_codes 
    WHERE product_id = ? AND status = 'available'
  `).get(productId) as { count: number } | undefined;
  return row?.count || 0;
}

export function popAvailableStockCode(productId: string, telegramId: string | number, orderId: string): string | null {
  const row = db.prepare(`
    SELECT id, code FROM custom_stock_codes 
    WHERE product_id = ? AND status = 'available'
    ORDER BY id ASC
    LIMIT 1
  `).get(productId) as { id: number; code: string } | undefined;

  if (!row) return null;

  db.prepare(`
    UPDATE custom_stock_codes 
    SET status = 'used', used_by_telegram_id = ?, order_id = ?, used_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(telegramId.toString(), orderId, row.id);

  return row.code;
}

// =========================================================================
// API KATEQORİYALARI VƏ XÜSUSİ QİYMƏTLƏNDİRMƏ KÖMƏKÇİLƏRİ
// =========================================================================

export interface ApiCategoryRecord {
  category_id: string;
  name: string;
  icon: string;
  custom_emoji_id?: string;
  type: 'topup' | 'giftcard';
  note?: string;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface ApiCustomPricingRecord {
  category_id: string;
  offer_id: string;
  offer_name: string;
  base_usd: number;
  custom_price_azn?: number;
  custom_price_usd?: number;
  is_disabled: number;
  updated_at: string;
}

export function getAllActiveApiCategories(): ApiCategoryRecord[] {
  return db.prepare(`
    SELECT * FROM api_categories 
    WHERE is_active = 1 
    ORDER BY sort_order ASC, name ASC
  `).all() as unknown as ApiCategoryRecord[];
}

export function getActiveApiCategoriesByType(type: 'topup' | 'giftcard'): ApiCategoryRecord[] {
  return db.prepare(`
    SELECT * FROM api_categories 
    WHERE is_active = 1 AND type = ?
    ORDER BY sort_order ASC, name ASC
  `).all(type) as unknown as ApiCategoryRecord[];
}

export function getAllApiCategories(): ApiCategoryRecord[] {
  return db.prepare(`
    SELECT * FROM api_categories 
    ORDER BY sort_order ASC, name ASC
  `).all() as unknown as ApiCategoryRecord[];
}

export function getApiCategory(categoryId: string): ApiCategoryRecord | undefined {
  return db.prepare(`SELECT * FROM api_categories WHERE category_id = ?`).get(categoryId) as unknown as ApiCategoryRecord | undefined;
}

export function addOrUpdateApiCategory(
  categoryId: string,
  name: string,
  icon = '🎮',
  type: 'topup' | 'giftcard' = 'topup',
  note = '',
  customEmojiId = ''
): ApiCategoryRecord {
  db.prepare(`
    INSERT INTO api_categories (category_id, name, icon, type, note, custom_emoji_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(category_id) DO UPDATE SET
      name = excluded.name,
      icon = excluded.icon,
      type = excluded.type,
      note = excluded.note,
      custom_emoji_id = excluded.custom_emoji_id,
      is_active = 1
  `).run(categoryId, name, icon, type, note || null, customEmojiId || null);

  return getApiCategory(categoryId)!;
}

export function deleteApiCategory(categoryId: string): boolean {
  db.prepare(`DELETE FROM api_custom_pricing WHERE category_id = ?`).run(categoryId);
  db.prepare(`DELETE FROM api_categories WHERE category_id = ?`).run(categoryId);
  return true;
}

export function getCustomPricingForCategory(categoryId: string): ApiCustomPricingRecord[] {
  return db.prepare(`SELECT * FROM api_custom_pricing WHERE category_id = ?`).all(categoryId) as unknown as ApiCustomPricingRecord[];
}

export function getAllCustomPricing(): ApiCustomPricingRecord[] {
  return db.prepare(`SELECT * FROM api_custom_pricing`).all() as unknown as ApiCustomPricingRecord[];
}

export function getCustomOfferPrice(categoryId: string, offerId: string): ApiCustomPricingRecord | undefined {
  return db.prepare(`
    SELECT * FROM api_custom_pricing 
    WHERE category_id = ? AND offer_id = ?
  `).get(categoryId, offerId) as unknown as ApiCustomPricingRecord | undefined;
}

export function setCustomOfferPrice(
  categoryId: string,
  offerId: string,
  offerName: string,
  baseUsd: number,
  customPriceAzn: number | null,
  customPriceUsd: number | null = null,
  isDisabled = 0
): boolean {
  // Əgər yalnız bir valyuta təyin edilibsə, digərini parametr məzənnəsindən istifadə edərək sinxronlaşdır
  const rateRow = db.prepare(`SELECT value FROM settings WHERE key = 'usd_azn_rate'`).get() as { value: string } | undefined;
  const rate = rateRow ? parseFloat(rateRow.value) || 1.70 : 1.70;

  let finalAzn = customPriceAzn;
  let finalUsd = customPriceUsd;

  if (finalAzn !== null && finalAzn > 0 && (finalUsd === null || finalUsd <= 0)) {
    finalUsd = Number((finalAzn / rate).toFixed(2));
  } else if (finalUsd !== null && finalUsd > 0 && (finalAzn === null || finalAzn <= 0)) {
    finalAzn = Number((finalUsd * rate).toFixed(2));
  }

  db.prepare(`
    INSERT INTO api_custom_pricing (category_id, offer_id, offer_name, base_usd, custom_price_azn, custom_price_usd, is_disabled, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(category_id, offer_id) DO UPDATE SET
      offer_name = excluded.offer_name,
      base_usd = excluded.base_usd,
      custom_price_azn = excluded.custom_price_azn,
      custom_price_usd = excluded.custom_price_usd,
      is_disabled = excluded.is_disabled,
      updated_at = CURRENT_TIMESTAMP
  `).run(categoryId, offerId, offerName, baseUsd, finalAzn, finalUsd, isDisabled);

  // Kateqoriyanın mövcudluğundan və api_categories-də aktiv olduğundan avtomatik əmin ol
  try {
    const existing = db.prepare(`SELECT category_id FROM api_categories WHERE category_id = ?`).get(categoryId);
    if (!existing) {
      const isGc = categoryId.includes('giftcard') || categoryId.includes('voucher') || categoryId.includes('pin') || categoryId.includes('steam') || categoryId.includes('roblox') || categoryId.includes('itunes') || categoryId.includes('netflix') || categoryId.includes('spotify') || categoryId.includes('discord');
      const cleanName = categoryId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      db.prepare(`
        INSERT OR IGNORE INTO api_categories (category_id, name, icon, type, is_active, sort_order)
        VALUES (?, ?, '🎮', ?, 1, 50)
      `).run(categoryId, cleanName, isGc ?'giftcard' : 'topup');
    }
  } catch (e: any) { console.error("Database error:", e?.message || e); }

  return true;
}

export function saveAdminSession(token: string, expiresAt: number): void {
  db.prepare(`
    INSERT INTO admin_sessions (token, expires_at)
    VALUES (?, ?)
    ON CONFLICT(token) DO UPDATE SET expires_at = excluded.expires_at
  `).run(token, expiresAt);
}

export function isAdminSessionValid(token: string): boolean {
  const row = db.prepare(`SELECT expires_at FROM admin_sessions WHERE token = ?`).get(token) as { expires_at: number } | undefined;
  if (!row) return false;
  if (Date.now() > row.expires_at) {
    db.prepare(`DELETE FROM admin_sessions WHERE token = ?`).run(token);
    return false;
  }
  return true;
}

export function deleteAdminSession(token: string): void {
  db.prepare(`DELETE FROM admin_sessions WHERE token = ?`).run(token);
}

export function clearAllAdminSessions(): void {
  db.prepare(`DELETE FROM admin_sessions`).run();
}

// ---------------- API AÇARLARI VƏ B2B TƏRƏFDAŞLAR KÖMƏKÇİLƏRİ ----------------

export interface ApiKeyRecord {
  id: number;
  telegram_id: string;
  api_key: string;
  name: string;
  is_active: number;
  total_orders: number;
  total_spent_azn: number;
  created_at: string;
  last_used_at: string | null;
}

export function createApiKey(telegramId: string | number, name = 'My API Client'): { id: number; key: string } {
  const tgIdStr = telegramId.toString().trim();
  const rawKey = 'wn_live_' + crypto.randomBytes(20).toString('hex');
  const stmt = db.prepare(`
    INSERT INTO api_keys (telegram_id, api_key, name, is_active)
    VALUES (?, ?, ?, 1)
  `);
  const info = stmt.run(tgIdStr, rawKey, name.trim() || 'My API Client');
  return { id: Number(info.lastInsertRowid), key: rawKey };
}

export function getApiKeyRecord(apiKey: string): ApiKeyRecord | undefined {
  if (!apiKey) return undefined;
  return db.prepare(`SELECT * FROM api_keys WHERE api_key = ? AND is_active = 1`).get(apiKey.trim()) as unknown as ApiKeyRecord | undefined;
}

export function getUserApiKeys(telegramId: string | number): ApiKeyRecord[] {
  const tgIdStr = telegramId.toString().trim();
  return db.prepare(`SELECT * FROM api_keys WHERE telegram_id = ? ORDER BY id DESC`).all(tgIdStr) as unknown as ApiKeyRecord[];
}

export function revokeApiKey(keyId: number, telegramId: string | number): boolean {
  const tgIdStr = telegramId.toString().trim();
  const stmt = db.prepare(`DELETE FROM api_keys WHERE id = ? AND telegram_id = ?`);
  const info = stmt.run(keyId, tgIdStr);
  return (info.changes as number) > 0;
}

export function getAllApiKeysWithUser(): any[] {
  return db.prepare(`
    SELECT a.*, u.username, u.first_name, u.balance
    FROM api_keys a
    LEFT JOIN users u ON a.telegram_id = u.telegram_id
    ORDER BY a.id DESC
  `).all();
}

export function toggleApiKeyStatus(keyId: number, isActive: number): boolean {
  const stmt = db.prepare(`UPDATE api_keys SET is_active = ? WHERE id = ?`);
  const info = stmt.run(isActive, keyId);
  return (info.changes as number) > 0;
}

export function recordApiKeyUsage(apiKey: string, amountAzn: number): void {
  db.prepare(`
    UPDATE api_keys
    SET total_orders = total_orders + 1,
        total_spent_azn = ROUND(total_spent_azn + ?, 2),
        last_used_at = CURRENT_TIMESTAMP
    WHERE api_key = ?
  `).run(amountAzn, apiKey.trim());
}


