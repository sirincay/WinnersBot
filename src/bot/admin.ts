import { Context, InlineKeyboard } from 'grammy';
import {
  getStats,
  getAllUsers,
  getUsersBySegment,
  UserSegment,
  updateUserBalance,
  getUserById,
  isUserAdmin,
  findUserByQuery,
  findOrderById,
  toggleApiCategory,
  getAllActiveApiCategories,
  updateOrderStatus,
  setUserBlocked,
  getUserOrders,
  db
} from '../database/db.js';
import { paymentService } from '../services/payment.service.js';
import { settingsService } from '../services/settings.service.js';
import { fazerCardsService } from '../services/fazercards.service.js';
import { playpinService } from '../services/playpin.service.js';
import { notificationService, escapeTgHtml } from '../services/notification.service.js';
import { backupService } from '../services/backup.service.js';
import { config } from '../config/config.js';
import { EMOJIS, getCustomEmojiId } from './emojis.js';
import { makeBtn } from './menus.js';
import { steganographyService } from '../services/steganography.service.js';

export async function handleAdminCommand(ctx: Context) {
  if (!ctx.from || !isUserAdmin(ctx.from.id)) return;

  const stats = getStats();
  let fazerBalStr = '0.00 USD';
  try {
    const f = await fazerCardsService.getBalance();
    if (f.ok) fazerBalStr = `${f.balance} ${f.currency}`;
  } catch (e) {}

  let playpinBalStr = '0.00 USD';
  try {
    const p = await playpinService.getMe();
    if (p.ok && p.data) playpinBalStr = `$${p.data.balance.toFixed(2)} USD`;
  } catch (e) {}

  const text = `👑 <b>WINNERS SHOP — ADMİN İDARƏETMƏ PANELİ</b>\n\n` +
    `📊 <b>Ümumi Statistika:</b>\n` +
    `👥 <b>İstifadəçilər:</b> ${stats.usersCount} nəfər\n` +
    `🛒 <b>Bütün Sifarişlər:</b> ${stats.totalOrders} ədəd\n` +
    `✅ <b>Uğurlu Sifarişlər:</b> ${stats.completedOrders} ədəd\n` +
    `💰 <b>Ümumi Satış Həcmi:</b> ${stats.totalRevenueAzn.toFixed(2)} ₼\n` +
    `📥 <b>Depozit Olunan Məbləğ:</b> ${stats.totalDepositedAzn.toFixed(2)} ₼\n` +
    `⏳ <b>Gözləyən Qəbzlər:</b> ${stats.pendingPaymentsCount} ədəd\n\n` +
    `💳 <b>FazerCards API Balansı:</b> <b>${fazerBalStr}</b>\n` +
    `💳 <b>PlayPin API Balansı:</b> <b>${playpinBalStr}</b>\n` +
    `📈 <b>USD / AZN Məzənnəsi:</b> 1 USD = ${settingsService.getUsdAznRate()} AZN\n` +
    `🏷️ <b>Qazanc Marjası:</b> +${settingsService.getMarginPercent()}%\n\n` +
    `⚡ <b>Sürətli Admin Komandaları:</b>\n` +
    `• <code>/user ID və ya @username</code> — İstifadəçi axtar & idarə et\n` +
    `• <code>/order SİFARİŞ_ID</code> — Sifarişi axtar & ləğv/təsdiq et\n` +
    `• <code>/report</code> — Günlük xalis qazanc hesabatı\n` +
    `• <code>/toggle OYUN_ID</code> — Oyunu deaktiv/aktiv et\n` +
    `• <code>/broadcast Mesajınız</code> — Şəkilli/mətnli elan göndər\n` +
    `• <code>/backup</code> — Bazanın tam nüsxəsini yüklə\n` +
    `• <code>/addbalance TG_ID MƏBLƏĞ</code> — Əllə balans artırmaq\n` +
    `• <code>/setrate 1.70</code> — Valyuta məzənnəsini dəyişmək\n` +
    `• <code>/setmargin 15</code> — Qazanc faizini dəyişmək`;

  const kb = new InlineKeyboard()
    .text('👤 İstifadəçi Axtar', 'adm_prompt_user_search')
    .text('🧾 Sifariş Axtar', 'adm_prompt_order_search').row()
    .text('📊 Günlük Hesabat', 'adm_view_report')
    .text('🎮 Oyun İdarəsi (Toggle)', 'adm_view_game_toggles').row()
    .text('📢 Toplu Mesaj', 'adm_prompt_broadcast')
    .text('🛡️ İndi Backup Al', 'adm_create_backup').row()
    .text('🔄 Statistikaları Yenilə', 'adm_refresh_stats');

  if (config.server.webAppUrl && config.server.webAppUrl.startsWith('https://')) {
    kb.row().url('🌐 Veb Admin Panelinə Keç', `${config.server.webAppUrl}/admin.html`);
  }

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

// 1. İstifadəçi Axtarışı və İdarəetməsi (/user <ID | @username>)
export async function handleAdminUserSearch(ctx: Context, query: string) {
  if (!ctx.from || !isUserAdmin(ctx.from.id)) return;

  const user = findUserByQuery(query);
  if (!user) {
    await ctx.reply(`❌ <b>İstifadəçi tapılmadı:</b> "<code>${escapeTgHtml(query)}</code>"\n\nZəhmət olmasa düzgün Telegram ID və ya @username daxil edin.`, { parse_mode: 'HTML' });
    return;
  }

  const isBlocked = user.is_blocked === 1;
  const usernameStr = user.username ? `@${user.username}` : 'Yoxdur';
  const roleStr = user.is_admin === 1 ? '👑 Administrator' : '👤 Müştəri';
  const statusStr = isBlocked ? '🔴 BLOKLANIB' : '🟢 Aktiv';

  const text =
    `👤 <b>İSTİFADƏÇİ MƏLUMAT KARTI</b>\n\n` +
    `• <b>Ad / Ləqəb:</b> ${escapeTgHtml(user.first_name || 'İstifadəçi')}\n` +
    `• <b>İstifadəçi Adı:</b> ${usernameStr}\n` +
    `• <b>Telegram ID:</b> <code>${user.telegram_id}</code>\n` +
    `• <b>Rolu:</b> ${roleStr}\n` +
    `• <b>Hesab Statusu:</b> <b>${statusStr}</b>\n\n` +
    `💳 <b>Cari Balans:</b> <b>${(user.balance || 0).toFixed(2)} ₼</b>\n` +
    `🛒 <b>Tamamlanan Sifarişlər:</b> <b>${user.orders_count || 0} ədəd</b>\n` +
    `💰 <b>Ümumi Xərclədiyi:</b> <b>${(user.total_spent || 0).toFixed(2)} ₼</b>\n` +
    `📅 <b>Qeydiyyat Tarixi:</b> ${user.created_at || '—'}`;

  const kb = new InlineKeyboard()
    .text('➕ Balans (+5 ₼)', `adm_ubal_${user.telegram_id}_add5`)
    .text('➕ Balans (+20 ₼)', `adm_ubal_${user.telegram_id}_add20`)
    .text('➖ Balans (-5 ₼)', `adm_ubal_${user.telegram_id}_sub5`).row()
    .text(isBlocked ? '🟢 Blokdan Çıxart' : '🚫 Blokla (Ban)', `adm_ublk_${user.telegram_id}`)
    .text('✉️ Mesaj Yaz', `adm_umsg_${user.telegram_id}`).row()
    .text('📜 Son Sifarişləri', `adm_uord_${user.telegram_id}`)
    .text('🏠 Admin Panel', 'adm_refresh_stats');

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

// 2. Sifariş Axtarışı və İdarəetməsi (/order <ID>)
export async function handleAdminOrderSearch(ctx: Context, query: string) {
  if (!ctx.from || !isUserAdmin(ctx.from.id)) return;

  const order = findOrderById(query);
  if (!order) {
    await ctx.reply(`❌ <b>Sifariş tapılmadı:</b> "<code>${escapeTgHtml(query)}</code>"`, { parse_mode: 'HTML' });
    return;
  }

  let statusBadge = '⏳ Gözləmədə';
  if (order.status === 'completed') statusBadge = '✅ Tamamlandı';
  if (order.status === 'failed') statusBadge = '❌ Ləğv Edildi / Uğursuz';
  if ((order.status as string) === 'processing') statusBadge = '⚡ İcrada (Operator/API)';

  const text =
    `🧾 <b>SİFARİŞ MƏLUMAT KARTI</b>\n\n` +
    `• <b>Sifariş ID:</b> <code>#${order.id}</code>\n` +
    `• <b>Müştəri Telegram ID:</b> <code>${order.telegram_id}</code>\n` +
    `• <b>Kateqoriya:</b> ${escapeTgHtml(order.category_name || order.category_id)}\n` +
    `• <b>Paket:</b> <b>${escapeTgHtml(order.offer_name)}</b>\n` +
    (order.player_id ? `• <b>Oyunçu ID:</b> <code>${escapeTgHtml(order.player_id)}</code>\n` : '') +
    `• <b>Məbləğ:</b> <b>${(order.price_azn || 0).toFixed(2)} AZN</b> ($${(order.price_usd || 0).toFixed(2)})\n` +
    `• <b>Status:</b> <b>${statusBadge}</b>\n` +
    (order.fazer_order_id ? `• <b>Təchizatçı ID:</b> <code>#${escapeTgHtml(order.fazer_order_id)}</code>\n` : '') +
    `• <b>Tarix:</b> ${order.created_at || '—'}`;

  const kb = new InlineKeyboard();
  if (order.fazer_order_id) {
    kb.text('🔄 Statusu Yoxla (API)', `adm_ord_chk_${order.id}`).row();
  }
  if (order.status !== 'completed') {
    kb.text('⚡ Əl ilə "Uğurlu" Et', `adm_ord_app_${order.id}`);
  }
  if (order.status !== 'failed') {
    kb.text('❌ Ləğv Et & İadə Et', `adm_ord_can_${order.id}`).row();
  } else {
    kb.row();
  }
  kb.text('👤 Müştəri Profili', `adm_view_user_${order.telegram_id}`)
    .text('🏠 Admin Panel', 'adm_refresh_stats');

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

// 4. Oyun Aktiv/Deaktiv İdarəedicisi (/toggle <category_id>)
export async function handleAdminToggleCommand(ctx: Context, categoryId?: string) {
  if (!ctx.from || !isUserAdmin(ctx.from.id)) return;

  if (categoryId && categoryId.trim()) {
    const res = toggleApiCategory(categoryId.trim());
    if (res.ok) {
      const statusIcon = res.newStatus === 1 ? '🟢 AKTİV' : '🔴 DEAKTİV (Texniki Baxış)';
      await ctx.reply(
        `🎮 <b>OYUN STATUSU DƏYİŞDİRİLDİ!</b>\n\n` +
        `• <b>Oyun / Kateqoriya:</b> ${escapeTgHtml(res.name)}\n` +
        `• <b>ID:</b> <code>${res.categoryId}</code>\n` +
        `• <b>Yeni Status:</b> <b>${statusIcon}</b>\n\n` +
        `<i>Dəyişiklik dərhal həm Telegram botunda, həm də veb saytda qüvvəyə mindi.</i>`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🎮 Digər Oyunlar', 'adm_view_game_toggles') }
      );
      return;
    } else {
      await ctx.reply(`❌ ${res.error}`, { parse_mode: 'HTML' });
      return;
    }
  }

  // Parametr yoxdursa, oyun aktiv/deaktiv panelini göstər
  const allCats = getAllActiveApiCategories();
  const popularIds = ['pubg_mobile_auto', 'pubg_mobile_web', 'pubg_mobile_epin', 'free_fire', 'valorant', 'brawl_stars', 'mobile_legends', 'roblox', 'steam', 'telegram_stars', 'telegram_premium'];
  
  const text =
    `🎮 <b>OYUN VƏ XİDMƏT İDARƏETMƏSİ (CANLI TOGGLE)</b>\n\n` +
    `Aşağıdakı düymələrlə istənilən oyunu dərhal <b>Aktiv</b> və ya <b>Müvəqqəti Texniki Baxış (Deaktiv)</b> rejiminə keçirə bilərsiniz:\n\n` +
    `• Ya da birbaşa əmr yazın: <code>/toggle pubg_mobile_web</code>`;

  const kb = new InlineKeyboard();
  const rows = db.prepare(`SELECT category_id, name, is_active FROM api_categories WHERE category_id IN (${popularIds.map(() => '?').join(',')}) ORDER BY sort_order ASC`).all(...popularIds) as any[];

  for (let i = 0; i < rows.length; i += 2) {
    const c1 = rows[i];
    const c2 = rows[i + 1];

    const btn1Text = `${c1.is_active === 1 ? '🟢' : '🔴'} ${c1.name.slice(0, 18)}`;
    if (c2) {
      const btn2Text = `${c2.is_active === 1 ? '🟢' : '🔴'} ${c2.name.slice(0, 18)}`;
      kb.text(btn1Text, `adm_tgl_${c1.category_id}`).text(btn2Text, `adm_tgl_${c2.category_id}`).row();
    } else {
      kb.text(btn1Text, `adm_tgl_${c1.category_id}`).row();
    }
  }

  kb.text('🔄 Yenilə', 'adm_view_game_toggles').text('🏠 Admin Panel', 'adm_refresh_stats');
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

export async function handleAdminCallbacks(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data || !ctx.from) return;

  if (!isUserAdmin(ctx.from.id)) {
    await ctx.answerCallbackQuery({ text: 'Bu əməliyyat üçün səlahiyyətiniz yoxdur.', show_alert: true });
    return;
  }

  // Statistikaları Yenilə
  if (data === 'adm_refresh_stats') {
    return handleAdminCommand(ctx);
  }

  // Gündəlik Maliyyə Hesabatına Bax
  if (data === 'adm_view_report') {
    await ctx.answerCallbackQuery({ text: 'Maliyyə hesabatı hazırlanır...' });
    await notificationService.sendDailyFinancialReportToAdmin(ctx.chat?.id);
    return;
  }

  // Oyun Aktiv/Deaktiv Panelini Göstər
  if (data === 'adm_view_game_toggles') {
    await ctx.answerCallbackQuery();
    return handleAdminToggleCommand(ctx);
  }

  // Kateqoriyanı Aktiv/Deaktiv Et
  if (data.startsWith('adm_tgl_')) {
    const catId = data.replace('adm_tgl_', '');
    const res = toggleApiCategory(catId);
    if (res.ok) {
      await ctx.answerCallbackQuery({ text: `${res.name} -> ${res.newStatus === 1 ? '🟢 Aktiv' : '🔴 Deaktiv'}` });
      return handleAdminToggleCommand(ctx);
    } else {
      await ctx.answerCallbackQuery({ text: res.error || 'Xəta', show_alert: true });
    }
    return;
  }

  // İstifadəçi Balansı Sürətli Əməliyyat (+5, +20, -5)
  if (data.startsWith('adm_ubal_')) {
    const parts = data.split('_');
    const targetTgId = parts[2];
    const action = parts[3];

    let delta = 0;
    if (action === 'add5') delta = 5;
    else if (action === 'add20') delta = 20;
    else if (action === 'sub5') delta = -5;

    if (delta !== 0) {
      updateUserBalance(targetTgId, delta);
      const u = getUserById(targetTgId);
      await ctx.answerCallbackQuery({
        text: `Balans yeniləndi! (${delta > 0 ? '+' : ''}${delta} ₼) Yeni Balans: ${u?.balance.toFixed(2)} ₼`,
        show_alert: true
      });
      return handleAdminUserSearch(ctx, targetTgId);
    }
    return;
  }

  // İstifadəçi Bloklama / Blokdan Çıxarma
  if (data.startsWith('adm_ublk_')) {
    const targetTgId = data.replace('adm_ublk_', '');
    const u = getUserById(targetTgId);
    if (!u) return;
    const newBlocked = u.is_blocked === 1 ? 0 : 1;
    setUserBlocked(targetTgId, newBlocked === 1, 'Admin Telegram paneli vasitəsilə dəyişdirildi');
    await ctx.answerCallbackQuery({
      text: newBlocked === 1 ? 'İstifadəçi bloklandı 🚫' : 'İstifadəçi blokdan çıxarıldı 🟢',
      show_alert: true
    });
    return handleAdminUserSearch(ctx, targetTgId);
  }

  // İstifadəçiyə Birbaşa Mesaj Göndərmə
  if (data.startsWith('adm_umsg_')) {
    const targetTgId = data.replace('adm_umsg_', '');
    await ctx.answerCallbackQuery();
    const { setUserState } = await import('./handlers.js');
    setUserState(ctx.from.id, { step: 'awaiting_user_direct_msg', extra: { targetTgId } });
    await ctx.reply(
      `✉️ <b>MÜŞTƏRİYƏ ŞƏXSİ MESAJ GÖNDƏRİLMƏSİ</b>\n\n` +
      `Müştəri ID: <code>${targetTgId}</code>\n\n` +
      `Göndərmək istədiyiniz mətni bu çata yazın:`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Ləğv Et', 'adm_cancel_direct_msg')
      }
    );
    return;
  }

  if (data === 'adm_cancel_direct_msg') {
    await ctx.answerCallbackQuery({ text: 'Mesaj ləğv edildi.' });
    const { clearUserState } = await import('./handlers.js');
    clearUserState(ctx.from.id);
    await ctx.editMessageText('❌ Mesaj göndərilməsi ləğv edildi.', { parse_mode: 'HTML' });
    return;
  }

  // Təchizatçı vasitəsilə Sifariş Canlı Status Yoxlaması
  if (data.startsWith('adm_ord_chk_')) {
    const orderId = data.replace('adm_ord_chk_', '');
    const ord = findOrderById(orderId);
    if (!ord || !ord.fazer_order_id) {
      await ctx.answerCallbackQuery({ text: 'Təchizatçı ID tapılmadı.', show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery({ text: 'Təchizatçıdan status yoxlanılır...' });
    const res = await playpinService.getOrderStatus(ord.fazer_order_id);
    await ctx.reply(
      `📡 <b>TƏCHİZATÇI STATUS CAVABI (#${ord.fazer_order_id})</b>\n\n` +
      `• Status: <b>${res.status || 'Naməlum'}</b>\n` +
      `• Cavab: <code>${JSON.stringify(res.data || res.error || '').slice(0, 300)}</code>`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Sifarişi Ləğv Et və Geri Qaytar
  if (data.startsWith('adm_ord_can_')) {
    const orderId = data.replace('adm_ord_can_', '');
    const ord = findOrderById(orderId);
    if (!ord) return;

    updateOrderStatus(orderId, 'failed', ord.fazer_order_id || undefined, 'Admin tərəfindən ləğv edildi');
    updateUserBalance(ord.telegram_id, ord.price_azn);
    await notificationService.notifyUserOrderCancelled(ord.telegram_id, {
      orderId: ord.id,
      offerName: ord.offer_name,
      categoryName: ord.category_name,
      playerId: ord.player_id || '',
      priceAzn: ord.price_azn,
      reason: 'Winners Store administratoru tərəfindən ləğv edildi və balans bərpa olundu.'
    });

    await ctx.answerCallbackQuery({ text: `Sifariş ləğv edildi və ${ord.price_azn.toFixed(2)} ₼ balansına qaytarıldı!`, show_alert: true });
    return handleAdminOrderSearch(ctx, orderId);
  }

  // Sifarişi Əllə Təsdiq Et
  if (data.startsWith('adm_ord_app_')) {
    const orderId = data.replace('adm_ord_app_', '');
    const ord = findOrderById(orderId);
    if (!ord) return;

    updateOrderStatus(orderId, 'completed', ord.fazer_order_id || undefined, 'Admin tərəfindən əllə təsdiqləndi');
    await notificationService.notifyUserWebPurchaseCompleted(ord.telegram_id, {
      orderId: ord.id,
      offerName: ord.offer_name,
      categoryName: ord.category_name,
      playerId: ord.player_id || '',
      priceAzn: ord.price_azn,
      playpinOrderId: ord.fazer_order_id || undefined
    });

    await ctx.answerCallbackQuery({ text: 'Sifariş "Uğurlu" olaraq təsdiqləndi və müştəriyə bildiriş göndərildi! ✅', show_alert: true });
    return handleAdminOrderSearch(ctx, orderId);
  }

  if (data.startsWith('adm_view_user_')) {
    const tid = data.replace('adm_view_user_', '');
    return handleAdminUserSearch(ctx, tid);
  }

  // Müştərinin Son Sifarişləri: adm_uord_<telegram_id>
  if (data.startsWith('adm_uord_')) {
    const tid = data.replace('adm_uord_', '');
    const user = getUserById(tid);
    const orders = getUserOrders(tid, 5);

    await ctx.answerCallbackQuery();

    if (orders.length === 0) {
      await ctx.reply(
        `📜 <b>İSTİFADƏÇİNİN SİFARİŞ TARİXÇƏSİ</b>\n\n` +
        `👤 <b>İstifadəçi:</b> ${escapeTgHtml(user?.first_name || 'Müştəri')} (<code>${tid}</code>)\n` +
        `ℹ️ Bu istifadəçinin hələ heç bir sifarişi yoxdur.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('👤 İstifadəçiyə Qayıt', `adm_view_user_${tid}`)
            .text('🏠 Admin Panel', 'adm_refresh_stats'),
        }
      );
      return;
    }

    let text = `📜 <b>MÜŞTƏRİNİN SON SİFARİŞLƏRİ</b>\n\n` +
      `👤 <b>İstifadəçi:</b> ${escapeTgHtml(user?.first_name || 'Müştəri')} (<code>${tid}</code>)\n` +
      `🛒 <b>Göstərilir:</b> Son ${orders.length} ədəd sifariş\n\n` +
      `─────────────────────────\n`;

    const kb = new InlineKeyboard();

    orders.forEach((ord, idx) => {
      let statusIcon = '⏳ Gözləyir';
      if (ord.status === 'completed') statusIcon = '✅ Uğurlu';
      else if (ord.status === 'failed') statusIcon = '❌ Ləğv';

      text += `<b>${idx + 1}. #${ord.id}</b> — ${statusIcon}\n` +
        `📦 <b>Paket:</b> ${escapeTgHtml(ord.offer_name)}\n` +
        `💰 <b>Məbləğ:</b> ${(ord.price_azn || 0).toFixed(2)} ₼ ($${(ord.price_usd || 0).toFixed(2)})\n` +
        (ord.player_id ? `🎯 <b>ID:</b> <code>${escapeTgHtml(ord.player_id)}</code>\n` : '') +
        `📅 <i>${ord.created_at || '—'}</i>\n\n`;

      kb.text(`🔍 #${ord.id}`, `adm_view_order_${ord.id}`);
      if ((idx + 1) % 2 === 0) kb.row();
    });

    kb.row()
      .text('👤 İstifadəçiyə Qayıt', `adm_view_user_${tid}`)
      .text('🏠 Admin Panel', 'adm_refresh_stats');

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    return;
  }

  // Sifariş Kartına Baxış: adm_view_order_<order_id>
  if (data.startsWith('adm_view_order_')) {
    const ordId = data.replace('adm_view_order_', '');
    await ctx.answerCallbackQuery();
    return handleAdminOrderSearch(ctx, ordId);
  }

  // Müştəri Balans Dəyişdir: adm_ubal_<tg_id>_<action>
  if (data.startsWith('adm_ubal_')) {
    const parts = data.split('_');
    const tid = parts[2];
    const action = parts[3];

    let delta = 0;
    if (action === 'add5') delta = 5;
    if (action === 'add20') delta = 20;
    if (action === 'sub5') delta = -5;

    if (delta !== 0) {
      updateUserBalance(tid, delta);
      const sign = delta > 0 ? `+${delta}` : `${delta}`;
      await ctx.answerCallbackQuery({ text: `Balans yeniləndi: ${sign} ₼ ✅`, show_alert: true });
      return handleAdminUserSearch(ctx, tid);
    }
  }

  // Müştərini Blokla / Blokdan Çıxart: adm_ublk_<tg_id>
  if (data.startsWith('adm_ublk_')) {
    const tid = data.replace('adm_ublk_', '');
    const user = getUserById(tid);
    if (user) {
      const willBlock = user.is_blocked !== 1;
      setUserBlocked(tid, willBlock);
      const alertText = willBlock ? 'İstifadəçi bloklandı (Ban) 🚫' : 'İstifadəçi blokdan çıxarıldı 🟢';
      await ctx.answerCallbackQuery({ text: alertText, show_alert: true });
      return handleAdminUserSearch(ctx, tid);
    }
  }

  // Müştəriyə Şəxsi Mesaj Yaz: adm_umsg_<tg_id>
  if (data.startsWith('adm_umsg_')) {
    const tid = data.replace('adm_umsg_', '');
    await ctx.answerCallbackQuery();
    const { setUserState } = await import('./handlers.js');
    setUserState(ctx.from.id, { step: 'awaiting_user_direct_msg', extra: { targetTgId: tid } });
    await ctx.reply(
      `✉️ <b>MÜŞTƏRİYƏ ŞƏXSİ MESAJ</b>\n\n` +
      `<code>${tid}</code> nömrəli istifadəçiyə göndərmək istədiyiniz mesajı birbaşa bu çata yazın:\n\n` +
      `<i>(İmtina etmək üçün "❌ Ləğv Et" düyməsinə basın):</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Ləğv Et', `adm_view_user_${tid}`),
      }
    );
    return;
  }

  // Nüsxə Yarat
  if (data === 'adm_create_backup') {
    await ctx.answerCallbackQuery({ text: 'Backup hazırlanır və göndərilir...' });
    const res = await backupService.createAndSendBackup(ctx.chat?.id);
    if (res.ok) {
      await ctx.reply('✅ <b>Verilənlər bazasının təhlükəsiz nüsxəsi (Backup) uğurla göndərildi!</b>', { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`❌ Backup xətası: ${res.error}`, { parse_mode: 'HTML' });
    }
    return;
  }

  if (data === 'adm_prompt_broadcast') {
    await ctx.answerCallbackQuery();
    const { setUserState } = await import('./handlers.js');
    setUserState(ctx.from.id, { step: 'awaiting_broadcast_text' });
    await ctx.reply(
      `📢 <b>TOPLU MESAJ (BROADCAST) REJİMİ</b>\n\n` +
      `Bütün bot istifadəçilərinə göndərmək istədiyiniz <b>mətni və ya şəkilli mətni</b> birbaşa bu çata göndərin.\n\n` +
      `<i>(İmtina etmək üçün "❌ Ləğv Et" düyməsinə basın):</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Ləğv Et', 'adm_cancel_broadcast'),
      }
    );
    return;
  }

  if (data === 'adm_prompt_user_search') {
    await ctx.answerCallbackQuery();
    const { setUserState } = await import('./handlers.js');
    setUserState(ctx.from.id, { step: 'awaiting_admin_user_search' });
    await ctx.reply(
      `🔍 <b>İSTİFADƏÇİ AXTARIŞI</b>\n\n` +
      `Axtarmaq istədiyiniz müştərinin <b>Telegram ID</b> və ya <b>@istifadəçi_adı</b>-nı bu çata göndərin:\n\n` +
      `<i>Məsələn: <code>1108583389</code> və ya <code>@username</code></i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Ləğv Et', 'adm_refresh_stats'),
      }
    );
    return;
  }

  if (data === 'adm_prompt_order_search') {
    await ctx.answerCallbackQuery();
    const { setUserState } = await import('./handlers.js');
    setUserState(ctx.from.id, { step: 'awaiting_admin_order_search' });
    await ctx.reply(
      `🧾 <b>SİFARİŞ AXTARIŞI</b>\n\n` +
      `Axtarmaq istədiyiniz <b>Sifariş ID</b>-ni bu çata göndərin:\n\n` +
      `<i>Məsələn: <code>ORD-195336</code> və ya <code>#ORD-195336</code></i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Ləğv Et', 'adm_refresh_stats'),
      }
    );
    return;
  }

  if (data === 'adm_cancel_broadcast') {
    await ctx.answerCallbackQuery({ text: 'Toplu mesaj ləğv edildi.' });
    const { clearUserState } = await import('./handlers.js');
    clearUserState(ctx.from.id);
    await ctx.editMessageText('❌ Toplu mesaj göndərilməsi ləğv edildi.', { parse_mode: 'HTML' });
    return;
  }

  // Qəbzi Təsdiq Et: adm_app_<paymentId>_<amount>
  if (data.startsWith('adm_app_')) {
    const parts = data.split('_');
    const paymentId = parts[2];
    const amount = parseFloat(parts[3]);

    const res = await paymentService.approveReceipt(paymentId, amount);
    if (res.ok) {
      await ctx.answerCallbackQuery({ text: `Qəbz təsdiqləndi! +${amount.toFixed(2)} ₼ əlavə edildi ✅`, show_alert: true });
      const confirmationText = `\n\n✅ <b>TƏSDİQ EDİLDİ: +${amount.toFixed(2)} ₼ balansa yükləndi.</b>`;
      try {
        if (ctx.callbackQuery?.message?.caption) {
          await ctx.editMessageCaption({
            caption: ctx.callbackQuery.message.caption + confirmationText,
            parse_mode: 'HTML',
          });
        } else if (ctx.callbackQuery?.message?.text) {
          await ctx.editMessageText(
            ctx.callbackQuery.message.text + confirmationText,
            { parse_mode: 'HTML' }
          );
        }
      } catch (e) {}
    } else {
      await ctx.answerCallbackQuery({ text: res.error || 'Xəta baş verdi', show_alert: true });
    }
    return;
  }

  // Qəbzi Rədd Et: adm_rej_<paymentId>
  if (data.startsWith('adm_rej_')) {
    const paymentId = data.replace('adm_rej_', '');
    const res = await paymentService.rejectReceipt(paymentId, 'Qəbz məlumatları uyğun gəlmir və ya oxunmur.');
    if (res.ok) {
      await ctx.answerCallbackQuery({ text: 'Qəbz imtina edildi ❌', show_alert: true });
      const rejectText = `\n\n❌ <b>İMTİNA EDİLDİ.</b>`;
      try {
        if (ctx.callbackQuery?.message?.caption) {
          await ctx.editMessageCaption({
            caption: ctx.callbackQuery.message.caption + rejectText,
            parse_mode: 'HTML',
          });
        } else if (ctx.callbackQuery?.message?.text) {
          await ctx.editMessageText(
            ctx.callbackQuery.message.text + rejectText,
            { parse_mode: 'HTML' }
          );
        }
      } catch (e) {}
    } else {
      await ctx.answerCallbackQuery({ text: res.error || 'Xəta baş verdi', show_alert: true });
    }
    return;
  }

  // Toplu Bildiriş Seqment Seçimi: adm_bc_seg_<segment>
  if (data.startsWith('adm_bc_seg_')) {
    const segment = data.replace('adm_bc_seg_', '') as UserSegment;
    const { setUserState } = await import('./handlers.js');
    setUserState(ctx.from.id, {
      step: 'awaiting_broadcast_text',
      extra: { segment }
    });

    const segLabels: Record<string, string> = {
      all: '👥 Bütün İstifadəçilər',
      zero_balance: '💰 Balansı 0 Olanlar',
      active_buyers: '🛍️ Aktiv Alıcılar',
      vip: '💎 VIP Müştərilər',
      inactive_7d: '⏳ 7+ Gün Qeyri-Aktiv'
    };

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🎯 <b>HƏDƏF QRUP SEÇİLDİ:</b> <b>${segLabels[segment] || segment}</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 Zəhmət olmasa bu qrupa göndərmək istədiyiniz <b>mesaj mətnini</b> yazın və ya şəklin altına mətn yazaraq birbaşa şəkil göndərin.\n\n` +
      `<i>💡 HTML formatı dəstəklənir: &lt;b&gt;Qalın&lt;/b&gt;, &lt;i&gt;Kursiv&lt;/i&gt;, &lt;code&gt;Kod&lt;/code&gt;</i>\n\n` +
      `❌ Ləğv etmək üçün: /cancel`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (data === 'adm_bc_cancel') {
    const { clearUserState } = await import('./handlers.js');
    clearUserState(ctx.from.id);
    await ctx.answerCallbackQuery({ text: 'Bildiriş ləğv edildi' });
    await ctx.editMessageText('❌ <b>Toplu bildiriş əməliyyatı ləğv edildi.</b>', { parse_mode: 'HTML' });
    return;
  }
}

export async function handleBroadcastMessage(ctx: Context, text: string, photoFileId?: string, segment: UserSegment = 'all') {
  const users = getUsersBySegment(segment);
  const validUsers = users.filter(u => u.telegram_id && !isNaN(Number(u.telegram_id)));

  const segmentLabels: Record<string, string> = {
    all: 'Bütün İstifadəçilər',
    zero_balance: 'Balansı 0 Olanlar',
    active_buyers: 'Aktiv Alıcılar',
    vip: 'VIP Müştərilər',
    inactive_7d: '7+ Gün Qeyri-Aktiv'
  };

  const segLabel = segmentLabels[segment] || 'Bütün İstifadəçilər';
  const statusMsg = await ctx.reply(`🚀 <b>Hədəfli mesaj göndərilir...</b>\n\n🎯 <b>Seqment:</b> ${segLabel}\n👥 <b>Hədəf:</b> ${validUsers.length} istifadəçi`, { parse_mode: 'HTML' });

  let sent = 0;
  let failed = 0;

  const defaultKb = new InlineKeyboard().text('🎮 Oyunlar Kataloqu', 'menu_games').text('🏠 Əsas Menyu', 'menu_main');
  const payloadText = steganographyService.watermark(text);

  for (const u of validUsers) {
    try {
      if (photoFileId) {
        await ctx.api.sendPhoto(u.telegram_id, photoFileId, {
          caption: payloadText,
          parse_mode: 'HTML',
          reply_markup: defaultKb,
        });
      } else {
        await ctx.api.sendMessage(u.telegram_id, payloadText, {
          parse_mode: 'HTML',
          reply_markup: defaultKb,
        });
      }
      sent++;
      // Təhlükəsiz sürət-limit gecikməsi
      await new Promise(r => setTimeout(r, 40));
    } catch (err: any) {
      failed++;
    }
  }

  const { clearUserState } = await import('./handlers.js');
  clearUserState(ctx.from!.id);

  await ctx.api.editMessageText(
    ctx.chat!.id,
    statusMsg.message_id,
    `✅ <b>HƏDƏFLİ BİLDİRİŞ TAMAMLANDI!</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 <b>Hədəf Qrup:</b> ${segLabel}\n` +
    `📤 <b>Uğurla Çatdırıldı:</b> ${sent} nəfər\n` +
    `⚠️ <b>Çatdırılmadı / Bloklanıb:</b> ${failed} nəfər\n` +
    `👥 <b>Ümumi Hədəf:</b> ${validUsers.length} nəfər`,
    { parse_mode: 'HTML' }
  );
}
