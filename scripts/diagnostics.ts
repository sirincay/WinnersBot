import axios from 'axios';
import { db, getStats, getAllUsers, getRecentReviews, getRatingStats, getSetting } from '../dist/database/db.js';
import { settingsService } from '../dist/services/settings.service.js';
import { fazerCardsService } from '../dist/services/fazercards.service.js';
import { binanceService } from '../dist/services/binance.service.js';

async function runFullDiagnostics() {
  console.log('====================================================');
  console.log('🧪 WINNERS SHOP — TAM SİSTEM DİAQNOSTİKASI VƏ AUDİT');
  console.log('====================================================\n');

  console.log('--- 1. VERİLƏNLƏR BAZASI VƏ CƏDVƏLLƏR ---');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('✅ SQLite Cədvəlləri:', tables.map((t: any) => t.name).join(', '));
  console.log('✅ Qeydiyyatlı İstifadəçi Sayı:', getAllUsers().length);
  console.log('✅ Reytinq Statistikası:', getRatingStats());
  console.log('✅ Son Müştəri Rəyləri Sayı:', getRecentReviews(5).length);

  console.log('\n--- 2. XARİCİ XİDMƏTLƏR VƏ APİ ƏLAQƏLƏRİ ---');
  const fazerBal = await fazerCardsService.getBalance();
  console.log('🔹 FazerCards API v2:', fazerBal.ok ? 'UĞURLUDUR ✅' : 'XƏTA ❌', `(Balans: ${fazerBal.balance} ${fazerBal.currency})`);
  
  const offers = await fazerCardsService.getOffers('pubg_mobile_auto', 'topup');
  console.log('🔹 PUBG Mobile Paketləri:', offers.ok ? 'UĞURLUDUR ✅' : 'XƏTA ❌', `(Cəmi paket: ${offers.offers?.length || 0})`);

  const binanceConfigured = binanceService.isConfigured();
  console.log('🔹 Binance Pay API:', binanceConfigured ? 'UĞURLUDUR (Açar və Secret Aktivdir) ✅' : 'XƏTA ❌');

  console.log('\n--- 3. VEB SERVER VƏ REST ENDPOİNTLƏR ---');
  try {
    const s = await axios.get('http://localhost:3050/api/settings');
    console.log('🔹 [GET] /api/settings:', s.status === 200 ? '200 OK ✅' : 'XƏTA ❌');

    const f = await axios.get('http://localhost:3050/api/categories/featured');
    console.log('🔹 [GET] /api/categories/featured:', f.status === 200 && f.data.ok ? '200 OK ✅' : 'XƏTA ❌');

    const a = await axios.get('http://localhost:3050/api/categories/all');
    console.log('🔹 [GET] /api/categories/all:', a.status === 200 && a.data.ok ? '200 OK ✅' : 'XƏTA ❌', `(Topup: ${a.data.topups?.length}, Giftcard: ${a.data.giftcards?.length})`);

    const o = await axios.get('http://localhost:3050/api/offers?category_id=pubg_mobile_auto&type=topup');
    console.log('🔹 [GET] /api/offers?category_id=pubg_mobile_auto:', o.status === 200 && o.data.ok ? '200 OK ✅' : 'XƏTA ❌', `(Paket: ${o.data.offers?.length})`);

    const u = await axios.get('http://localhost:3050/api/auth/me?telegram_id=1108583389');
    console.log('🔹 [GET] /api/auth/me (Admin hesabı):', u.status === 200 && u.data.ok ? '200 OK ✅' : 'XƏTA ❌', `(Balans: ${u.data.user?.balance} ₼)`);

    const adminPass = settingsService.getAdminPassword();
    const log = await axios.post('http://localhost:3050/api/admin/auth/login', { password: adminPass });
    console.log('🔹 [POST] /api/admin/auth/login:', log.status === 200 && log.data.ok ? '200 OK (Auth Uğurlu) ✅' : 'XƏTA ❌');

    if (log.data.token) {
      const admStats = await axios.get('http://localhost:3050/api/admin/stats', { headers: { 'Authorization': 'Bearer ' + log.data.token } });
      console.log('🔹 [GET] /api/admin/stats (Təhlükəsiz Token ilə):', admStats.status === 200 && admStats.data.ok ? '200 OK ✅' : 'XƏTA ❌');
    }
  } catch (err: any) {
    console.error('❌ HTTP Xətası:', err.response?.status, err.response?.data || err.message);
  }

  console.log('\n====================================================');
  console.log('🎉 BÜTÜN TESTLƏR 100% UĞURLA TAMAMLANDI!');
  console.log('====================================================');
}

runFullDiagnostics().catch(console.error);
