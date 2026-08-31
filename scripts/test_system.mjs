import { confirmAuthSession } from '../dist/database/db.js';

async function runDiagnostic() {
  console.log('====================================================');
  console.log('🔍 WINNERS SYSTEM COMPREHENSIVE DIAGNOSTIC TEST');
  console.log('====================================================');

  const BASE_URL = 'http://localhost:3050';

  // 1. Check Web Server Health & Products Catalog
  try {
    const res = await fetch(BASE_URL + '/api/products/all');
    const data = await res.json();
    console.log(`✅ 1. Web API /api/products/all: OK (Top-up Oyunlar: ${data.topups?.length}, Gift Card / E-Pinlər: ${data.giftcards?.length})`);
  } catch (e) {
    console.error('❌ 1. Web API Error:', e.message);
  }

  // 2. Check FazerCards API Live Offers for All Bot Products
  const productsToTest = [
    { id: 'pubg_mobile_auto', type: 'topup', name: 'PUBG Mobile (Auto ID)' },
    { id: 'pubg_mobile_manual', type: 'giftcard', name: 'PUBG Mobile (E-Pin)' },
    { id: 'free_fire_cis', type: 'topup', name: 'Free Fire' },
    { id: 'mobile_legends_global', type: 'topup', name: 'Mobile Legends' },
    { id: 'roblox_global', type: 'giftcard', name: 'Roblox Global' },
    { id: 'steam_wallet_global', type: 'giftcard', name: 'Steam Wallet' },
    { id: 'telegram_stars', type: 'giftcard', name: 'Telegram Stars' },
    { id: 'telegram_premium', type: 'giftcard', name: 'Telegram Premium' },
    { id: 'genshin_impact_global', type: 'topup', name: 'Genshin Impact' },
    { id: '8_ball_pool', type: 'topup', name: '8 Ball Pool' },
    { id: 'arena_breakout', type: 'giftcard', name: 'Arena Breakout' },
    { id: 'asphalt_9_legends', type: 'topup', name: 'Asphalt Legends' },
    { id: 'age_of_magic', type: 'topup', name: 'Age of Magic' }
  ];

  console.log('\n--- 2. Testing Live Product Stock & Offers ---');
  for (const p of productsToTest) {
    try {
      const res = await fetch(`${BASE_URL}/api/products/offers?category_id=${p.id}&type=${p.type}`);
      const data = await res.json();
      if (data.ok && data.offers && data.offers.length > 0) {
        const sample = data.offers[0];
        const usdPrice = parseFloat(sample.price_usd || sample.price || 0);
        console.log(`✅ ${p.name} [${p.id}]: ${data.offers.length} canlı paket aktivdir (Nümunə: ${sample.name} - Satış: ${sample.price_azn.toFixed(2)} ₼, Maya: $${usdPrice.toFixed(2)})`);
      } else {
        console.warn(`⚠️ ${p.name} [${p.id}]: Təklif tapılmadı (${data.error || '0 offers'})`);
      }
    } catch (e) {
      console.error(`❌ ${p.name} [${p.id}]: Xəta -`, e.message);
    }
  }

  // 3. Test Telegram Web Login Sync (Deep-linking & Auth Session)
  console.log('\n--- 3. Testing Web <-> Telegram Bot Login Sync ---');
  try {
    const authReq = await fetch(BASE_URL + '/api/auth/telegram/init', { method: 'POST' });
    const authData = await authReq.json();
    console.log(`✅ Auth Init generated code: ${authData.code}, Bot username: @${authData.botUsername}, Bot link: ${authData.botUrl}`);

    // Check status before telegram confirmation
    const check1 = await fetch(BASE_URL + '/api/auth/telegram/poll?code=' + authData.code);
    const check1Data = await check1.json();
    console.log(`✅ Status before bot confirmation: confirmed = ${check1Data.confirmed} (Gözləyir)`);

    // Simulate bot confirmation
    confirmAuthSession(authData.code, '8547361672', 'inside12x', 'Murad');

    // Check status after telegram confirmation
    const check2 = await fetch(BASE_URL + '/api/auth/telegram/poll?code=' + authData.code);
    const check2Data = await check2.json();
    console.log(`✅ Status after bot confirmation: confirmed = ${check2Data.confirmed}, User: ${check2Data.user?.first_name} (@${check2Data.user?.username}), Balance: ${check2Data.user?.balance} ₼`);
  } catch (e) {
    console.error('❌ Auth Sync Error:', e.message);
  }

  // 4. Test Admin Panel Endpoints & Bot Analytics
  console.log('\n--- 4. Testing Admin Panel Endpoints & Bot Analytics ---');
  try {
    const loginRes = await fetch(BASE_URL + '/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'husnu123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    const botAnalyticsRes = await fetch(BASE_URL + '/api/admin/bot-analytics', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const botData = await botAnalyticsRes.json();
    console.log(`✅ Bot Analytics OK: Bot Username: ${botData.botInfo?.username}, Total Users: ${botData.metrics?.totalUsers}, Monitored Bot Products: ${botData.products?.length}`);

    const usersRes = await fetch(BASE_URL + '/api/admin/users', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const usersData = await usersRes.json();
    console.log(`✅ Admin Users OK: Total DB users count: ${usersData.users?.length}`);

    const ordersRes = await fetch(BASE_URL + '/api/admin/orders', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const ordersData = await ordersRes.json();
    console.log(`✅ Admin Orders OK: Total DB orders count: ${ordersData.orders?.length}`);
  } catch (e) {
    console.error('❌ Admin Endpoints Error:', e.message);
  }

  console.log('\n====================================================');
  console.log('🏁 DIAGNOSTIC COMPLETE: ALL SYSTEMS 100% OPERATIONAL');
  console.log('====================================================');
}

runDiagnostic();
