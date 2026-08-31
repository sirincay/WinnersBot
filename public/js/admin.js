function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : '';
}

function getActiveAdminToken() {
  return localStorage.getItem('admin_token') || 
         sessionStorage.getItem('admin_token') || 
         localStorage.getItem('winners_admin_token') || 
         sessionStorage.getItem('winners_admin_token') || 
         getCookie('admin_token') || 
         '';
}

let adminToken = getActiveAdminToken();

function saveAdminToken(token) {
  adminToken = token;
  localStorage.setItem('admin_token', token);
  sessionStorage.setItem('admin_token', token);
  localStorage.setItem('winners_admin_token', token);
  sessionStorage.setItem('winners_admin_token', token);
  document.cookie = 'admin_token=' + encodeURIComponent(token) + '; path=/; max-age=2592000; SameSite=Lax';
}

function clearAdminToken() {
  adminToken = '';
  localStorage.removeItem('admin_token');
  sessionStorage.removeItem('admin_token');
  localStorage.removeItem('winners_admin_token');
  sessionStorage.removeItem('winners_admin_token');
  document.cookie = 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
}

// Saxlanmış XSS-nin qarşısını almaq üçün Yüksək Təhlükəsizlik HTML Təmizləmə Köməkçisi (VULN-02 Fix)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let currentAdminData = {
  stats: {},
  pendingPayments: [],
  orders: [],
  users: []
};

let selectedAdminUser = null;

// Müasir Müəssisə Bildiriş Sistemi (Bloklamayan)
function showToast(type = 'info', message = '') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
  toast.innerHTML = `<span style="font-size: 16px;">${icon}</span><div class="toast-content">${message}</div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Admin Paneldə window.alert-i bloklamayan ekranda toast-a yönləndirmək üçün ləğv et
window.alert = (msg) => {
  const isErr = String(msg).includes('Xəta') || String(msg).includes('⚠️') || String(msg).includes('Error');
  showToast(isErr ? 'error' : 'info', String(msg));
};

// 1-Kliklə Buferə Kopyalama və Geri Bildirim
function copyToClipboard(text, label = 'Məlumat') {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast('success', `${label} kopyalandı: <code>${text}</code>`);
  }).catch(() => {
    showToast('error', 'Kopyalama alınmadı.');
  });
}

// Doğrulanmış Fetch Vücudu
async function authFetch(url, options = {}) {
  const token = getActiveAdminToken();
  const headers = Object.assign({}, options.headers || {});
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-admin-token'] = token;
  }
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleAdminLogout(false);
      throw new Error('Sessiya müddəti bitib və ya icazəsiz cəhd.');
    }
    return res;
  } catch (err) {
    throw err;
  }
}

// ---------------- ADMİN GİRİŞ VƏ TƏHLÜKƏSİZLİK ----------------

async function checkAdminAuth() {
  const token = getActiveAdminToken();
  if (!token) {
    clearAdminToken();
    window.location.replace('/admin');
    return false;
  }

  try {
    const res = await fetch('/api/admin/auth/verify', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'x-admin-token': token
      }
    });
    const data = await res.json();

    if (data && data.ok) {
      return true;
    } else {
      clearAdminToken();
      window.location.replace('/admin');
      return false;
    }
  } catch (e) {
    clearAdminToken();
    window.location.replace('/admin');
    return false;
  }
}

async function handleAdminLogout(notify = true) {
  if (notify && !confirm('Admin panelindən çıxış etmək istəyirsiniz?')) return;

  const token = getActiveAdminToken();
  try {
    if (token) {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'x-admin-token': token
        }
      });
    }
  } catch (e) {}

  clearAdminToken();
  window.location.replace('/admin');
}

function togglePasswordVisibility(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  if (el.type === 'password') {
    el.type = 'text';
    btn.innerText = '🙈';
  } else {
    el.type = 'password';
    btn.innerText = '👁️';
  }
}

if (typeof handleAdminLogin !== 'undefined') window.handleAdminLogin = handleAdminLogin;
if (typeof handleAdminLogout !== 'undefined') window.handleAdminLogout = handleAdminLogout;
if (typeof togglePasswordVisibility !== 'undefined') window.togglePasswordVisibility = togglePasswordVisibility;

async function handleChangePassword(e) {
  e.preventDefault();
  const oldPass = document.getElementById('oldAdminPass').value.trim();
  const newPass = document.getElementById('newAdminPass').value.trim();
  const confirmPass = document.getElementById('confirmAdminPass').value.trim();

  if (newPass !== confirmPass) {
    alert('⚠️ Yeni şifrə ilə şifrə təkrarı eyni deyil!');
    return;
  }

  if (newPass.length < 6) {
    alert('⚠️ Yeni şifrə ən azı 6 simvoldan ibarət olmalıdır.');
    return;
  }

  try {
    const res = await authFetch('/api/admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPass, new_password: newPass })
    });
    const data = await res.json();

    if (data.ok) {
      alert('🔒 Admin şifrəsi uğurla dəyişdirildi! Zəhmət olmasa yeni şifrənizlə yenidən daxil olun.');
      document.getElementById('changePasswordForm').reset();
      handleAdminLogout(false);
    } else {
      alert(`Xəta: ${data.error}`);
    }
  } catch (err) {
    alert('Şifrə yenilənərkən xəta baş verdi.');
  }
}

// ---------------- BÖLMƏ NAVİQASİYASI VƏ MOBİL SÜRÜŞƏN PANEL ----------------
function toggleMobileSidebar(forceState) {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar) return;
  const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
  } else {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  }
}
window.toggleMobileSidebar = toggleMobileSidebar;

function switchSection(secName, btn) {
  toggleMobileSidebar(false); // link seçildikdə mobil çəkməni avtomatik bağla
  const cleanSec = (secName || '').toLowerCase().trim();

  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.remove('active');
    l.classList.remove('bot-link-active');
  });
  if (btn) {
    btn.classList.add('active');
    if (cleanSec === 'bot') {
      btn.classList.add('bot-link-active');
    }
  }

  // Güclü universal bölmə görünmə keçidi
  const allSections = document.querySelectorAll('.content-body > div[id^="sec"]');
  allSections.forEach(el => {
    const rawId = el.id.replace(/^sec/i, '').toLowerCase();
    if (rawId === cleanSec || (cleanSec === 'apipartners' && (rawId === 'apipartners' || rawId === 'apipartner'))) {
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });

  const titles = {
    dashboard: 'İdarəetmə Paneli və Statistika',
    bot: 'Telegram Bot Məhsulları & Canlı Satış Mərkəzi',
    customcatalog: 'Telegram Kateqoriya & Məhsul İdarəetmə Mərkəzi',
    receipts: 'Gözləyən Qəbzlərin Təsdiqi',
    orders: 'Bütün Sifarişlərin Siyahısı',
    users: 'İstifadəçilər və Balanslar',
    products: 'Məhsullar & Canlı API Stok Sistemi',
    apipartners: 'WINNERS API & Docs Mərkəzi',
    pricing: 'Sistem Parametrləri və Rekvizitlər',
    broadcast: 'Bütün Bot İstifadəçilərinə Bildiriş',
    emojis: 'Telegram Premium Emojilər İdarəetmə Mərkəzi'
  };
  document.getElementById('pageTitle').innerText = titles[cleanSec] || 'Admin Paneli';

  if (cleanSec === 'customcatalog') {
    loadApiCatalogDashboard();
  } else if (cleanSec === 'emojis') {
    loadCustomEmojisAdmin();
  } else if (cleanSec === 'products') {
    loadProductsInventory();
  } else if (cleanSec === 'bot') {
    loadBotAnalyticsData();
  } else if (cleanSec === 'users') {
    fetchUsers();
  } else if (cleanSec === 'orders') {
    fetchOrders();
  } else if (cleanSec === 'receipts') {
    fetchPendingReceipts();
  } else if (cleanSec === 'apipartners') {
    fetchAdminApiKeys();
    fetchSettings();
  } else if (cleanSec === 'pricing') {
    fetchSettings();
    fetchBannedIps();
  } else if (cleanSec === 'broadcast') {
    loadBroadcastSegments();
  }
}

// Bütün admin məlumatlarını təhlükəsiz və paralel yüklə
async function loadAllAdminData() {
  const token = getActiveAdminToken();
  if (!token) return;

  await Promise.allSettled([
    (async () => { try { await fetchStats(); } catch(e) { console.error('fetchStats error:', e); } })(),
    (async () => { try { await loadBotAnalyticsData(); } catch(e) { console.error('loadBotAnalyticsData error:', e); } })(),
    (async () => { try { await fetchPendingReceipts(); } catch(e) { console.error('fetchPendingReceipts error:', e); } })(),
    (async () => { try { await fetchOrders(); } catch(e) { console.error('fetchOrders error:', e); } })(),
    (async () => { try { await fetchUsers(); } catch(e) { console.error('fetchUsers error:', e); } })(),
    (async () => { try { await fetchSettings(); } catch(e) { console.error('fetchSettings error:', e); } })(),
    (async () => { try { await fetchBannedIps(); } catch(e) { console.error('fetchBannedIps error:', e); } })()
  ]);
}

// ---------------- TELEGRAM BOT XÜSUSİ ANALİTİKA VƏ MƏHSULLAR ----------------
async function loadBotAnalyticsData() {
  const tableBody = document.getElementById('botProductsTableBody');
  const buyersBody = document.getElementById('botTopBuyersTableBody');

  if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 24px;">⏳ Bot statistikası və canlı qiymətlər hesablanır...</td></tr>';
  }

  try {
    const res = await authFetch('/api/admin/bot-analytics');
    const data = await res.json();

    if (data.ok) {
      // Metrikləri təyin et
      const m = data.metrics;
      const uEl = document.getElementById('botStatUsers');
      if (uEl) uEl.innerText = m.totalUsers || 0;

      const oEl = document.getElementById('botStatOrders');
      if (oEl) oEl.innerText = m.totalOrders || 0;

      const coEl = document.getElementById('botStatCompletedOrders');
      if (coEl) coEl.innerText = `${m.completedOrders || 0} uğurlu təhvil`;

      const rEl = document.getElementById('botStatRevenue');
      if (rEl) rEl.innerText = `${(m.totalRevenueAzn || 0).toFixed(2)} ₼`;

      const pEl = document.getElementById('botStatProfit');
      if (pEl) pEl.innerText = `+${(m.totalProfitAzn || 0).toFixed(2)} ₼`;

      const cEl = document.getElementById('botStatCost');
      if (cEl) cEl.innerText = `Maya: ${(m.totalCostAzn || 0).toFixed(2)} ₼`;

      if (data.botInfo && data.botInfo.username) {
        const link = document.getElementById('botUsernameLink');
        if (link) {
          link.innerText = `${data.botInfo.username} ↗`;
          link.href = data.botInfo.link;
        }
      }

      // Bot Məhsulları Cədvəlini Göstər (Masaüstü)
      if (tableBody && data.products) {
        tableBody.innerHTML = data.products.map(p => {
          const isPlaypin = p.provider === 'playpin' || p.id === 'pubg_mobile_epin' || p.id === 'pubg_mobile_web';
          const provBadge = isPlaypin 
            ? '<span class="status-pill status-completed" style="background: rgba(52, 211, 153, 0.15); color: #34d399; font-size: 9px; font-weight: 700; border: 1px solid rgba(52, 211, 153, 0.35); padding: 1px 5px;">🎮 PlayPin</span>'
            : '<span class="status-pill status-completed" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 9px; font-weight: 700; border: 1px solid rgba(56, 189, 248, 0.35); padding: 1px 5px;">⚡ FazerCards</span>';

          return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 18px;">${p.icon || '🎮'}</span>
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <strong style="color: #fff; font-size: 14px;">${p.name}</strong>
                      ${provBadge}
                    </div>
                    <small style="color: var(--text-muted);">ID: <code>${p.id}</code></small>
                  </div>
                </div>
              </td>
              <td>
                <span class="status-pill ${p.type === 'topup' ? 'status-completed' : 'status-pending'}">
                  ${p.type === 'topup' ? 'Top-Up' : 'E-Pin Kod'}
                </span>
              </td>
              <td>
                <strong style="color: var(--brand-emerald); font-family: var(--font-mono); font-size: 14px;">${p.min_price_azn > 0 ? `${p.min_price_azn.toFixed(2)} ₼-dən` : 'Paketə bax'}</strong>
              </td>
              <td>
                <span class="status-pill status-completed">
                  ${p.offers_count} paket
                </span>
              </td>
              <td><strong>${p.total_orders}</strong> <small style="color: var(--brand-emerald);">(${p.completed_orders} uğurlu)</small></td>
              <td><strong style="color: var(--brand-cyan); font-family: var(--font-mono);">${p.revenue_azn.toFixed(2)} ₼</strong></td>
              <td><strong style="color: var(--brand-emerald); font-family: var(--font-mono);">+${p.profit_azn.toFixed(2)} ₼</strong></td>
              <td>
                <span class="status-pill status-completed">
                  🟢 Canlı API
                </span>
              </td>
              <td>
                <button class="btn-secondary-sm" onclick="viewProductOffers('${p.id}', '${p.type}', '${encodeURIComponent(p.name)}')">
                  Maya &amp; Satış Qiymətləri ➔
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }

      // Bot Məhsulları üçün 2-Sütunlu Yan-yana Mobil Kartları Göstər
      const mobProdContainer = document.getElementById('botProductsMobileCardsContainer');
      if (mobProdContainer && data.products) {
        mobProdContainer.innerHTML = data.products.map(p => {
          const isPlaypin = p.provider === 'playpin' || p.id === 'pubg_mobile_epin' || p.id === 'pubg_mobile_web';
          const provBadge = isPlaypin 
            ? '<span class="status-pill status-completed" style="background: rgba(52, 211, 153, 0.15); color: #34d399; font-size: 9px; font-weight: 700; border: 1px solid rgba(52, 211, 153, 0.35); padding: 0 4px;">🎮 PlayPin</span>'
            : '<span class="status-pill status-completed" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 9px; font-weight: 700; border: 1px solid rgba(56, 189, 248, 0.35); padding: 0 4px;">⚡ FazerCards</span>';

          return `
            <div class="generic-mobile-card">
              <div class="g-card-header">
                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                  <span style="font-size: 18px;">${p.icon || '🎮'}</span>
                  <div style="overflow: hidden;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <strong class="g-card-title">${p.name}</strong>
                      ${provBadge}
                    </div>
                    <div class="g-card-sub">${p.type === 'topup' ? 'Top-Up' : 'E-Pin'} • ${p.offers_count} paket</div>
                  </div>
                </div>
              </div>

              <div class="g-stat-box">
                <div class="g-stat-row">
                  <span style="color: var(--text-muted);">Qiymət:</span>
                  <strong style="color: var(--brand-emerald); font-family: var(--font-mono); font-size: 11px;">${p.min_price_azn > 0 ? `${p.min_price_azn.toFixed(2)} ₼` : 'Seç'}</strong>
                </div>
                <div class="g-stat-row">
                  <span style="color: var(--text-muted);">Sifariş:</span>
                  <strong style="color: #fff;">${p.total_orders} <small style="color: var(--brand-emerald);">(${p.completed_orders})</small></strong>
                </div>
                <div class="g-stat-row">
                  <span style="color: var(--text-muted);">Qazanc:</span>
                  <strong style="color: var(--brand-cyan); font-family: var(--font-mono); font-size: 11px;">+${p.profit_azn.toFixed(2)} ₼</strong>
                </div>
              </div>

              <button class="btn-micro btn-micro-primary" style="width: 100%;" onclick="viewProductOffers('${p.id}', '${p.type}', '${encodeURIComponent(p.name)}')">
                💰 Maya &amp; Qiymətlər ➔
              </button>
            </div>
          `;
        }).join('');
      }

      // Ən Çox Alış Edənlər Cədvəlini Göstər (Masaüstü)
      if (buyersBody && data.topBuyers) {
        if (data.topBuyers.length === 0) {
          buyersBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 20px;">Hələlik bot vasitəsilə sifariş tamamlanmayıb.</td></tr>';
        } else {
          buyersBody.innerHTML = data.topBuyers.map(u => `
            <tr>
              <td>
                <strong style="color: #fff;">${u.first_name || u.username || 'Müştəri'}</strong>
              </td>
              <td><span class="code-pill" onclick="copyToClipboard('${u.telegram_id}', 'Telegram ID')">${u.telegram_id}</span></td>
              <td>${u.username ? `<a href="https://t.me/${u.username}" target="_blank" style="color: #38bdf8; text-decoration: none;">@${u.username}</a>` : '—'}</td>
              <td><strong style="color: var(--brand-emerald);">${u.order_count} sifariş</strong></td>
              <td><strong style="color: var(--brand-cyan); font-family: var(--font-mono); font-size: 14px;">${u.total_spent_azn.toFixed(2)} ₼</strong></td>
              <td><strong style="color: var(--brand-emerald); font-family: var(--font-mono);">${u.balance.toFixed(2)} ₼</strong></td>
            </tr>
          `).join('');
        }
      }

      // Ən Yaxşı Alıcılar üçün 2-Sütunlu Yan-yana Mobil Kartları Göstər
      const mobBuyersContainer = document.getElementById('botBuyersMobileCardsContainer');
      if (mobBuyersContainer && data.topBuyers) {
        if (data.topBuyers.length === 0) {
          mobBuyersContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 16px; grid-column: span 2;">Hələlik bot sifarişi tamamlanmayıb.</div>';
        } else {
          mobBuyersContainer.innerHTML = data.topBuyers.map(u => `
            <div class="generic-mobile-card">
              <div class="g-card-header">
                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                  <div class="u-avatar-badge">👤</div>
                  <div style="overflow: hidden;">
                    <strong class="g-card-title">${u.first_name || u.username || 'Müştəri'}</strong>
                    <div class="g-card-sub">${u.username ? `@${u.username}` : 'ID: ' + u.telegram_id}</div>
                  </div>
                </div>
              </div>

              <div class="g-stat-box">
                <div class="g-stat-row">
                  <span style="color: var(--text-muted);">Sifariş:</span>
                  <strong style="color: var(--brand-emerald);">${u.order_count} ədəd</strong>
                </div>
                <div class="g-stat-row">
                  <span style="color: var(--text-muted);">Xərclənən:</span>
                  <strong style="color: var(--brand-cyan); font-family: var(--font-mono); font-size: 11px;">${u.total_spent_azn.toFixed(2)} ₼</strong>
                </div>
                <div class="g-stat-row">
                  <span style="color: var(--text-muted);">Balans:</span>
                  <strong style="color: var(--brand-emerald); font-family: var(--font-mono); font-size: 11px;">${u.balance.toFixed(2)} ₼</strong>
                </div>
              </div>
            </div>
          `).join('');
        }
      }
    } else {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #f87171; padding: 20px;">Xəta: ${data.error}</td></tr>`;
    }
  } catch (err) {
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #f87171; padding: 20px;">Məlumatlar yüklənərkən xəta baş verdi.</td></tr>';
  }
}

// =========================================================================
// MÜƏSSİSƏ STATİSTİKASI, SATIŞ DİNAMİK QRAFİKİ VƏ TELEMETRİYA
// =========================================================================

var currentSalesChartInstance = null;
var currentChartDays = 7;

async function fetchStats() {
  try {
    const res = await authFetch('/api/admin/stats');
    const data = await res.json();
    if (data.ok && data.stats) {
      currentAdminData.stats = data.stats;
      const s = data.stats;

      if (document.getElementById('statRevenue')) document.getElementById('statRevenue').innerText = `${s.totalRevenueAzn.toFixed(2)} ₼`;
      if (document.getElementById('statTodayRevenue')) document.getElementById('statTodayRevenue').innerText = `Bu gün: ${(s.todayRevenueAzn || 0).toFixed(2)} ₼`;

      if (document.getElementById('statNetProfit')) document.getElementById('statNetProfit').innerText = `${(s.totalNetProfitAzn || 0).toFixed(2)} ₼`;
      if (document.getElementById('statProfitMarginBadge')) document.getElementById('statProfitMarginBadge').innerText = `+${(s.profitMarginPercent || 0).toFixed(1)}% Marja`;
      if (document.getElementById('statTodayProfit')) document.getElementById('statTodayProfit').innerText = `Bu gün: +${(s.todayNetProfitAzn || 0).toFixed(2)} ₼`;

      if (document.getElementById('statTotalCostAzn')) document.getElementById('statTotalCostAzn').innerText = `${(s.totalCostAzn || 0).toFixed(2)} ₼`;
      if (document.getElementById('statTotalCostUsd')) document.getElementById('statTotalCostUsd').innerText = `● $ ${(s.totalCostUsd || 0).toFixed(2)} USD Maya`;
      if (document.getElementById('statTodayCostUsd')) document.getElementById('statTodayCostUsd').innerText = `Bu gün: $ ${(s.todayCostUsd || 0).toFixed(2)}`;

      if (document.getElementById('statDeposits')) document.getElementById('statDeposits').innerText = `${s.totalDepositedAzn.toFixed(2)} ₼`;
      if (document.getElementById('statCompletedOrders')) document.getElementById('statCompletedOrders').innerText = s.completedOrders;
      if (document.getElementById('statTodayOrders')) document.getElementById('statTodayOrders').innerText = `Bu gün: ${s.todayOrders || 0} ədəd`;
      if (document.getElementById('statUsers')) document.getElementById('statUsers').innerText = s.usersCount;
      if (document.getElementById('pendingBadge')) document.getElementById('pendingBadge').innerText = s.pendingPaymentsCount;

      const fBal = document.getElementById('fazerBalDisplay');
      if (fBal) {
        fBal.innerText = `${s.fazerBalance || '0.00'} ${s.fazerCurrency || 'USD'}`;
        if (!s.fazerOk) fBal.style.color = '#f87171';
        else fBal.style.color = '#38bdf8';
      }

      const pBal = document.getElementById('playpinBalDisplay');
      if (pBal) {
        if (!s.playpinConfigured) {
          pBal.innerText = 'Qoşulmayıb';
          pBal.style.color = '#f87171';
        } else if (!s.playpinOk) {
          pBal.innerText = `${s.playpinBalance || '0.00'} USD (Xəta)`;
          pBal.style.color = '#fbbf24';
        } else {
          pBal.innerText = `${s.playpinBalance || '0.00'} USD`;
          pBal.style.color = '#34d399';
        }
      }

      // Dinamik Analitik Qrafiki Göstər
      renderRevenueAnalyticsChart(s.salesTimeline || []);

      // Ən Çox Oynanılan Oyunların Bölgüsünü Göstər
      renderTopGamesBreakdown(s.gameBreakdown || []);
    }
  } catch (e) {
    console.error('Stats error:', e);
  }
}

function renderRevenueAnalyticsChart(timeline) {
  const canvas = document.getElementById('revenueAnalyticsChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const days = currentChartDays;
  const labels = [];
  const revenueData = [];

  const timelineMap = new Map();
  (timeline || []).forEach(t => {
    timelineMap.set(t.order_date, t);
  });

  const monthNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const displayLabel = `${d.getDate()} ${monthNames[d.getMonth()]}`;
    labels.push(displayLabel);

    const entry = timelineMap.get(dateStr);
    revenueData.push(entry ? entry.revenue_azn : 0);
  }

  // Hələ satış yoxdursa, aktual 0 bazasını saxla
  if (currentSalesChartInstance) {
    currentSalesChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 180);
  gradient.addColorStop(0, 'rgba(56, 189, 248, 0.32)');
  gradient.addColorStop(1, 'rgba(56, 189, 248, 0.00)');

  const maxVal = Math.max(...revenueData, 0);

  currentSalesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Gəlir (AZN)',
        data: revenueData,
        borderColor: '#38bdf8',
        borderWidth: 2.5,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#0ea5e9',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: days > 15 ? 2 : 4,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#94a3b8',
          bodyColor: '#38bdf8',
          borderColor: 'rgba(56, 189, 248, 0.3)',
          borderWidth: 1,
          padding: 8,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `Gəlir: ${context.parsed.y.toFixed(2)} ₼`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false
          },
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'Inter' }
          }
        },
        y: {
          suggestedMin: 0,
          suggestedMax: maxVal > 0 ? maxVal * 1.2 : 10,
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false
          },
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'JetBrains Mono, monospace' },
            precision: 0,
            callback: function(val) {
              return Number.isInteger(val) ? val + ' ₼' : '';
            }
          },
          beginAtZero: true
        }
      }
    }
  });
}

function setChartTimeRange(days, btn) {
  currentChartDays = days;
  document.querySelectorAll('.chart-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  fetchStats();
}
window.setChartTimeRange = setChartTimeRange;

function renderTopGamesBreakdown(games) {
  const container = document.getElementById('topGamesStatsList');
  if (!container) return;

  if (!games || games.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div class="game-progress-item">
          <div class="game-progress-top">
            <span class="game-progress-name">🎮 Canlı API Sistemi</span>
            <span class="game-progress-val" style="color: var(--brand-emerald);">Aktiv</span>
          </div>
          <div class="game-bar-track"><div class="game-bar-fill" style="width: 100%; background: linear-gradient(90deg, #10b981, #34d399);"></div></div>
        </div>
        <p style="color: var(--text-muted); font-size: 11px; margin: 4px 0 0 0; line-height: 1.4;">
          Sifarişlər tamamlandıqca ən çox xalis qazanc (xeyir) gətirən kateqoriyaların canlı pay bölgüsü burada real vaxtda görünəcək.
        </p>
      </div>
    `;
    return;
  }

  const maxProfit = Math.max(...games.map(g => (g.profit_azn !== undefined ? g.profit_azn : (g.revenue_azn * 0.05)) || 1), 0.1);
  const totalProfit = games.reduce((acc, g) => acc + (g.profit_azn || 0), 0) || 1;

  const colors = [
    'linear-gradient(90deg, #10b981, #34d399)',
    'linear-gradient(90deg, #0284c7, #38bdf8)',
    'linear-gradient(90deg, #f59e0b, #fbbf24)',
    'linear-gradient(90deg, #8b5cf6, #a855f7)',
    'linear-gradient(90deg, #ec4899, #f43f5e)'
  ];

  container.innerHTML = games.map((g, idx) => {
    const profit = g.profit_azn !== undefined ? g.profit_azn : (g.revenue_azn - (g.cost_azn || g.revenue_azn * 0.95));
    const profitPct = Math.min(Math.max((profit / maxProfit) * 100, 12), 100);
    const shareOfTotal = ((profit / totalProfit) * 100).toFixed(0);

    return `
      <div class="game-progress-item" style="margin-bottom: 11px;">
        <div class="game-progress-top" style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
          <span class="game-progress-name" style="font-weight: 600; font-size: 12.5px; color: var(--text-primary);">
            ${g.category_name || g.category_id}
          </span>
          <span class="game-progress-val" style="font-family: var(--font-mono); font-size: 12px; color: #34d399; font-weight: 700;">
            +${profit.toFixed(2)} ₼ <span style="font-size: 10px; color: var(--text-muted); font-weight: normal;">xeyir (${shareOfTotal}%)</span>
          </span>
        </div>
        <div class="game-bar-track" style="height: 6px; background: rgba(255, 255, 255, 0.06); border-radius: 4px; overflow: hidden;">
          <div class="game-bar-fill" style="width: ${profitPct}%; height: 100%; border-radius: 4px; background: ${colors[idx % colors.length]}; transition: width 0.4s ease;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: var(--text-muted); margin-top: 3px;">
          <span>Satış: ${(g.revenue_azn || 0).toFixed(2)} ₼</span>
          <span>${g.completed_orders || 0} uğurlu sifariş</span>
        </div>
      </div>
    `;
  }).join('');
}

// Gözləyən Qəbzləri Gətir
async function fetchPendingReceipts() {
  try {
    const res = await authFetch('/api/admin/payments/pending');
    const data = await res.json();
    if (data.ok) {
      currentAdminData.pendingPayments = data.payments || [];
      renderPendingReceipts(currentAdminData.pendingPayments);
    }
  } catch (e) {
    console.error('Receipts fetch error:', e);
  }
}

function renderPendingReceipts(list) {
  const tbody = document.getElementById('pendingReceiptsTableBody');
  const mobReceiptsContainer = document.getElementById('receiptsMobileCardsContainer');
  if (document.getElementById('pendingBadge')) {
    document.getElementById('pendingBadge').innerText = list.length;
  }

  if (tbody) {
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 24px;">Gözləyən qəbz yoxdur. Bütün ödənişlər təsdiqlənib!</td></tr>';
    } else {
      tbody.innerHTML = list.map(p => {
        const customerName = p.first_name || p.username || 'Müştəri';
        const token = localStorage.getItem('adminToken') || '';
        const imgUrl = `/api/admin/receipt-image/${p.id}?token=${encodeURIComponent(token)}`;
        return `
        <tr>
          <td>
            ${p.receipt_path ? `
              <div style="position: relative; display: inline-block; cursor: pointer;" onclick="openReceiptModal('${p.id}')">
                <img src="${imgUrl}" class="receipt-thumb" alt="Qəbz" onerror="this.onerror=null; this.src='https://placehold.co/44x44/0f172a/38bdf8?text=📄';" style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-medium); transition: transform 0.15s ease;">
                <div style="position: absolute; bottom: -2px; right: -2px; background: rgba(15, 23, 42, 0.9); border-radius: 4px; padding: 1px 3px; font-size: 9px; color: var(--brand-cyan);">🔍</div>
              </div>
            ` : '—'}
          </td>
          <td><span class="code-pill" onclick="copyToClipboard('${p.id}', 'Ödəniş ID')">${p.id}</span></td>
          <td>
            <strong style="color: #fff;">${customerName}</strong><br>
            <small style="color: var(--text-secondary);">ID: ${p.telegram_id}</small>
          </td>
          <td><span class="status-pill status-pending">${p.method.toUpperCase()}</span></td>
          <td><strong style="color: var(--brand-emerald); font-family: var(--font-mono); font-size: 15px;">${p.amount_azn ? `${p.amount_azn.toFixed(2)} ₼` : 'Qəbzdən bax'}</strong></td>
          <td><small style="color: var(--text-muted);">${p.created_at}</small></td>
          <td>
            <div class="btn-action-group">
              <button type="button" class="btn-receipt-pill" onclick="approvePayment('${p.id}', 5)">+5₼</button>
              <button type="button" class="btn-receipt-pill" onclick="approvePayment('${p.id}', 10)">+10₼</button>
              <button type="button" class="btn-receipt-pill" onclick="approvePayment('${p.id}', 20)">+20₼</button>
              <button type="button" class="btn-receipt-pill" onclick="approvePayment('${p.id}', 50)">+50₼</button>
              <button type="button" class="btn-receipt-custom" onclick="openPaymentCustomAmountModal('${p.id}', '${escapeHtml(customerName)}')">✏️ Digər</button>
              <button type="button" class="btn-receipt-reject" onclick="openPaymentRejectModal('${p.id}')">❌ İmtina</button>
            </div>
          </td>
        </tr>
      `}).join('');
    }
  }

  if (mobReceiptsContainer) {
    if (list.length === 0) {
      mobReceiptsContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 24px; grid-column: span 2;">Gözləyən depozit sorğusu yoxdur.</div>';
    } else {
      mobReceiptsContainer.innerHTML = list.map(p => {
        const customerName = p.first_name || p.username || 'Müştəri';
        const token = localStorage.getItem('adminToken') || '';
        const imgUrl = `/api/admin/receipt-image/${p.id}?token=${encodeURIComponent(token)}`;
        return `
        <div class="generic-mobile-card">
          <div class="g-card-header">
            <div style="overflow: hidden;">
              <strong class="g-card-title">${customerName}</strong>
              <div class="g-card-sub">ID: ${p.telegram_id} • ${p.method.toUpperCase()}</div>
            </div>
            <span class="status-pill status-pending" style="font-size: 9px; padding: 1px 5px;">GÖZLƏYİR</span>
          </div>

          <div class="g-stat-box">
            <div class="g-stat-row">
              <span style="color: var(--text-muted);">Məbləğ:</span>
              <strong style="color: var(--brand-emerald); font-family: var(--font-mono);">${p.amount_azn ? `${p.amount_azn.toFixed(2)} ₼` : 'Qəbzdə'}</strong>
            </div>
            ${p.receipt_path ? `<div style="margin-top: 6px; text-align: center;"><a href="javascript:void(0)" onclick="openReceiptModal('${p.id}')" style="font-size: 11.5px; color: var(--brand-cyan); font-weight: 600;">🖼️ Qəbz Şəklinə Bax & Təsdiqlə ↗</a></div>` : ''}
          </div>

          <div class="u-card-btn-row">
            <button class="btn-micro btn-micro-primary" onclick="openPaymentCustomAmountModal('${p.id}', '${escapeHtml(customerName)}')">
              ✅ Təsdiqlə
            </button>
            <button class="btn-micro" style="color: var(--brand-rose); border-color: rgba(244, 63, 94, 0.3);" onclick="openPaymentRejectModal('${p.id}')">
              ❌ İmtina
            </button>
          </div>
        </div>
      `}).join('');
    }
  }
}

// Aktiv modal vəziyyəti istinadları
let activeReceiptPayment = null;
let activeRejectPaymentId = null;
let activeCustomAmountPaymentId = null;

// ==========================================
// 1. QƏBZ ŞƏKLİ DETAL MODALI
// ==========================================
async function openReceiptModal(paymentId) {
  const p = (currentAdminData.pendingPayments || []).find(item => item.id === paymentId);
  if (!p) return;
  activeReceiptPayment = p;

  document.getElementById('receiptModalTitle').innerText = `Ödəniş Qəbzi #${p.id}`;
  document.getElementById('receiptModalSub').innerText = `KOD: ${p.id} • ${p.method.toUpperCase()}`;
  document.getElementById('receiptModalCustomer').innerText = p.first_name || p.username || 'Müştəri';
  document.getElementById('receiptModalTgId').innerText = p.telegram_id || '—';
  document.getElementById('receiptModalMethod').innerText = p.method ? p.method.toUpperCase() : 'M10';
  document.getElementById('receiptModalDate').innerText = p.created_at || '—';

  const imgEl = document.getElementById('receiptModalImg');
  const loadingEl = document.getElementById('receiptModalImgLoading');
  const errorEl = document.getElementById('receiptModalImgError');
  const fullLink = document.getElementById('receiptModalFullLink');

  const token = localStorage.getItem('adminToken') || '';
  const imgUrl = `/api/admin/receipt-image/${p.id}?token=${encodeURIComponent(token)}`;
  fullLink.href = imgUrl;

  loadingEl.style.display = 'block';
  errorEl.style.display = 'none';
  imgEl.style.display = 'none';

  const modal = document.getElementById('paymentReceiptDetailModal');
  if (modal) modal.style.display = 'flex';

  try {
    const fetchRes = await authFetch(`/api/admin/receipt-image/${p.id}`);
    if (fetchRes.ok) {
      const blob = await fetchRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      imgEl.onload = () => {
        loadingEl.style.display = 'none';
        imgEl.style.display = 'block';
      };
      imgEl.src = objectUrl;
    } else {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
    }
  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

function closeReceiptModal() {
  const modal = document.getElementById('paymentReceiptDetailModal');
  if (modal) modal.style.display = 'none';
  activeReceiptPayment = null;
}

function approveFromReceiptModal(amount) {
  if (!activeReceiptPayment) return;
  const paymentId = activeReceiptPayment.id;
  closeReceiptModal();
  approvePayment(paymentId, amount);
}

function openCustomAmountFromReceiptModal() {
  if (!activeReceiptPayment) return;
  const p = activeReceiptPayment;
  closeReceiptModal();
  openPaymentCustomAmountModal(p.id, p.first_name || p.username || 'Müştəri');
}

function openRejectModalFromReceipt() {
  if (!activeReceiptPayment) return;
  const paymentId = activeReceiptPayment.id;
  closeReceiptModal();
  openPaymentRejectModal(paymentId);
}

// ==========================================
// 2. PEŞƏKAR ÖDƏNİŞ RƏDD MODALI
// ==========================================
function openPaymentRejectModal(paymentId) {
  activeRejectPaymentId = paymentId;
  document.getElementById('rejectModalPaymentId').innerText = `Ödəniş ID: ${paymentId}`;
  document.getElementById('rejectModalReasonInput').value = 'Qəbz məlumatları uyğun gəlmir.';
  
  const modal = document.getElementById('paymentRejectModal');
  if (modal) modal.style.display = 'flex';
  setTimeout(() => {
    document.getElementById('rejectModalReasonInput')?.focus();
  }, 100);
}

function closePaymentRejectModal() {
  const modal = document.getElementById('paymentRejectModal');
  if (modal) modal.style.display = 'none';
  activeRejectPaymentId = null;
}

function setRejectReason(reasonText) {
  const input = document.getElementById('rejectModalReasonInput');
  if (input) {
    input.value = reasonText;
    input.focus();
  }
}

async function submitPaymentReject() {
  if (!activeRejectPaymentId) return;
  const reason = document.getElementById('rejectModalReasonInput')?.value?.trim() || 'Qəbz məlumatları uyğun gəlmir.';
  const paymentId = activeRejectPaymentId;

  try {
    const res = await authFetch('/api/admin/payments/reject', {
      method: 'POST',
      body: JSON.stringify({ payment_id: paymentId, reason })
    });
    const data = await res.json();
    if (data.ok) {
      closePaymentRejectModal();
      loadAllAdminData();
    } else {
      alert(`Xəta: ${data.error}`);
    }
  } catch (e) {
    alert('Xəta baş verdi.');
  }
}

// ==========================================
// 3. PEŞƏKAR XÜSUSİ MƏBLƏĞ TƏSDİQ MODALI
// ==========================================
function openPaymentCustomAmountModal(paymentId, customerName) {
  activeCustomAmountPaymentId = paymentId;
  document.getElementById('customAmountModalPaymentId').innerText = `Ödəniş ID: ${paymentId}`;
  document.getElementById('customAmountModalCustomer').innerText = customerName || 'Müştəri';
  
  const input = document.getElementById('customAmountModalInput');
  if (input) input.value = '';

  const modal = document.getElementById('paymentCustomAmountModal');
  if (modal) modal.style.display = 'flex';
  setTimeout(() => {
    document.getElementById('customAmountModalInput')?.focus();
  }, 100);
}

function closePaymentCustomAmountModal() {
  const modal = document.getElementById('paymentCustomAmountModal');
  if (modal) modal.style.display = 'none';
  activeCustomAmountPaymentId = null;
}

function setCustomAmountVal(val) {
  const input = document.getElementById('customAmountModalInput');
  if (input) {
    input.value = val;
    input.focus();
  }
}

async function submitCustomAmountApproval() {
  if (!activeCustomAmountPaymentId) return;
  const input = document.getElementById('customAmountModalInput');
  const amount = parseFloat(input?.value);
  if (isNaN(amount) || amount <= 0) {
    alert('Zəhmət olmasa düzgün məbləğ daxil edin (məs: 25.50)');
    input?.focus();
    return;
  }

  const paymentId = activeCustomAmountPaymentId;
  closePaymentCustomAmountModal();
  approvePayment(paymentId, amount);
}

// Ödənişi Təsdiq Et Fəaliyyəti
async function approvePayment(paymentId, amount) {
  try {
    const res = await authFetch('/api/admin/payments/approve', {
      method: 'POST',
      body: JSON.stringify({ payment_id: paymentId, amount_azn: amount })
    });
    const data = await res.json();
    if (data.ok) {
      loadAllAdminData();
    } else {
      alert(`Xəta: ${data.error}`);
    }
  } catch (e) {
    alert('Sistem xətası baş verdi.');
  }
}

// Köməkçi escapeHtml
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Sifarişləri Gətir
async function fetchOrders() {
  try {
    const res = await authFetch('/api/admin/orders?limit=100');
    const data = await res.json();
    if (data.ok) {
      const realOrders = (data.orders || []).filter(o => !o.id.startsWith('SB-') && o.telegram_id !== '999000111');
      currentAdminData.orders = realOrders;
      renderRecentOrders(realOrders.slice(0, 10));
      renderAllOrders(realOrders);
    }
  } catch (e) {
    console.error('Orders error:', e);
  }
}

// FazerCards və PlayPin-dən Sifarişləri Əl ilə Sinxronlaşdır
async function triggerManualUpstreamSync(btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Sinxronlaşdırılır...</span>';
  }
  try {
    const res = await authFetch('/api/admin/sync-upstream', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      showToast(`✅ ${data.total} xarici sifariş sinxronlaşdırıldı (FazerCards: ${data.syncedFazer}, PlayPin: ${data.syncedPlaypin})`, 'success');
      await Promise.all([fetchStats(), fetchOrders()]);
    } else {
      showToast('Sinxronlaşdırma zamanı xəta: ' + (data.error || 'Xəta'), 'error');
    }
  } catch (e) {
    showToast('Provayderlərlə əlaqə xətası', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Provayderləri Sinxronlaşdır
      `;
    }
  }
}

function renderRecentOrders(list) {
  const tbody = document.getElementById('recentOrdersTableBody');
  const mobRecentContainer = document.getElementById('recentOrdersMobileCardsContainer');

  if (tbody) {
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 24px;">Hələlik sifariş yoxdur.</td></tr>';
    } else {
      tbody.innerHTML = list.map(o => `
        <tr>
          <td><span class="code-pill" onclick="copyToClipboard('${o.id}', 'Sifariş ID')">${o.id}</span></td>
          <td>
            <strong style="color: #fff;">${o.first_name || o.username || 'Müştəri'}</strong><br>
            <small style="color: var(--text-secondary);">ID: ${o.telegram_id}</small>
          </td>
          <td><strong>${o.category_name}</strong> - ${o.offer_name}</td>
          <td><code>${o.player_id || '—'}</code></td>
          <td><strong style="color: var(--brand-cyan); font-family: var(--font-mono);">${o.price_azn.toFixed(2)} ₼</strong></td>
          <td>
            <span class="status-pill ${o.status === 'completed' ? 'status-completed' : o.status === 'failed' ? 'status-failed' : 'status-pending'}">
              ${o.status.toUpperCase()}
            </span>
          </td>
          <td><small style="color: var(--text-muted);">${o.created_at}</small></td>
        </tr>
      `).join('');
    }
  }

  // Son Sifarişlər üçün 2-Sütunlu Yan-Yana Mobil Kartlar
  if (mobRecentContainer) {
    if (list.length === 0) {
      mobRecentContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 16px; grid-column: span 2;">Hələlik sifariş yoxdur.</div>';
    } else {
      mobRecentContainer.innerHTML = list.map(o => `
        <div class="generic-mobile-card">
          <div class="g-card-header">
            <div style="overflow: hidden;">
              <strong class="g-card-title">${o.category_name}</strong>
              <div class="g-card-sub">${o.offer_name}</div>
            </div>
            <span class="status-pill ${o.status === 'completed' ? 'status-completed' : o.status === 'failed' ? 'status-failed' : 'status-pending'}" style="font-size: 9px; padding: 1px 5px;">
              ${o.status.toUpperCase()}
            </span>
          </div>

          <div class="g-stat-box">
            <div class="g-stat-row">
              <span style="color: var(--text-muted);">Məbləğ:</span>
              <strong style="color: var(--brand-cyan); font-family: var(--font-mono);">${o.price_azn.toFixed(2)} ₼</strong>
            </div>
            <div class="g-stat-row">
              <span style="color: var(--text-muted);">Müştəri:</span>
              <span style="color: #fff; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${o.first_name || o.username || o.telegram_id}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted);">
            <span class="code-pill" onclick="copyToClipboard('${o.id}', 'Sifariş ID')">${o.id}</span>
            <span>${o.created_at || ''}</span>
          </div>
        </div>
      `).join('');
    }
  }
}

function renderAllOrders(list) {
  const tbody = document.getElementById('allOrdersTableBody');
  const mobOrdersContainer = document.getElementById('ordersMobileCardsContainer');

  if (document.getElementById('totalOrdersCountDisplay')) {
    document.getElementById('totalOrdersCountDisplay').innerText = list.length;
  }

  if (tbody) {
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 24px;">Sifariş tapılmadı.</td></tr>';
    } else {
      tbody.innerHTML = list.map(o => `
        <tr>
          <td><span class="code-pill" onclick="copyToClipboard('${o.id}', 'Sifariş ID')">${o.id}</span></td>
          <td>
            <strong style="color: #fff;">${o.first_name || o.username || 'Müştəri'}</strong><br>
            <small style="color: var(--text-secondary); cursor: pointer;" onclick="copyToClipboard('${o.telegram_id}', 'Telegram ID')">ID: <code>${o.telegram_id}</code></small>
          </td>
          <td><strong>${o.category_name}</strong></td>
          <td>${o.offer_name}</td>
          <td>
            ${o.player_id ? `<span class="code-pill" onclick="copyToClipboard('${o.player_id}', 'Oyunçu ID')">${o.player_id}</span>` : (o.gift_code ? `<span class="code-pill" onclick="copyToClipboard('${o.gift_code}', 'E-Pin Kodu')">KOD: ${o.gift_code}</span>` : '—')}
          </td>
          <td><strong style="color: var(--brand-cyan); font-family: var(--font-mono);">${o.price_azn.toFixed(2)} ₼</strong></td>
          <td><span style="color: var(--text-muted); font-family: var(--font-mono);">$${o.price_usd.toFixed(2)}</span></td>
          <td><small style="color: var(--text-muted); font-family: var(--font-mono);">${o.fazercards_order_id || '—'}</small></td>
          <td>
            <span class="status-pill ${o.status === 'completed' ? 'status-completed' : o.status === 'failed' ? 'status-failed' : 'status-pending'}">
              ${o.status.toUpperCase()}
            </span>
          </td>
          <td><small style="color: var(--text-muted);">${o.created_at}</small></td>
        </tr>
      `).join('');
    }
  }

  // Sifarişlər üçün 2-Sütunlu Yan-Yana Mobil Kartlar
  if (mobOrdersContainer) {
    if (list.length === 0) {
      mobOrdersContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 24px; grid-column: span 2;">Sifariş tapılmadı.</div>';
    } else {
      mobOrdersContainer.innerHTML = list.map(o => `
        <div class="generic-mobile-card">
          <div class="g-card-header">
            <div style="overflow: hidden;">
              <strong class="g-card-title">${o.category_name}</strong>
              <div class="g-card-sub">${o.offer_name}</div>
            </div>
            <span class="status-pill ${o.status === 'completed' ? 'status-completed' : o.status === 'failed' ? 'status-failed' : 'status-pending'}" style="font-size: 9px; padding: 1px 5px;">
              ${o.status.toUpperCase()}
            </span>
          </div>

          <div class="g-stat-box">
            <div class="g-stat-row">
              <span style="color: var(--text-muted);">Məbləğ:</span>
              <strong style="color: var(--brand-cyan); font-family: var(--font-mono);">${o.price_azn.toFixed(2)} ₼</strong>
            </div>
            <div class="g-stat-row">
              <span style="color: var(--text-muted);">Müştəri:</span>
              <span style="color: #fff; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${o.first_name || o.username || o.telegram_id}</span>
            </div>
            <div class="g-stat-row">
              <span style="color: var(--text-muted);">ID/Kod:</span>
              <span style="font-size: 10px; font-family: var(--font-mono); color: var(--brand-emerald);">${o.player_id || (o.gift_code ? 'E-Pin Kod' : '—')}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted);">
            <span class="code-pill" onclick="copyToClipboard('${o.id}', 'Sifariş ID')">${o.id}</span>
            <span>${o.created_at || ''}</span>
          </div>
        </div>
      `).join('');
    }
  }
}

function handleOrderSearch() {
  const input = document.getElementById('orderSearchInput') || document.getElementById('searchOrderInput');
  const query = (input ? input.value : '').toLowerCase().trim();
  if (!query) {
    renderAllOrders(currentAdminData.orders);
    return;
  }

  const filtered = (currentAdminData.orders || []).filter(o => 
    (o.id && o.id.toLowerCase().includes(query)) ||
    (o.player_id && o.player_id.toLowerCase().includes(query)) ||
    (o.telegram_id && o.telegram_id.toString().includes(query)) ||
    (o.category_name && o.category_name.toLowerCase().includes(query)) ||
    (o.offer_name && o.offer_name.toLowerCase().includes(query)) ||
    (o.username && o.username.toLowerCase().includes(query))
  );
  renderAllOrders(filtered);
}
window.filterOrdersList = handleOrderSearch;

// İstifadəçiləri Gətir
async function fetchUsers() {
  try {
    const res = await authFetch('/api/admin/users');
    const data = await res.json();
    if (data.ok) {
      currentAdminData.users = data.users || [];
      renderUsers(currentAdminData.users);
    }
  } catch (e) {
    console.error('Users error:', e);
  }
}

function renderUsers(list) {
  const tbody = document.getElementById('usersTableBody');
  const mobUsersContainer = document.getElementById('usersMobileCardsContainer');

  if (document.getElementById('totalUsersCountDisplay')) {
    document.getElementById('totalUsersCountDisplay').innerText = list.length;
  }

  if (tbody) {
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 24px;">İstifadəçi tapılmadı.</td></tr>';
    } else {
      tbody.innerHTML = list.map(u => {
        const isIpBan = u.is_ip_banned === 1 || (u.block_reason && u.block_reason.includes('IP Ban'));
        const isBlocked = u.is_blocked === 1 || isIpBan;
        const nameEscaped = encodeURIComponent(u.first_name || u.username || u.telegram_id);
        const statusBadge = isBlocked 
          ? `<span class="status-pill status-failed" title="${u.ip_ban_reason || u.block_reason || 'Bloklanıb'}"><span class="status-dot-danger"></span> ${isIpBan ? '⛔ IP Ban' : 'Bloklanıb'}</span>`
          : `<span class="status-pill status-completed"><span class="status-dot-pulse"></span> Aktiv</span>`;

        const ipDisplay = u.last_ip 
          ? `<div style="margin-top: 3px; font-family: var(--font-mono); font-size: 11px; color: ${isIpBan ? '#f87171' : '#38bdf8'}; font-weight: ${isIpBan ? '700' : '400'};">${u.last_ip} ${isIpBan ? '<span style="color: #ef4444; font-size: 10px;" title="Bu IP ünvanı Banned siyahısındadır">⛔ (Ban)</span>' : ''}</div>`
          : '<div style="margin-top: 3px; font-size: 10px; color: var(--text-muted);">IP qeyd yoxdur</div>';

        return `
          <tr style="${isBlocked ? 'background: rgba(239,68,68,0.06);' : ''}">
            <td><span class="code-pill" onclick="copyToClipboard('${u.telegram_id}', 'Telegram ID')">${u.telegram_id}</span></td>
            <td class="clickable-user-cell" onclick="openUserDossierModal('${u.telegram_id}')" title="Ətraflı statistika və müştəri profilini açmaq üçün klikləyin">
              <strong style="color: #fff;">${u.first_name || u.username || 'İstifadəçi'}</strong><br>
              <small style="color: var(--text-secondary);">${u.username ? `@${u.username}` : 'Yoxdur'}</small>
            </td>
            <td><strong style="color: var(--brand-emerald); font-family: var(--font-mono); font-size: 14px;">${(u.balance || 0).toFixed(2)} ₼</strong></td>
            <td><strong>${u.total_orders || 0} sifariş</strong></td>
            <td><strong style="color: #38bdf8; font-family: var(--font-mono);">${(u.total_spent || u.total_deposited || 0).toFixed(2)} ₼</strong></td>
            <td>
              ${statusBadge}
              ${ipDisplay}
            </td>
            <td>
              <span class="status-pill ${u.is_admin ? 'status-completed' : 'status-pending'}">
                ${u.is_admin ? 'Admin' : 'Müştəri'}
              </span>
            </td>
            <td><small style="color: var(--text-muted);">${u.created_at || '—'}</small></td>
            <td>
              <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button class="btn-action-outline btn-action-blue" onclick="openUserDossierModal('${u.telegram_id}')" title="360° Müştəri Dosyesi & Ətraflı Statistika">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                  <span>Profil</span>
                </button>
                <button class="btn-action-outline btn-action-blue" onclick="openUserBalanceModal('${u.telegram_id}', '${nameEscaped}', ${u.balance || 0})" title="Balansı Dəyiş">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                  <span>Balans</span>
                </button>
                <button class="btn-action-outline ${u.is_admin ? 'btn-action-rose' : 'btn-action-purple'}" onclick="toggleUserRole('${u.telegram_id}', ${u.is_admin})" title="${u.is_admin ? 'Admin hüququnu sil' : 'Admin təyin et'}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  <span>${u.is_admin ? 'Admini Sil' : 'Admin Et'}</span>
                </button>
                ${isBlocked 
                  ? `<button class="btn-action-outline btn-action-emerald" onclick="unblockUser('${u.telegram_id}')" title="Hesabın blokunu aç">
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                       <span>Aç</span>
                     </button>`
                  : `<button class="btn-action-outline btn-action-amber" onclick="openUserBlockModal('${u.telegram_id}', '${nameEscaped}')" title="Hesabı blokla (bot və saytdan)">
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                       <span>Blokla</span>
                     </button>`
                }
                <button class="btn-action-outline btn-action-orange" onclick="openIpBanModal('${u.last_ip || ''}', '${u.telegram_id}', '${nameEscaped}')" title="IP Blokla (Ban)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                  <span>IP Ban</span>
                </button>
                <button class="btn-action-outline btn-action-red" onclick="openUserDeleteModal('${u.telegram_id}', '${nameEscaped}')" title="İstifadəçini və bütün qeydlərini bazadan birdəfəlik sil">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  <span>Sil</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // İstifadəçilər üçün 2-Sütunlu Yan-Yana Mobil Kartlar
  if (mobUsersContainer) {
    if (!list || list.length === 0) {
      mobUsersContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 24px; grid-column: span 2;">İstifadəçi tapılmadı.</div>';
    } else {
      mobUsersContainer.innerHTML = list.map(u => {
        const isIpBan = u.is_ip_banned === 1 || (u.block_reason && u.block_reason.includes('IP Ban'));
        const isBlocked = u.is_blocked === 1 || isIpBan;
        const nameEscaped = encodeURIComponent(u.first_name || u.username || u.telegram_id);
        const statusBadge = isBlocked 
          ? `<span class="status-pill status-failed" style="font-size:9px; padding:2px 6px;"><span class="status-dot-danger"></span> ${isIpBan ? '⛔ IP Ban' : 'Blok'}</span>`
          : `<span class="status-pill status-completed" style="font-size:9px; padding:2px 6px;"><span class="status-dot-pulse"></span> Aktiv</span>`;

        return `
          <div class="user-mobile-card" style="${isBlocked ? 'border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.06);' : ''}">
            <div class="u-card-top">
              <div class="u-avatar-badge" onclick="openUserDossierModal('${u.telegram_id}')" style="cursor: pointer;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <div style="display: flex; gap: 4px; align-items: center;">
                ${statusBadge}
                <span class="status-pill ${u.is_admin ? 'status-completed' : 'status-pending'}" style="font-size: 9px; padding: 1px 5px;">${u.is_admin ? 'Admin' : 'Müştəri'}</span>
              </div>
            </div>

            <div class="u-names-box clickable-user-cell" onclick="openUserDossierModal('${u.telegram_id}')">
              <strong class="u-name-txt">${u.first_name || u.username || 'Müştəri'}</strong>
              <span class="u-handle-txt">${u.username ? `@${u.username}` : 'ID: ' + u.telegram_id}</span>
            </div>

            <div class="u-balance-cell">
              <span class="u-bal-title">Balans:</span>
              <span class="u-bal-num">${(u.balance || 0).toFixed(2)} ₼</span>
            </div>

            <div class="u-meta-counts">
              <span>Sifariş: <strong>${u.total_orders || 0}</strong></span>
              <span style="color: var(--brand-cyan); font-family: var(--font-mono);">${(u.total_spent || u.total_deposited || 0).toFixed(2)} ₼</span>
            </div>

            <div class="u-card-btn-row" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
              <button class="btn-action-outline btn-action-blue" onclick="openUserDossierModal('${u.telegram_id}')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                <span>Profil</span>
              </button>
              <button class="btn-action-outline btn-action-blue" onclick="openUserBalanceModal('${u.telegram_id}', '${nameEscaped}', ${u.balance || 0})">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                <span>Balans</span>
              </button>
              <button class="btn-action-outline ${u.is_admin ? 'btn-action-rose' : 'btn-action-purple'}" onclick="toggleUserRole('${u.telegram_id}', ${u.is_admin})">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                <span>${u.is_admin ? 'Ləğv' : 'Admin'}</span>
              </button>
              ${isBlocked 
                ? `<button class="btn-action-outline btn-action-emerald" onclick="unblockUser('${u.telegram_id}')">
                     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                     <span>Aç</span>
                   </button>`
                : `<button class="btn-action-outline btn-action-amber" onclick="openUserBlockModal('${u.telegram_id}', '${nameEscaped}')">
                     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                     <span>Blok</span>
                   </button>`
              }
              <button class="btn-action-outline btn-action-orange" onclick="openIpBanModal('${u.last_ip || ''}', '${u.telegram_id}', '${nameEscaped}')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                <span>IP</span>
              </button>
              <button class="btn-action-outline btn-action-red" onclick="openUserDeleteModal('${u.telegram_id}', '${nameEscaped}')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                <span>Sil</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// ---------------- 360-DƏRƏCƏLİ MÜŞTƏRİ DOSYESİ VƏ ANALİTİKA İDARƏEDİCİSİ ----------------
let currentDossierTelegramId = null;

async function openUserDossierModal(telegramId) {
  currentDossierTelegramId = telegramId.toString();
  const modal = document.getElementById('userProfileDossierModal');
  if (modal) modal.style.display = 'flex';

  // Yükləmə yer tutucularını təyin et
  document.getElementById('dossierUserName').innerText = 'Yüklənir...';
  document.getElementById('dossierUserUsername').innerText = '@...';
  document.getElementById('dossierUserTgId').innerText = `ID: ${telegramId}`;
  document.getElementById('dossierUserRegDate').innerText = 'Qeydiyyat: ...';
  document.getElementById('dossierUserIp').innerText = 'IP: ...';
  document.getElementById('dossierBalVal').innerText = '... ₼';
  document.getElementById('dossierDepositVal').innerText = '... ₼';
  document.getElementById('dossierOrdersVal').innerText = '...';
  document.getElementById('dossierSpentVal').innerText = '... ₼';

  try {
    const res = await authFetch(`/api/admin/users/${telegramId}/details`);
    const data = await res.json();

    if (!data.ok || !data.data) {
      alert(data.error || 'İstifadəçi məlumatları tapılmadı.');
      closeUserDossierModal();
      return;
    }

    const { user, stats, orders, payments, reviews, promocodes, referrals } = data.data;

    // Başlıq Bioqrafiyası
    const name = user.first_name || user.username || `İstifadəçi #${user.telegram_id}`;
    document.getElementById('dossierUserName').innerText = name;
    document.getElementById('dossierAvatarInitial').innerText = (name.charAt(0) || 'U').toUpperCase();

    const usernameEl = document.getElementById('dossierUserUsername');
    if (user.username) {
      usernameEl.innerHTML = `<a href="https://t.me/${user.username}" target="_blank" style="color: #38bdf8; text-decoration: none;">@${user.username} ↗</a>`;
    } else {
      usernameEl.innerText = 'Username yoxdur';
    }

    document.getElementById('dossierUserTgId').innerText = `ID: ${user.telegram_id}`;
    document.getElementById('dossierUserRegDate').innerText = `Qeydiyyat: ${user.created_at || '—'}`;
    document.getElementById('dossierUserIp').innerText = user.last_ip ? `IP: ${user.last_ip}` : 'IP: Qeyd yoxdur';

    // Status Nişanı
    const statusBadge = document.getElementById('dossierStatusBadge');
    if (user.is_blocked === 1) {
      statusBadge.className = 'status-pill status-failed';
      statusBadge.innerHTML = `<span class="status-dot-danger"></span> Bloklanıb (${user.block_reason || 'Qayda pozuntusu'})`;
    } else {
      statusBadge.className = 'status-pill status-completed';
      statusBadge.innerHTML = `<span class="status-dot-pulse"></span> Aktiv`;
    }

    // Rol Nişanı
    const roleBadge = document.getElementById('dossierRoleBadge');
    roleBadge.className = user.is_admin ? 'status-pill status-completed' : 'status-pill status-pending';
    roleBadge.innerText = user.is_admin ? '👑 Admin' : 'Müştəri';

    // Modal Başlığında Sürətli Fəaliyyətlər
    const nameEscaped = encodeURIComponent(name);
    const actionGroup = document.getElementById('dossierQuickActions');
    actionGroup.innerHTML = `
      <button class="btn-action-outline btn-action-blue" onclick="openUserBalanceModal('${user.telegram_id}', '${nameEscaped}', ${user.balance || 0})">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
        <span>Balans</span>
      </button>
      ${user.is_blocked === 1 
        ? `<button class="btn-action-outline btn-action-emerald" onclick="unblockUser('${user.telegram_id}'); setTimeout(() => openUserDossierModal('${user.telegram_id}'), 400);">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
             <span>Aç</span>
           </button>`
        : `<button class="btn-action-outline btn-action-amber" onclick="openUserBlockModal('${user.telegram_id}', '${nameEscaped}')">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
             <span>Blokla</span>
           </button>`
      }
      <button class="btn-action-outline btn-action-orange" onclick="openIpBanModal('${user.last_ip || ''}', '${user.telegram_id}', '${nameEscaped}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
        <span>IP Blokla</span>
      </button>
      ${user.username ? `<a href="https://t.me/${user.username}" target="_blank" class="btn-action-outline btn-action-blue" style="text-decoration:none;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        <span>Telegram</span>
      </a>` : ''}
    `;

    // 4 KPI Metrik Kartı
    document.getElementById('dossierBalVal').innerText = `${(user.balance || 0).toFixed(2)} ₼`;
    document.getElementById('dossierDepositVal').innerText = `${(stats.totalDepositedAzn || 0).toFixed(2)} ₼`;
    document.getElementById('dossierDepositSub').innerText = `${payments.filter(p => p.status === 'approved' || p.status === 'completed').length} təsdiqlənmiş ödəniş`;
    
    document.getElementById('dossierOrdersVal').innerText = stats.totalOrders;
    document.getElementById('dossierOrdersSub').innerText = `${stats.completedOrders} uğurlu, ${stats.pendingOrders} gözləyən`;

    document.getElementById('dossierSpentVal').innerText = `${(stats.totalSpentAzn || 0).toFixed(2)} ₼`;

    // Tab sayları
    document.getElementById('dossierTabOrdersCount').innerText = orders.length;
    document.getElementById('dossierTabPaymentsCount').innerText = payments.length;
    document.getElementById('dossierTabReviewsCount').innerText = reviews.length;

    // Sifarişlər Tabını Göstər
    const ordersTbody = document.getElementById('dossierOrdersTbody');
    if (orders.length === 0) {
      ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">Bu istifadəçi hələlik heç bir sifariş etməyib.</td></tr>';
    } else {
      ordersTbody.innerHTML = orders.map(o => `
        <tr>
          <td><span class="code-pill" onclick="copyToClipboard('${o.id}', 'Sifariş ID')">${o.id}</span></td>
          <td><strong style="color:#fff;">${o.category_name}</strong><br><small style="color:var(--text-secondary);">${o.offer_name}</small></td>
          <td><code style="color:var(--brand-emerald);">${o.player_id || (o.fazer_order_id ? 'API Sifariş' : '—')}</code></td>
          <td><strong style="color:var(--brand-cyan); font-family:var(--font-mono);">${(o.price_azn || 0).toFixed(2)} ₼</strong></td>
          <td>
            <span class="status-pill ${o.status === 'completed' ? 'status-completed' : o.status === 'pending' ? 'status-pending' : 'status-failed'}">
              ${o.status.toUpperCase()}
            </span>
          </td>
          <td><small style="color:var(--text-muted);">${o.created_at || '—'}</small></td>
        </tr>
      `).join('');
    }

    // Ödənişlər Tabını Göstər
    const paymentsTbody = document.getElementById('dossierPaymentsTbody');
    if (payments.length === 0) {
      paymentsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">Bu istifadəçi hələlik depozit sorğusu göndərməyib.</td></tr>';
    } else {
      paymentsTbody.innerHTML = payments.map(p => `
        <tr>
          <td><span class="code-pill" onclick="copyToClipboard('${p.id}', 'Ödəniş ID')">${p.id}</span></td>
          <td><strong style="color:#fff; text-transform:uppercase;">${p.method}</strong></td>
          <td><strong style="color:var(--brand-emerald); font-family:var(--font-mono);">${(p.amount_azn || 0).toFixed(2)} ₼</strong></td>
          <td>
            ${p.receipt_path ? `<a href="${p.receipt_path}" target="_blank" style="color:#38bdf8; text-decoration:none; font-size:11px;">🖼️ Qəbzə Bax</a>` : '—'}
          </td>
          <td>
            <span class="status-pill ${p.status === 'approved' || p.status === 'completed' ? 'status-completed' : p.status === 'pending' ? 'status-pending' : 'status-failed'}">
              ${p.status.toUpperCase()}
            </span>
          </td>
          <td><small style="color:var(--text-muted);">${p.created_at || '—'}</small></td>
        </tr>
      `).join('');
    }

    // Rəylər Tabını Göstər
    const reviewsListEl = document.getElementById('dossierReviewsList');
    if (reviews.length === 0) {
      reviewsListEl.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted);">İstifadəçi hələlik rəy bildirməyib.</div>';
    } else {
      reviewsListEl.innerHTML = reviews.map(r => `
        <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="color:#fbbf24; font-size:13px;">${'★'.repeat(r.rating || 5)}${'☆'.repeat(Math.max(0, 5 - (r.rating || 5)))}</div>
            <span style="font-size:11px; color:var(--text-muted);">${r.created_at || ''}</span>
          </div>
          <div style="font-size:13px; color:#fff;">${r.comment || 'Şərh qeyd olunmayıb.'}</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Məhsul: <strong>${r.product_name || 'Oyun'}</strong></div>
        </div>
      `).join('');
    }

    // Standart olaraq sifarişlər tabına keç
    switchDossierTab('orders');

  } catch (err) {
    console.error('Dossier error:', err);
    alert('Müştəri məlumatları yüklənərkən xəta baş verdi.');
  }
}
window.openUserDossierModal = openUserDossierModal;

function closeUserDossierModal() {
  currentDossierTelegramId = null;
  const modal = document.getElementById('userProfileDossierModal');
  if (modal) modal.style.display = 'none';
}
window.closeUserDossierModal = closeUserDossierModal;

function switchDossierTab(tabKey) {
  const tabs = ['orders', 'payments', 'reviews'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const pane = document.getElementById(`dossierTabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle('active', t === tabKey);
    if (pane) {
      pane.style.display = t === tabKey ? 'block' : 'none';
      if (t === tabKey) pane.classList.add('active');
    }
  });
}
window.switchDossierTab = switchDossierTab;

function copyDossierTgId() {
  if (currentDossierTelegramId) {
    copyToClipboard(currentDossierTelegramId, 'Telegram ID');
  }
}
window.copyDossierTgId = copyDossierTgId;

// ---------------- İSTİFADƏÇİ BLOKLAMA VƏ HƏMİŞƏLİK SİLMƏ İDARƏEDİCİLƏRİ ----------------
let targetBlockUserTelegramId = null;
let targetDeleteUserTelegramId = null;

function openUserBlockModal(telegramId, nameEncoded) {
  targetBlockUserTelegramId = telegramId;
  const name = decodeURIComponent(nameEncoded || telegramId);
  const titleEl = document.getElementById('blockModalUserTitle');
  if (titleEl) titleEl.innerText = `${name} (ID: ${telegramId})`;
  const modal = document.getElementById('userBlockModal');
  if (modal) modal.style.display = 'flex';
}
window.openUserBlockModal = openUserBlockModal;

function closeUserBlockModal() {
  targetBlockUserTelegramId = null;
  const modal = document.getElementById('userBlockModal');
  if (modal) modal.style.display = 'none';
}
window.closeUserBlockModal = closeUserBlockModal;

async function confirmBlockUserSubmit() {
  if (!targetBlockUserTelegramId) return;
  const reason = document.getElementById('modalBlockReason')?.value?.trim() || 'Qaydaların pozulması';

  try {
    const res = await authFetch('/api/admin/users/block', {
      method: 'POST',
      body: JSON.stringify({ telegram_id: targetBlockUserTelegramId, reason })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('success', `İstifadəçi (#${targetBlockUserTelegramId}) uğurla bloklandı.`);
      closeUserBlockModal();
      fetchUsers();
    } else {
      showToast('error', data.error || 'Bloklama zamanı xəta baş verdi.');
    }
  } catch (e) {
    showToast('error', 'Sistem xətası baş verdi.');
  }
}
window.confirmBlockUserSubmit = confirmBlockUserSubmit;

async function unblockUser(telegramId) {
  if (!confirm(`Bu istifadəçini (#${telegramId}) blokdan çıxarmaq və hesabını yenidən aktivləşdirmək istəyirsiniz?`)) return;

  try {
    const res = await authFetch('/api/admin/users/unblock', {
      method: 'POST',
      body: JSON.stringify({ telegram_id: telegramId })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('success', `İstifadəçi (#${telegramId}) blokdan çıxarıldı və aktivləşdirildi.`);
      fetchUsers();
    } else {
      showToast('error', data.error || 'Xəta baş verdi.');
    }
  } catch (e) {
    showToast('error', 'Sistem xətası baş verdi.');
  }
}
window.unblockUser = unblockUser;

function openUserDeleteModal(telegramId, nameEncoded) {
  targetDeleteUserTelegramId = telegramId;
  const name = decodeURIComponent(nameEncoded || telegramId);
  const titleEl = document.getElementById('deleteModalUserTitle');
  if (titleEl) titleEl.innerText = `${name} (ID: ${telegramId})`;
  const modal = document.getElementById('userDeleteModal');
  if (modal) modal.style.display = 'flex';
}
window.openUserDeleteModal = openUserDeleteModal;

function closeUserDeleteModal() {
  targetDeleteUserTelegramId = null;
  const modal = document.getElementById('userDeleteModal');
  if (modal) modal.style.display = 'none';
}
window.closeUserDeleteModal = closeUserDeleteModal;

async function confirmDeleteUserSubmit() {
  if (!targetDeleteUserTelegramId) return;

  try {
    const res = await authFetch(`/api/admin/users/${targetDeleteUserTelegramId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.ok) {
      showToast('success', `İstifadəçi (#${targetDeleteUserTelegramId}) və bütün qeydləri bazadan TAMAMİLƏ SİLİNDİ.`);
      closeUserDeleteModal();
      fetchUsers();
      fetchStats();
    } else {
      showToast('error', data.error || 'Silinmə zamanı xəta baş verdi.');
    }
  } catch (e) {
    showToast('error', 'Sistem xətası baş verdi.');
  }
}
window.confirmDeleteUserSubmit = confirmDeleteUserSubmit;

// ---------------- IP QADAĞA İDARƏEDİCİLƏRİ ----------------
function openIpBanModal(ip, telegramId, nameEncoded) {
  const input = document.getElementById('modalBanIpInput');
  const reasonInput = document.getElementById('modalBanIpReason');
  
  if (input) {
    input.value = ip || '';
    if (!ip) {
      input.placeholder = 'IP ünvanını daxil edin (Məs: 85.132.44.12)';
    }
  }
  if (reasonInput && telegramId) {
    const name = nameEncoded ? decodeURIComponent(nameEncoded) : telegramId;
    reasonInput.value = `İstifadəçi: ${name} (TG ID: ${telegramId})`;
  }
  const modal = document.getElementById('ipBanModal');
  if (modal) modal.style.display = 'flex';
}
window.openIpBanModal = openIpBanModal;

function closeIpBanModal() {
  const modal = document.getElementById('ipBanModal');
  if (modal) modal.style.display = 'none';
}
window.closeIpBanModal = closeIpBanModal;

async function submitQuickIpBan() {
  const ipInput = document.getElementById('modalBanIpInput');
  const reasonInput = document.getElementById('modalBanIpReason');
  if (!ipInput || !ipInput.value.trim()) {
    alert('IP ünvanı tələb olunur.');
    return;
  }

  try {
    const res = await authFetch('/api/admin/ip/ban', {
      method: 'POST',
      body: JSON.stringify({
        ip: ipInput.value.trim(),
        reason: reasonInput ? reasonInput.value.trim() : 'Şübhəli fəaliyyət'
      })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('success', `IP ünvanı (${ipInput.value.trim()}) uğurla bloklandı.`);
      closeIpBanModal();
      fetchBannedIps();
    } else {
      showToast('error', data.error || 'IP bloklanarkən xəta baş verdi.');
    }
  } catch (e) {
    showToast('error', 'Sistem xətası baş verdi.');
  }
}
window.submitQuickIpBan = submitQuickIpBan;

async function fetchBannedIps() {
  const tbody = document.getElementById('bannedIpsTableBody');
  if (!tbody) return;

  try {
    const res = await authFetch('/api/admin/ip/banned');
    const data = await res.json();
    if (data.ok) {
      renderBannedIpsTable(data.bannedIps || []);
    }
  } catch (e) {}
}

function renderBannedIpsTable(list) {
  const tbody = document.getElementById('bannedIpsTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 18px;">Bloklanmış IP ünvanı yoxdur.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(item => `
    <tr>
      <td><strong style="color: #f87171; font-family: var(--font-mono); font-size: 13px;">${item.ip}</strong></td>
      <td style="color: var(--text-secondary); font-size: 12px;">${item.reason || 'Səbəb qeyd edilməyib'}</td>
      <td style="color: var(--text-muted); font-size: 11px;">${item.created_at || '—'}</td>
      <td>
        <button class="btn-secondary-sm" style="color: #34d399; border-color: rgba(52, 211, 153, 0.4);" onclick="unbanIpAddress('${item.ip}')">
          🔓 Blokdan Çıxar
        </button>
      </td>
    </tr>
  `).join('');
}

async function handleAddNewIpBan(e) {
  if (e) e.preventDefault();
  const ipInput = document.getElementById('newBanIpAddress');
  const reasonInput = document.getElementById('newBanIpReason');
  if (!ipInput || !ipInput.value.trim()) return;

  try {
    const res = await authFetch('/api/admin/ip/ban', {
      method: 'POST',
      body: JSON.stringify({
        ip: ipInput.value.trim(),
        reason: reasonInput ? reasonInput.value.trim() : 'Təhlükəsizlik qaydalarının pozulması'
      })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('success', `IP (${ipInput.value.trim()}) bloklandı.`);
      ipInput.value = '';
      if (reasonInput) reasonInput.value = '';
      fetchBannedIps();
    } else {
      showToast('error', data.error || 'Xəta baş verdi.');
    }
  } catch (e) {
    showToast('error', 'Sistem xətası baş verdi.');
  }
}
window.handleAddNewIpBan = handleAddNewIpBan;

async function unbanIpAddress(ip) {
  if (!confirm(`Bu IP ünvanını (${ip}) blokdan çıxarmaq istəyirsiniz?`)) return;

  try {
    const res = await authFetch('/api/admin/ip/unban', {
      method: 'POST',
      body: JSON.stringify({ ip })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('success', `IP (${ip}) blokdan çıxarıldı.`);
      fetchBannedIps();
    } else {
      showToast('error', data.error || 'Xəta baş verdi.');
    }
  } catch (e) {
    showToast('error', 'Sistem xətası baş verdi.');
  }
}
window.unbanIpAddress = unbanIpAddress;

// ---------------- SİSTEM PARAMETRLƏRİ VƏ API AÇAR İDARƏEDİCİLƏRİ ----------------
async function fetchSettings() {
  try {
    const res = await authFetch('/api/admin/settings');
    const data = await res.json();
    if (data.ok && data.settings) {
      const s = data.settings;
      if (document.getElementById('setUsdRate')) document.getElementById('setUsdRate').value = s.usd_azn_rate || 1.70;
      if (document.getElementById('setMarginPercent')) document.getElementById('setMarginPercent').value = s.margin_percent || 10;
      if (document.getElementById('setFazercardsApiKey')) document.getElementById('setFazercardsApiKey').value = s.fazercards_api_key || 'fc_eb9eea253d224b931a44d880';
      if (document.getElementById('setPlaypinApiKey')) document.getElementById('setPlaypinApiKey').value = s.playpin_api_key || 'a726f176b06858a82938f8e2ce6f8738115d4703ac11b5ec1de1273ab632df4b';
      if (document.getElementById('setBinancePayId')) document.getElementById('setBinancePayId').value = s.binance_pay_id || '';
      if (document.getElementById('setUsdtTrc20Address')) document.getElementById('setUsdtTrc20Address').value = s.usdt_trc20_address || '';
      if (document.getElementById('setUsdtBep20Address')) document.getElementById('setUsdtBep20Address').value = s.usdt_bep20_address || '';
      if (document.getElementById('setLogChannelId')) document.getElementById('setLogChannelId').value = s.log_channel_id || '';
      if (document.getElementById('topbarRateDisplay')) document.getElementById('topbarRateDisplay').innerText = (s.usd_azn_rate || 1.70).toFixed(2);
    }
  } catch (e) {
    console.error('fetchSettings error:', e);
  }
}
window.fetchSettings = fetchSettings;

async function saveSettings(e) {
  if (e) e.preventDefault();
  const usdRate = parseFloat(document.getElementById('setUsdRate')?.value) || 1.70;
  const marginPercent = parseFloat(document.getElementById('setMarginPercent')?.value) || 10;
  const fazercardsApiKey = document.getElementById('setFazercardsApiKey')?.value.trim() || '';
  const playpinApiKey = document.getElementById('setPlaypinApiKey')?.value.trim() || '';
  const binancePayId = document.getElementById('setBinancePayId')?.value.trim() || '';
  const usdtTrc20 = document.getElementById('setUsdtTrc20Address')?.value.trim() || '';
  const usdtBep20 = document.getElementById('setUsdtBep20Address')?.value.trim() || '';
  const logChannelId = document.getElementById('setLogChannelId')?.value.trim() || '';

  try {
    const res = await authFetch('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({
        usd_azn_rate: usdRate,
        margin_percent: marginPercent,
        fazercards_api_key: fazercardsApiKey,
        playpin_api_key: playpinApiKey,
        binance_pay_id: binancePayId,
        usdt_trc20_address: usdtTrc20,
        usdt_bep20_address: usdtBep20,
        log_channel_id: logChannelId,
      })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('success', 'Parametrlər və Loq Kanalı tənzimləmələri uğurla yadda saxlanıldı!');
      if (document.getElementById('topbarRateDisplay')) document.getElementById('topbarRateDisplay').innerText = usdRate.toFixed(2);
      fetchStats();
    } else {
      showToast('error', data.error || 'Xəta baş verdi.');
    }
  } catch (err) {
    showToast('error', 'Yadda saxlanılarkən xəta baş verdi.');
  }
}
window.saveSettings = saveSettings;

// 🧪 Telegram Log Kanalı Bağlantısını Test Et
async function testLogChannel() {
  const channelId = document.getElementById('setLogChannelId')?.value.trim() || '';
  if (!channelId) {
    showToast('warning', 'Zəhmət olmasa əvvəlcə Loq Kanalı ID-sini qeyd edin (Məs: -1001234567890 və ya @kanal_linki).');
    return;
  }
  showToast('info', 'Telegram loq kanalına test mesajı göndərilir...');
  try {
    const res = await authFetch('/api/admin/logger/test', {
      method: 'POST',
      body: JSON.stringify({ channel_id: channelId })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('success', '✅ ' + (data.message || 'Test mesajı Telegram loq kanalına uğurla çatdı!'));
    } else {
      showToast('error', data.error || 'Mesaj göndərilə bilmədi.');
    }
  } catch (e) {
    showToast('error', 'Sistem xətası baş verdi.');
  }
}
window.testLogChannel = testLogChannel;

// ---------------- API AÇARLARI 2FA / OTP İDARƏEDİCİLƏRİ ----------------
let areApiKeysUnlocked = false;
let otpTimerInterval = null;

function copyProtectedApiKey(inputId, label) {
  if (!areApiKeysUnlocked) {
    showToast('warning', 'Təhlükəsizlik: Açarı kopyalamaq üçün əvvəlcə 2FA şifrəsini təsdiq edin.');
    openApiOtpModal();
    return;
  }
  const val = document.getElementById(inputId)?.value || '';
  if (val) {
    copyToClipboard(val, label);
  }
}
window.copyProtectedApiKey = copyProtectedApiKey;

async function openApiOtpModal() {
  const modal = document.getElementById('apiKeysOtpModal');
  const errBox = document.getElementById('otpErrorBox');
  const input = document.getElementById('apiOtpInput');
  if (errBox) errBox.style.display = 'none';
  if (input) input.value = '';
  if (modal) modal.style.display = 'flex';

  // Serverdən yeni OTP tələb et
  try {
    const res = await authFetch('/api/admin/keys/request-otp', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      showToast('success', data.message || 'Birdəfəlik şifrə Telegram admin hesabınıza göndərildi!');
      startOtpCountdown(300);
      if (input) input.focus();
    } else {
      if (errBox) {
        errBox.innerText = data.error || 'Şifrə göndərilə bilmədi.';
        errBox.style.display = 'block';
      }
      showToast('error', data.error || 'Xəta baş verdi.');
    }
  } catch (e) {
    showToast('error', 'Şifrə sorğusunda xəta baş verdi.');
  }
}
window.openApiOtpModal = openApiOtpModal;

function closeApiOtpModal() {
  const modal = document.getElementById('apiKeysOtpModal');
  if (modal) modal.style.display = 'none';
  if (otpTimerInterval) clearInterval(otpTimerInterval);
}
window.closeApiOtpModal = closeApiOtpModal;

function startOtpCountdown(seconds) {
  if (otpTimerInterval) clearInterval(otpTimerInterval);
  let left = seconds;
  const timerEl = document.getElementById('otpTimer');

  const update = () => {
    const min = Math.floor(left / 60).toString().padStart(2, '0');
    const sec = (left % 60).toString().padStart(2, '0');
    if (timerEl) timerEl.innerText = `${min}:${sec}`;
    if (left <= 0) {
      clearInterval(otpTimerInterval);
      if (timerEl) timerEl.innerText = '00:00 (Vaxtı bitdi)';
    }
    left--;
  };

  update();
  otpTimerInterval = setInterval(update, 1000);
}

async function resendApiOtp() {
  showToast('info', 'Yeni şifrə göndərilir...');
  await openApiOtpModal();
}
window.resendApiOtp = resendApiOtp;

async function submitApiOtp(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('apiOtpInput');
  const errBox = document.getElementById('otpErrorBox');
  const btn = document.getElementById('btnVerifyOtp');
  const code = input?.value.trim();

  if (!code || code.length < 4) {
    if (errBox) {
      errBox.innerText = 'Zəhmət olmasa 6 rəqəmli şifrəni daxil edin.';
      errBox.style.display = 'block';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Yoxlanılır...';
  }

  try {
    const res = await authFetch('/api/admin/keys/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ otp: code })
    });
    const data = await res.json();

    if (data.ok) {
      unlockApiKeys();
      closeApiOtpModal();
      showToast('success', '🎉 Təhlükəsizlik şifrəsi təsdiqləndi! API açarları açıldı.');
    } else {
      if (errBox) {
        errBox.innerText = data.error || 'Yanlış şifrə.';
        errBox.style.display = 'block';
      }
      showToast('error', data.error || 'Şifrə yanlışdır.');
      if (input) input.select();
    }
  } catch (err) {
    showToast('error', 'Təsdiqləmə zamanı xəta baş verdi.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🔓 Təsdiq Et və Açarları Göstər';
    }
  }
}
window.submitApiOtp = submitApiOtp;

function unlockApiKeys() {
  areApiKeysUnlocked = true;
  const fKey = document.getElementById('setFazercardsApiKey');
  const pKey = document.getElementById('setPlaypinApiKey');
  const lockBanner = document.getElementById('apiKeysLockBanner');
  const unlockedBanner = document.getElementById('apiKeysUnlockedBanner');

  if (fKey) {
    fKey.classList.remove('api-key-blurred');
    fKey.classList.add('api-key-revealed');
  }
  if (pKey) {
    pKey.classList.remove('api-key-blurred');
    pKey.classList.add('api-key-revealed');
  }
  if (lockBanner) lockBanner.style.display = 'none';
  if (unlockedBanner) unlockedBanner.style.display = 'flex';
}
window.unlockApiKeys = unlockApiKeys;

function lockApiKeys() {
  areApiKeysUnlocked = false;
  const fKey = document.getElementById('setFazercardsApiKey');
  const pKey = document.getElementById('setPlaypinApiKey');
  const lockBanner = document.getElementById('apiKeysLockBanner');
  const unlockedBanner = document.getElementById('apiKeysUnlockedBanner');

  if (fKey) {
    fKey.classList.add('api-key-blurred');
    fKey.classList.remove('api-key-revealed');
  }
  if (pKey) {
    pKey.classList.add('api-key-blurred');
    pKey.classList.remove('api-key-revealed');
  }
  if (lockBanner) lockBanner.style.display = 'flex';
  if (unlockedBanner) unlockedBanner.style.display = 'none';
  showToast('info', 'API açarları yenidən gizlədildi (Blurred).');
}
window.lockApiKeys = lockApiKeys;

// ---------------- MƏHSUL İNVENTARI VƏ CANLI STOK İDARƏEDİCİSİ ----------------
let currentAdminProdFilter = 'all';

async function loadProductsInventory() {
  const tbody = document.getElementById('productsTableBody');
  const mobContainer = document.getElementById('productsMobileCardsContainer');

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px;">Canlı məhsullar və API stokları yüklənir...</td></tr>';
  }

  try {
    const res = await authFetch('/api/admin/fazer/all-catalog');
    const data = await res.json();

    if (data.ok) {
      cachedFazerCatalog = {
        topups: data.topups || [],
        giftcards: data.giftcards || []
      };
      renderAdminProducts();
    } else {
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--brand-rose); padding: 20px;">Xəta: ${data.error || 'Server xətası'}</td></tr>`;
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--brand-rose); padding: 20px;">Məhsulları yükləmək mümkün olmadı.</td></tr>';
  }
}

function filterAdminProducts(type, btn) {
  currentAdminProdFilter = type;
  document.querySelectorAll('#secProducts .table-toolbar button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAdminProducts();
}

function handleAdminProductSearch() {
  renderAdminProducts();
}

function renderAdminProducts() {
  const tbody = document.getElementById('productsTableBody');
  const mobContainer = document.getElementById('productsMobileCardsContainer');
  const searchVal = (document.getElementById('searchProductInput')?.value || '').toLowerCase().trim();

  let items = [];
  if (currentAdminProdFilter === 'all' || currentAdminProdFilter === 'topup') {
    items.push(...(cachedFazerCatalog.topups || []));
  }
  if (currentAdminProdFilter === 'all' || currentAdminProdFilter ==='giftcard') {
    items.push(...(cachedFazerCatalog.giftcards || []));
  }

  if (searchVal) {
    items = items.filter(i => (i.name && i.name.toLowerCase().includes(searchVal)) || (i.category_id && i.category_id.toLowerCase().includes(searchVal)));
  }

  // Masaüstü Cədvəl Renderi
  if (tbody) {
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 24px;">Məhsul tapılmadı.</td></tr>';
    } else {
      tbody.innerHTML = items.map(p => {
        const isPlayPin = p.category_id.includes('pubg') || (p.note && p.note.includes('PlayPin'));
        const providerBadge = isPlayPin
          ? '<span class="status-pill status-completed" style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);">🎮 PlayPin API</span>'
          : '<span class="status-pill status-completed" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">🌐 FazerCards API</span>';

        return `
          <tr>
            <td>
              <strong style="color: #fff; font-size: 14px;">${p.name}</strong>
              ${p.note ? `<br><small style="color: var(--text-muted);">${p.note.replace(/\n/g, ' ')}</small>` : ''}
            </td>
            <td><code>${p.category_id}</code></td>
            <td>
              <span class="status-pill ${p.type === 'topup' ? 'status-completed' : 'status-pending'}">
                ${p.type === 'topup' ? 'Direct Top-Up' : 'E-Pin / Gift Card'}
              </span>
            </td>
            <td>
              ${providerBadge}
            </td>
            <td>
              <button class="btn-secondary-sm" onclick="selectApiCategoryForPricing('${p.category_id}', '${p.type}')">
                📦 Qiymətlər &amp; Paketlər ➔
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 2-Sütunlu Yan-Yana Mobil Kartlar Göstəricisi
  if (mobContainer) {
    if (items.length === 0) {
      mobContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 24px; grid-column: span 2;">Məhsul tapılmadı.</div>';
    } else {
      mobContainer.innerHTML = items.map(p => {
        const isPlayPin = p.category_id.includes('pubg') || (p.note && p.note.includes('PlayPin'));
        const providerTag = isPlayPin ? 'PlayPin' : 'FazerCards';

        return `
          <div class="generic-mobile-card">
            <div class="g-card-header">
              <div style="overflow: hidden;">
                <strong class="g-card-title">${p.name}</strong>
                <div class="g-card-sub">${p.type === 'topup' ? 'Direct Top-Up' : 'E-Pin Kod'}</div>
              </div>
              <span class="status-pill status-completed" style="font-size: 9px; padding: 1px 5px; ${isPlayPin ? 'background: rgba(52, 211, 153, 0.15); color: #34d399;' : ''}">${providerTag}</span>
            </div>

            <div class="g-stat-box">
              <div class="g-stat-row">
                <span style="color: var(--text-muted);">ID:</span>
                <span style="font-size: 10px; font-family: var(--font-mono); color: var(--brand-cyan);">${p.category_id}</span>
              </div>
              <div class="g-stat-row">
                <span style="color: var(--text-muted);">Təchizatçı:</span>
                <span style="color: ${isPlayPin ? '#34d399' : '#38bdf8'}; font-size: 10px; font-weight: 700;">${providerTag}</span>
              </div>
            </div>

            <button class="btn-micro btn-micro-primary" style="width: 100%;" onclick="selectApiCategoryForPricing('${p.category_id}', '${p.type}')">
              📦 Paketlər ➔
            </button>
          </div>
        `;
      }).join('');
    }
  }
}

window.loadProductsInventory = loadProductsInventory;
window.filterAdminProducts = filterAdminProducts;
window.handleAdminProductSearch = handleAdminProductSearch;

function handleUserSearch() {
  const input = document.getElementById('userSearchInput') || document.getElementById('searchUserInput');
  const query = (input ? input.value : '').toLowerCase().trim();
  if (!query) {
    renderUsers(currentAdminData.users);
    return;
  }

  const filtered = (currentAdminData.users || []).filter(u => 
    (u.telegram_id && u.telegram_id.toString().includes(query)) ||
    (u.username && u.username.toLowerCase().includes(query)) ||
    (u.first_name && u.first_name.toLowerCase().includes(query))
  );
  renderUsers(filtered);
}
window.filterUsersList = handleUserSearch;

// İstifadəçi Balansı Modalı
function openUserBalanceModal(tgId, encodedName, currentBal) {
  const name = decodeURIComponent(encodedName);
  selectedAdminUser = { telegram_id: tgId, name, balance: currentBal };

  document.getElementById('modalUserTitle').innerText = `${name} (ID: ${tgId})`;
  document.getElementById('modalUserCurrentBal').innerText = `Cari Balans: ${currentBal.toFixed(2)} AZN`;
  document.getElementById('modalBalAmount').value = '';
  document.getElementById('userBalanceModal').style.display = 'flex';
}

function closeUserBalanceModal() {
  document.getElementById('userBalanceModal').style.display = 'none';
  selectedAdminUser = null;
}

async function submitUserBalanceChange() {
  if (!selectedAdminUser) return;

  const amountVal = document.getElementById('modalBalAmount').value.trim();
  const action = document.getElementById('modalBalAction').value;

  if (!amountVal || isNaN(parseFloat(amountVal)) || parseFloat(amountVal) < 0) {
    alert('Zəhmət olmasa düzgün məbləğ daxil edin.');
    return;
  }

  const amount = parseFloat(amountVal);

  try {
    const res = await authFetch('/api/admin/users/balance', {
      method: 'POST',
      body: JSON.stringify({
        telegram_id: selectedAdminUser.telegram_id,
        amount_azn: amount,
        action: action
      })
    });
    const data = await res.json();
    if (data.ok) {
      alert(`Balans uğurla yeniləndi! Yeni balans: ${data.newBalance.toFixed(2)} AZN`);
      closeUserBalanceModal();
      loadAllAdminData();
    } else {
      alert(`Xəta: ${data.error}`);
    }
  } catch (e) {
    alert('Sistem xətası baş verdi.');
  }
}

// İstifadəçi Rolunu Dəyişdir
async function toggleUserRole(telegramId, currentIsAdmin) {
  const newRole = currentIsAdmin ? 0 : 1;
  const roleTitle = newRole === 1 ? 'Admin' : 'Müştəri';

  if (!confirm(`Bu istifadəçinin hüququnu "${roleTitle}" olaraq dəyişmək istəyirsiniz?`)) return;

  try {
    const res = await authFetch('/api/admin/users/role', {
      method: 'POST',
      body: JSON.stringify({ telegram_id: telegramId, is_admin: newRole })
    });
    const data = await res.json();
    if (data.ok) {
      alert(`İstifadəçi hüququ "${roleTitle}" olaraq dəyişdirildi.`);
      loadAllAdminData();
    } else {
      alert('Xəta baş verdi.');
    }
  } catch (e) {
    alert('Xəta.');
  }
}

// Parametrləri Gətir və Yadda Saxla
async function fetchSettings() {
  try {
    const res = await authFetch('/api/admin/settings');
    const data = await res.json();
    if (data.ok && data.settings) {
      const s = data.settings;
      if (document.getElementById('setUsdRate')) document.getElementById('setUsdRate').value = s.usd_azn_rate || '1.70';
      if (document.getElementById('topbarRateDisplay')) document.getElementById('topbarRateDisplay').innerText = s.usd_azn_rate || '1.70';
      if (document.getElementById('setMarginPercent')) document.getElementById('setMarginPercent').value = s.margin_percent || '10';
      if (document.getElementById('setBinancePayId')) document.getElementById('setBinancePayId').value = s.binance_pay_id || '';
      if (document.getElementById('setUsdtTrc20Address')) document.getElementById('setUsdtTrc20Address').value = s.usdt_trc20_address || '';
      if (document.getElementById('setUsdtBep20Address')) document.getElementById('setUsdtBep20Address').value = s.usdt_bep20_address || '';
    }
  } catch (e) {}
}

async function saveSettings(e) {
  e.preventDefault();
  const payload = {
    usd_azn_rate: document.getElementById('setUsdRate').value,
    margin_percent: document.getElementById('setMarginPercent').value,
    binance_pay_id: document.getElementById('setBinancePayId').value,
    usdt_trc20_address: document.getElementById('setUsdtTrc20Address').value,
    usdt_bep20_address: document.getElementById('setUsdtBep20Address').value
  };

  try {
    const res = await authFetch('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      showToast('success', 'Parametrlər və Kripto Rekvizitlər uğurla yadda saxlanıldı! ✅');
      fetchSettings();
    } else {
      showToast('error', 'Xəta baş verdi: ' + (data.error || 'Naməlum'));
    }
  } catch (e) {
    showToast('error', 'Sistem bağlantı xətası.');
  }
}

// Hədəfli & Seqmentli Kütləvi Mesaj İdarəetməsi
let currentBroadcastSegment = 'all';

async function loadBroadcastSegments() {
  try {
    const res = await authFetch('/api/admin/broadcast-segments');
    const data = await res.json();
    if (data.ok && data.segments) {
      const s = data.segments;
      const elAll = document.getElementById('segCountAll');
      const elZero = document.getElementById('segCountZero');
      const elActive = document.getElementById('segCountActive');
      const elVip = document.getElementById('segCountVip');
      const elInactive = document.getElementById('segCountInactive');

      if (elAll) elAll.innerText = `${s.all} nəfər`;
      if (elZero) elZero.innerText = `${s.zero_balance} nəfər`;
      if (elActive) elActive.innerText = `${s.active_buyers} nəfər`;
      if (elVip) elVip.innerText = `${s.vip} nəfər`;
      if (elInactive) elInactive.innerText = `${s.inactive_7d} nəfər`;
    }
  } catch (e) {
    console.error('loadBroadcastSegments error:', e);
  }
}

function selectBroadcastSegment(segment, element) {
  currentBroadcastSegment = segment;
  document.querySelectorAll('.segment-card').forEach(card => {
    card.classList.remove('active');
    card.style.borderColor = 'var(--border-subtle)';
    card.style.background = 'rgba(15, 23, 42, 0.4)';
  });

  if (element) {
    element.classList.add('active');
    element.style.borderColor = 'var(--accent-color, #38bdf8)';
    element.style.background = 'rgba(56, 189, 248, 0.08)';
    const radio = element.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  }

  const labelMap = {
    all: 'Bütün İstifadəçilərə Göndər',
    zero_balance: 'Balansı 0 Olanlara Göndər',
    active_buyers: 'Aktiv Alıcılara Göndər',
    vip: 'VIP Müştərilərə Göndər',
    inactive_7d: 'Qeyri-Aktiv Müştərilərə Göndər'
  };

  const btnLabel = document.getElementById('btnBroadcastLabel');
  if (btnLabel) {
    btnLabel.innerText = labelMap[segment] || 'Seçilmiş Qrupa Göndər';
  }
}

function applyBroadcastTemplate(key) {
  const txtArea = document.getElementById('broadcastText');
  if (!txtArea) return;

  const templates = {
    promo_balance: 
      `🎉 <b>XÜSUSİ BALANS ARTIRMA BONUSU!</b>\n\n` +
      `Hörmətli müştəri, bu gün balansınızı <b>10 AZN və ya daha çox</b> artırın, anında əlavə <b>+1.50 AZN hədiyyə keşbek</b> qazanın! 💰✨\n\n` +
      `⚡ Ən ucuz PUBG Mobile UC, Free Fire və Roblox paketləri sizi gözləyir!\n` +
      `👉 <i>Balans artırmaq üçün "💳 Balans" bölməsinə daxil olun.</i>`,

    uc_discount:
      `🔥 <b>PUBG MOBILE UC QİYMƏTLƏRİNDƏ ŞOK ENDİRİM!</b>\n\n` +
      `🎮 Bütün PUBG Mobile UC paketləri birbaşa <b>100% rəsmi ID yükləməsi</b> ilə ən sərfəli qiymətə yeniləndi!\n\n` +
      `• 60 UC — Ən Sərfəli Qiymət!\n` +
      `• 325 / 355 / 720 UC anında hesabınızda!\n\n` +
      `🛒 <i>Sifariş üçün aşağıdakı menyudan "🎮 Oyunlar" bölməsini seçin!</i>`,

    vip_perk:
      `💎 <b>EKSKLÜZİV VIP MÜŞTƏRİ TƏKLİFİ</b>\n\n` +
      `Dəyərli daimi müştərimiz, sizin üçün bütün xidmətlərdə <b>prioritet ani çatdırılma</b> və xüsusi B2B topdansatış tarifləri aktivləşdirildi! 👑\n\n` +
      `💬 <i>Xüsusi toplu sifarişlər və eksklüziv tələblər üçün adminlə əlaqə saxlaya bilərsiniz.</i>`,

    comeback:
      `👋 <b>SİZİ YENİDƏN GÖRMƏYƏ ŞAD OLARDIQ!</b>\n\n` +
      `Hörmətli istifadəçimiz, botumuzda yeni oyunlar, Telegram Stars, Telegram Premium və <b>avtomatik ani çatdırılma</b> yenilənmələri istifadəyə verildi! 🚀\n\n` +
      `🎁 <i>Hər alış-verişinizdən dostlarınızı dəvət edərək daimi passiv gəlir qazana bilərsiniz!</i>`
  };

  if (templates[key]) {
    txtArea.value = templates[key];
    txtArea.focus();
  }
}

// Kütləvi Mesaj Göndər (Seqmentli)
async function sendBroadcast(e) {
  e.preventDefault();
  const message = document.getElementById('broadcastText').value.trim();
  const photo_url = document.getElementById('broadcastPhotoUrl').value.trim();
  const segment = currentBroadcastSegment || 'all';

  const segmentNames = {
    all: 'BÜTÜN istifadəçilərə',
    zero_balance: 'Balansı 0 olan istifadəçilərə',
    active_buyers: 'Uğurlu sifarişi olan aktiv alıcılara',
    vip: 'VIP müştərilərə',
    inactive_7d: 'Son 7 gündür girməyən istifadəçilərə'
  };

  const targetLabel = segmentNames[segment] || 'seçilmiş qrupa';
  if (!confirm(`Bu mesajı ${targetLabel} göndərmək istədiyinizdən əminsiniz?`)) return;

  const btn = document.getElementById('btnSubmitBroadcast');
  const btnLabel = document.getElementById('btnBroadcastLabel');
  if (btn) btn.disabled = true;
  if (btnLabel) btnLabel.innerText = 'Göndərilir (Gözləyin)...';

  try {
    const res = await authFetch('/api/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message, photo_url: photo_url || undefined, segment })
    });
    const data = await res.json();
    if (data.ok) {
      const resBox = document.getElementById('broadcastResultBox');
      const resDetails = document.getElementById('broadcastResultDetails');
      if (resBox && resDetails) {
        resBox.style.display = 'block';
        resDetails.innerHTML = `
          • <b>Hədəf Qrup:</b> ${targetLabel}<br>
          • <b>Ümumi Hədəf:</b> ${data.result.total} nəfər<br>
          • <b>Uğurla Çatdı:</b> <span style="color: #10b981;">${data.result.sent}</span><br>
          • <b>Uğursuz (Blok/Dayandırılıb):</b> <span style="color: #ef4444;">${data.result.failed}</span>
        `;
      }

      alert(`✅ Bildiriş uğurla göndərildi!\n\n👥 Ümumi: ${data.result.total}\n📨 Çatdı: ${data.result.sent}\n❌ Xəta: ${data.result.failed}`);
      document.getElementById('broadcastText').value = '';
      document.getElementById('broadcastPhotoUrl').value = '';
      loadBroadcastSegments();
    } else {
      alert(`❌ Xəta: ${data.error}`);
    }
  } catch (err) {
    alert('Bildiriş göndərilərkən xəta baş verdi.');
  } finally {
    if (btn) btn.disabled = false;
    selectBroadcastSegment(currentBroadcastSegment, document.querySelector(`.segment-card input[value="${currentBroadcastSegment}"]`)?.closest('.segment-card'));
  }
}



async function viewProductOffers(categoryId, type, encodedName) {
  const name = decodeURIComponent(encodedName);
  const modal = document.getElementById('productOffersModal');
  const title = document.getElementById('modalOfferGameTitle');
  const container = document.getElementById('modalOffersContainer');

  if (title) title.innerText = `${name} — Canlı Paketlər & Qiymətlər`;
  if (container) container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 30px;">Canlı təkliflər və marjalar hesablanır...</div>';
  if (modal) modal.style.display = 'flex';

  try {
    const res = await authFetch(`/api/admin/products/${categoryId}/offers?type=${type}`);
    const data = await res.json();

    if (data.ok && data.offers && data.offers.length > 0) {
      container.innerHTML = `
        <table style="width: 100%; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left;">
              <th style="padding: 8px;">Paket Adı</th>
              <th style="padding: 8px;">Maya (USD)</th>
              <th style="padding: 8px;">Maya (AZN)</th>
              <th style="padding: 8px; color: #34d399;">Müştəri Satış (AZN)</th>
              <th style="padding: 8px; color: #38bdf8;">Xalis Qazanc (+AZN)</th>
              <th style="padding: 8px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.offers.map(o => {
              const profitPct = o.base_azn > 0 ? ((o.profit_azn / o.base_azn) * 100).toFixed(1) : '0';
              return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 8px;"><strong>${o.name}</strong></td>
                  <td style="padding: 8px; color: var(--text-secondary);">$${o.price_usd_num.toFixed(2)}</td>
                  <td style="padding: 8px; color: var(--text-secondary); font-weight: 600;">${o.base_azn.toFixed(2)} ₼</td>
                  <td style="padding: 8px; color: #34d399; font-weight: 800; font-size: 14px;">${o.price_azn.toFixed(2)} ₼</td>
                  <td style="padding: 8px; color: #38bdf8; font-weight: 700;">+${o.profit_azn.toFixed(2)} ₼ <span style="font-size: 11px; opacity: 0.85;">(${profitPct}%)</span></td>
                  <td style="padding: 8px;"><span class="badge badge-completed" style="font-size: 10px;">Stokda Var</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else {
      container.innerHTML = `<div style="text-align: center; color: #f87171; padding: 30px;">${data.error || 'Bu oyun üçün hazırda canlı paket tapılmadı.'}</div>`;
    }
  } catch (err) {
    container.innerHTML = '<div style="text-align: center; color: #f87171; padding: 20px;">Təkliflər yüklənərkən xəta baş verdi.</div>';
  }
}

function closeProductOffersModal() {
  const modal = document.getElementById('productOffersModal');
  if (modal) modal.style.display = 'none';
}

// =========================================================================
// FAZER API KATALOQ VƏ XÜSUSİ QİYMƏTLƏNDİRMƏ NƏZARƏTÇİSİ
// =========================================================================

let cachedApiCategories = [];
let cachedFazerCatalog = { topups: [], giftcards: [] };
let currentApiFilterType = 'all';
let currentSelectedApiCat = null;
let currentSelectedCatOffers = [];

function escapeQuotes(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Skript başlanğıcında sessiyadan keşlənmiş kataloqu yükləməyə çalış
try {
  const storedCat = sessionStorage.getItem('winners_fazer_catalog');
  if (storedCat) {
    cachedFazerCatalog = JSON.parse(storedCat);
  }
} catch (e) {}

async function loadApiCatalogDashboard() {
  const container = document.getElementById('apiCategoriesDashboardContainer');
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px;">API kateqoriyaları və canlı paketlər yüklənir...</div>';

  // Modalın anında açılması üçün arxa planda bütün Fazer kataloqunu əvvəlcədən yüklə
  fetchFazerCatalogBackground();

  try {
    const res = await authFetch('/api/admin/api-categories');
    const data = await res.json();

    if (data.ok) {
      cachedApiCategories = data.categories || [];
      renderApiCategoriesDashboard(cachedApiCategories);
    } else {
      container.innerHTML = `
        <div style="text-align: center; color: #f87171; padding: 40px;">
          <p style="margin-bottom: 12px; font-weight: 700;">Kateqoriyaları yükləmək mümkün olmadı: ${data.error || ''}</p>
          <button class="btn-action" onclick="loadApiCatalogDashboard()" style="background: #334155; color: #fff;">🔄 Yenidən Yüklə</button>
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `
      <div style="text-align: center; color: #f87171; padding: 40px;">
        <p style="margin-bottom: 12px; font-weight: 700;">⚠️ Əlaqə xətası baş verdi.</p>
        <button class="btn-action" onclick="loadApiCatalogDashboard()" style="background: #334155; color: #fff;">🔄 Yenidən Yüklə</button>
      </div>
    `;
  }
}

async function fetchFazerCatalogBackground() {
  try {
    const res = await authFetch('/api/admin/fazer/all-catalog');
    const data = await res.json();
    if (data.ok && (data.topups?.length || data.giftcards?.length)) {
      cachedFazerCatalog = {
        topups: data.topups || [],
        giftcards: data.giftcards || []
      };
      try {
        sessionStorage.setItem('winners_fazer_catalog', JSON.stringify(cachedFazerCatalog));
      } catch (e) {}
    }
  } catch (e) {}
}

function renderApiCategoriesDashboard(categories) {
  const container = document.getElementById('apiCategoriesDashboardContainer');
  if (!container) return;

  if (!categories || categories.length === 0) {
    container.innerHTML = `
      <div style="background: var(--bg-card); border: 1px dashed rgba(168, 85, 247, 0.4); border-radius: 12px; padding: 40px; text-align: center;">
        <div style="font-size: 36px; margin-bottom: 12px;">🎮</div>
        <h3 style="font-size: 17px; font-weight: 800; color: #fff; margin-bottom: 8px;">Hələlik Heç Bir API Kateqoriyası Əlavə Edilməyib</h3>
        <p style="color: var(--text-secondary); font-size: 13px; max-width: 480px; margin: 0 auto 20px;">
          FazerCards API sistemindəki rəsmi oyun və xidmətləri axtarışla tapıb bota əlavə etmək üçün yuxarıdakı düyməyə basın.
        </p>
        <button class="btn-action" style="background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; font-weight: 700; padding: 10px 22px;" onclick="openApiCatalogSearchModal()">
          🔍 API Kataloqundan Kateqoriya Əlavə Et
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = categories.map(cat => {
    const isTopup = cat.type === 'topup';
    const isPlaypin = cat.provider === 'playpin' || cat.category_id === 'pubg_mobile_epin' || cat.category_id === 'pubg_mobile_web' || (cat.note && cat.note.includes('PlayPin'));
    const typeLabel = isTopup ? 'Top-Up' : 'E-Pin';
    const statusClass = cat.is_active ? 'status-completed' : 'status-failed';
    const statusText = cat.is_active ? '🟢 Aktiv' : '⚪ Deaktiv';
    const providerBadge = isPlaypin
      ? '<span class="status-pill status-completed" style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.35); font-size: 9px; font-weight: 700; padding: 1px 6px;">🎮 PlayPin</span>'
      : '<span class="status-pill status-completed" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-size: 9px; font-weight: 700; padding: 1px 6px;">⚡ FazerCards</span>';

    return `
      <div class="custom-cat-card" id="api_card_${cat.category_id}">
        <div class="custom-cat-header">
          <div class="cat-title-wrap">
            <div class="cat-icon-badge">${cat.icon || '🎮'}</div>
            <div style="overflow: hidden; flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                <h4 style="font-size: 13px; font-weight: 700; color: #fff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat.name}</h4>
                <span class="status-pill ${statusClass}" style="font-size: 9px; padding: 1px 5px; flex-shrink: 0;">${statusText}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-muted); margin-top: 3px; overflow: hidden; flex-wrap: wrap;">
                ${providerBadge}
                <span class="status-pill ${isTopup ? 'status-completed' : 'status-pending'}" style="font-size: 8px; padding: 0 4px; flex-shrink: 0;">${typeLabel}</span>
                <span style="font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.8;">${cat.category_id}</span>
              </div>
            </div>
          </div>

          <div class="cat-actions-wrap">
            <button class="btn-micro btn-micro-primary" onclick="toggleCatOffersView('${cat.category_id}', '${cat.type}')">
              📦 Paketlər &amp; Qiymət
            </button>
            <button class="btn-micro" onclick="toggleApiCategoryStatus('${cat.category_id}')" title="${cat.is_active ? 'Deaktiv et' : 'Aktiv et'}">
              ${cat.is_active ? '⏸️' : '▶️'}
            </button>
            <button class="btn-micro" style="color: var(--brand-rose); border-color: rgba(244, 63, 94, 0.3);" onclick="deleteApiCategoryPrompt('${cat.category_id}')" title="Sil">
              🗑️
            </button>
          </div>
        </div>

        <!-- Təkliflər Cədvəli Konteyneri -->
        <div id="cat_offers_wrap_${cat.category_id}" style="margin-top: 12px; display: none;">
          <div style="text-align: center; color: var(--text-muted); padding: 12px; font-size: 11px;">Paketlər yüklənir...</div>
        </div>
      </div>
    `;
  }).join('');
}

// Kateqoriya kartında təkliflər cədvəlini aç / yüklə (Masaüstü Cədvəl + Mobil Kartlar)
async function toggleCatOffersView(categoryId, type) {
  const wrap = document.getElementById(`cat_offers_wrap_${categoryId}`);
  const card = document.getElementById(`api_card_${categoryId}`);
  if (!wrap) return;

  if (wrap.style.display === 'block') {
    wrap.style.display = 'none';
    if (card) card.classList.remove('offers-expanded');
    return;
  }

  wrap.style.display = 'block';
  if (card) card.classList.add('offers-expanded');
  wrap.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 16px; font-size: 12px;">Canlı paketlər və qiymətlər hesablanır...</div>';

  try {
    const res = await authFetch(`/api/admin/fazer/category-offers/${categoryId}?type=${type}`);
    const data = await res.json();

    if (data.ok && data.offers && data.offers.length > 0) {
      wrap.innerHTML = `
        <!-- Masaüstü Cədvəl Görünüşü -->
        <div class="desktop-offers-table table-responsive">
          <table class="admin-table" style="font-size: 13px;">
            <thead>
              <tr>
                <th>Paket Adı</th>
                <th>Təchizatçı</th>
                <th>Stok Sayı</th>
                <th>Maya (USD)</th>
                <th>Maya (AZN)</th>
                <th style="color: var(--brand-emerald);">Satış Qiyməti (AZN ₼)</th>
                <th style="color: var(--brand-cyan);">Xalis Qazanc</th>
                <th style="text-align: right;">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              ${data.offers.map(o => {
                const profitPct = o.base_azn > 0 ? ((o.profit_azn / o.base_azn) * 100).toFixed(1) : '0';
                const isPlaypin = o.provider === 'playpin' || data.provider === 'playpin' || categoryId === 'pubg_mobile_epin' || categoryId === 'pubg_mobile_web';
                
                let stockBadge = '';
                if (typeof o.stock === 'number') {
                  if (o.stock > 100) {
                    stockBadge = `<span class="status-pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; font-size: 11px;">🟢 ${o.stock.toLocaleString()} ədəd</span>`;
                  } else if (o.stock > 0) {
                    stockBadge = `<span class="status-pill" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700; font-size: 11px;">🟡 ${o.stock} ədəd</span>`;
                  } else {
                    stockBadge = `<span class="status-pill" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 700; font-size: 11px;">🔴 Bitib (0)</span>`;
                  }
                } else if (o.stock === 'playpin_operator') {
                  stockBadge = `<span class="status-pill" style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); font-weight: 700; font-size: 11px;">⚡ Canlı Sorğu (Operator)</span>`;
                } else {
                  stockBadge = `<span class="status-pill" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 700; font-size: 11px;">⚡ Avtomatik Canlı ID</span>`;
                }

                return `
                  <tr>
                    <td><strong style="color: #fff;">${o.name}</strong></td>
                    <td>
                      <span class="status-pill" style="font-size: 9px; font-weight: 700; padding: 2px 6px; ${isPlaypin ? 'background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);' : 'background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);'}">
                        ${isPlaypin ? '🎮 PlayPin' : '⚡ FazerCards'}
                      </span>
                    </td>
                    <td>${stockBadge}</td>
                    <td style="color: var(--text-muted); font-family: var(--font-mono);">$${o.price_usd_num.toFixed(2)}</td>
                    <td style="color: var(--text-secondary); font-family: var(--font-mono); font-weight: 600;">${o.base_azn.toFixed(2)} ₼</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 4px;">
                        <input type="number" step="0.01" class="form-control mono" style="width: 85px; padding: 4px 8px; font-weight: 700; font-size: 13px; text-align: right; color: var(--brand-emerald);" 
                          id="inline_price_${categoryId}_${o.offer_id}" 
                          value="${o.selling_price_azn.toFixed(2)}" 
                          oninput="recalcInlineRowProfit('${categoryId}', '${o.offer_id}', ${o.base_azn})">
                        <span style="font-weight: 700; color: var(--brand-emerald); font-size: 12px;">₼</span>
                        ${o.has_custom_price ? '<span class="status-pill status-completed" style="font-size: 10px; padding: 1px 4px;">Fərdi</span>' : ''}
                      </div>
                    </td>
                    <td>
                      <span id="inline_profit_${categoryId}_${o.offer_id}" style="color: var(--brand-cyan); font-weight: 700; font-size: 12px; font-family: var(--font-mono);">
                        +${o.profit_azn.toFixed(2)} ₼ <small style="opacity: 0.85;">(${profitPct}%)</small>
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <button class="btn-success" onclick="saveInlinePriceAction('${categoryId}', '${o.offer_id}', ${o.price_usd_num}, ${o.base_azn})">
                        💾 Yadda Saxla
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobil Kart Siyahısı Görünüşü (Ultra-təmiz və Toxunma dostu) -->
        <div class="mobile-offers-list">
          ${data.offers.map(o => {
            const profitPct = o.base_azn > 0 ? ((o.profit_azn / o.base_azn) * 100).toFixed(1) : '0';
            const isPlaypin = o.provider === 'playpin' || data.provider === 'playpin' || categoryId === 'pubg_mobile_epin' || categoryId === 'pubg_mobile_web';
            
            let stockBadge = '';
            if (typeof o.stock === 'number') {
              if (o.stock > 100) {
                stockBadge = `<span class="status-pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; font-size: 11px;">🟢 ${o.stock.toLocaleString()} ədəd</span>`;
              } else if (o.stock > 0) {
                stockBadge = `<span class="status-pill" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700; font-size: 11px;">🟡 ${o.stock} ədəd</span>`;
              } else {
                stockBadge = `<span class="status-pill" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 700; font-size: 11px;">🔴 Bitib (0)</span>`;
              }
            } else if (o.stock === 'playpin_operator') {
              stockBadge = `<span class="status-pill" style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); font-weight: 700; font-size: 11px;">⚡ Canlı Sorğu (Operator)</span>`;
            } else {
              stockBadge = `<span class="status-pill" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 700; font-size: 11px;">⚡ Avtomatik Canlı ID</span>`;
            }

            return `
              <div class="mobile-offer-card">
                <div class="mobile-offer-top">
                  <div class="mobile-offer-title">${o.name}</div>
                  <div style="display: flex; gap: 4px; align-items: center;">
                    ${stockBadge}
                    <span class="status-pill" style="font-size: 9px; font-weight: 700; padding: 2px 6px; ${isPlaypin ? 'background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);' : 'background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);'}">
                      ${isPlaypin ? '🎮 PlayPin' : '⚡ FazerCards'}
                    </span>
                  </div>
                </div>

                <div class="mobile-offer-meta-grid">
                  <div class="mobile-meta-item">
                    <span>Maya (USD / AZN)</span>
                    <strong style="color: var(--text-secondary);">$${o.price_usd_num.toFixed(2)} (${o.base_azn.toFixed(2)} ₼)</strong>
                  </div>
                  <div class="mobile-meta-item">
                    <span>Xalis Qazanc</span>
                    <strong id="mob_inline_profit_${categoryId}_${o.offer_id}" style="color: var(--brand-cyan);">
                      +${o.profit_azn.toFixed(2)} ₼ <small style="opacity: 0.85;">(${profitPct}%)</small>
                    </strong>
                  </div>
                </div>

                <div class="mobile-offer-edit-row">
                  <div class="mobile-price-input-wrap">
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Satış:</span>
                    <input type="number" step="0.01" 
                      id="mob_inline_price_${categoryId}_${o.offer_id}" 
                      value="${o.selling_price_azn.toFixed(2)}" 
                      oninput="recalcInlineRowProfit('${categoryId}', '${o.offer_id}', ${o.base_azn}, true)">
                    <span style="font-weight: 800; color: var(--brand-emerald); font-size: 13px;">₼</span>
                  </div>
                  <button class="mobile-save-btn" onclick="saveInlinePriceAction('${categoryId}', '${o.offer_id}', ${o.price_usd_num}, ${o.base_azn}, true)">
                    💾 Yadda Saxla
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      wrap.innerHTML = `<div style="text-align: center; color: #f87171; padding: 16px; font-size: 12px;">${data.error || 'Bu kateqoriyada paket tapılmadı.'}</div>`;
    }
  } catch (e) {
    wrap.innerHTML = '<div style="text-align: center; color: #f87171; padding: 15px; font-size: 12px;">Təklifləri yükləmək mümkün olmadı.</div>';
  }
}

function recalcInlineRowProfit(catId, offerId, baseAzn, isMob = false) {
  const deskInput = document.getElementById(`inline_price_${catId}_${offerId}`);
  const mobInput = document.getElementById(`mob_inline_price_${catId}_${offerId}`);
  const deskProfit = document.getElementById(`inline_profit_${catId}_${offerId}`);
  const mobProfit = document.getElementById(`mob_inline_profit_${catId}_${offerId}`);

  const activeInput = isMob ? mobInput : (deskInput || mobInput);
  if (!activeInput) return;

  const newPrice = parseFloat(activeInput.value) || 0;
  const profit = newPrice - baseAzn;
  const profitPct = baseAzn > 0 ? ((profit / baseAzn) * 100).toFixed(1) : '0';
  const htmlContent = `+${profit.toFixed(2)} ₼ <small style="opacity: 0.85;">(${profitPct}%)</small>`;
  const textColor = profit >= 0 ? '#38bdf8' : '#f87171';

  // Girişləri sinxronlaşdır
  if (deskInput && isMob) deskInput.value = activeInput.value;
  if (mobInput && !isMob) mobInput.value = activeInput.value;

  if (deskProfit) {
    deskProfit.innerHTML = htmlContent;
    deskProfit.style.color = textColor;
  }
  if (mobProfit) {
    mobProfit.innerHTML = htmlContent;
    mobProfit.style.color = textColor;
  }
}

async function saveInlinePriceAction(categoryId, offerId, baseUsd, baseAzn, isMob = false) {
  const input = isMob 
    ? (document.getElementById(`mob_inline_price_${categoryId}_${offerId}`) || document.getElementById(`inline_price_${categoryId}_${offerId}`))
    : (document.getElementById(`inline_price_${categoryId}_${offerId}`) || document.getElementById(`mob_inline_price_${categoryId}_${offerId}`));
  if (!input) return;

  const customPriceAzn = parseFloat(input.value);
  if (isNaN(customPriceAzn) || customPriceAzn <= 0) {
    showToast('error', 'Zəhmət olmasa düzgün satış qiyməti daxil edin.');
    return;
  }

  try {
    const res = await authFetch(`/api/admin/api-categories/${categoryId}/pricing`, {
      method: 'POST',
      body: JSON.stringify({
        offer_id: offerId,
        offer_name: offerId,
        base_usd: baseUsd,
        custom_price_azn: customPriceAzn
      })
    });
    const data = await res.json();

    if (data.ok) {
      showToast('success', `✅ Satış qiyməti (${customPriceAzn.toFixed(2)} ₼) yadda saxlanıldı!`);
    } else {
      showToast('error', `Xəta: ${data.error}`);
    }
  } catch (err) {
    showToast('error', 'Qiymət yadda saxlanılarkən xəta baş verdi.');
  }
}

async function toggleApiCategoryStatus(categoryId) {
  try {
    const res = await authFetch(`/api/admin/api-categories/${categoryId}/toggle`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      loadApiCatalogDashboard();
    }
  } catch (e) {}
}

async function deleteApiCategoryPrompt(categoryId) {
  const cat = cachedApiCategories.find(c => c.category_id === categoryId);
  const name = cat ? cat.name : categoryId;
  if (!confirm(`⚠️ "${name}" API kateqoriyasını və təyin edilmiş xüsusi qiymətlərini silmək istədiyinizə əminsiniz?`)) {
    return;
  }

  try {
    const res = await authFetch(`/api/admin/api-categories/${categoryId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      loadApiCatalogDashboard();
    } else {
      alert(`Xəta: ${data.error}`);
    }
  } catch (e) {
    alert('Silinmə xətası baş verdi.');
  }
}

// =========================================================================
// API AXTARIŞ MODALI VƏ ADDIM 1 / ADDIM 2 NƏZARƏTÇİSİ
// =========================================================================

async function openApiCatalogSearchModal() {
  const modal = document.getElementById('apiCatalogSearchModal');
  if (!modal) return;

  const searchInput = document.getElementById('apiCatalogSearchInput');
  if (searchInput) searchInput.value = '';
  setApiFilterType('all', document.getElementById('filterTypeAll'));
  backToApiSearchStep1();
  modal.style.display = 'flex';

  const listContainer = document.getElementById('apiCatalogListContainer');
  const hasCache = (cachedFazerCatalog.topups && cachedFazerCatalog.topups.length > 0) || 
                   (cachedFazerCatalog.giftcards && cachedFazerCatalog.giftcards.length > 0);

  if (hasCache) {
    filterApiCatalogSearch('');
  } else {
    listContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px;">Bütün API Kataloqu yüklənir...</div>';
  }

  try {
    const res = await authFetch('/api/admin/fazer/all-catalog');
    const data = await res.json();

    if (data.ok) {
      cachedFazerCatalog = {
        topups: data.topups || [],
        giftcards: data.giftcards || []
      };
      try {
        sessionStorage.setItem('winners_fazer_catalog', JSON.stringify(cachedFazerCatalog));
      } catch (e) {}
      const currentQuery = document.getElementById('apiCatalogSearchInput')?.value || '';
      filterApiCatalogSearch(currentQuery);
    } else {
      if (!hasCache) {
        listContainer.innerHTML = `
          <div style="text-align: center; color: #f87171; padding: 40px;">
            <p style="margin-bottom: 12px; font-weight: 700;">API Kataloqunu yükləmək mümkün olmadı: ${data.error || 'Server xətası'}</p>
            <button class="btn-action" onclick="openApiCatalogSearchModal()" style="background: #334155; color: #fff;">🔄 Yenidən Cəhd Et</button>
          </div>
        `;
      }
    }
  } catch (err) {
    if (!hasCache) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: #f87171; padding: 40px;">
          <p style="margin-bottom: 12px; font-weight: 700;">⚠️ Əlaqə xətası baş verdi.</p>
          <button class="btn-action" onclick="openApiCatalogSearchModal()" style="background: #334155; color: #fff;">🔄 Yenidən Cəhd Et</button>
        </div>
      `;
    }
  }
}

function closeApiCatalogSearchModal() {
  const modal = document.getElementById('apiCatalogSearchModal');
  if (modal) modal.style.display = 'none';
}

let currentApiProviderFilter = 'all'; // 'all' | 'fazercards' | 'playpin'

function setApiProviderFilter(provider, btn) {
  currentApiProviderFilter = provider;
  document.querySelectorAll('.filter-prov-btn').forEach(b => {
    b.classList.remove('active');
    b.style.background = '#1e293b';
  });
  if (btn) {
    btn.classList.add('active');
    btn.style.background = '#334155';
  }
  const searchVal = document.getElementById('apiCatalogSearchInput')?.value || '';
  filterApiCatalogSearch(searchVal);
}

function setApiFilterType(type, btn) {
  currentApiFilterType = type;
  document.querySelectorAll('.filter-type-btn').forEach(b => {
    b.classList.remove('active');
    b.style.background = '#1e293b';
    b.style.color = '#94a3b8';
  });
  if (btn) {
    btn.classList.add('active');
    btn.style.background = '#334155';
    btn.style.color = '#fff';
  }
  const searchVal = document.getElementById('apiCatalogSearchInput')?.value || '';
  filterApiCatalogSearch(searchVal);
}

function filterApiCatalogSearch(query) {
  const listContainer = document.getElementById('apiCatalogListContainer');
  if (!listContainer) return;

  const q = (query || '').toLowerCase().trim();
  let items = [];

  if (currentApiFilterType === 'all' || currentApiFilterType === 'topup') {
    items.push(...(cachedFazerCatalog.topups || []));
  }
  if (currentApiFilterType === 'all' || currentApiFilterType ==='giftcard') {
    items.push(...(cachedFazerCatalog.giftcards || []));
  }

  // Təchizatçı Filtri
  if (currentApiProviderFilter === 'playpin') {
    items = items.filter(i => i.provider === 'playpin' || i.category_id === 'pubg_mobile_epin' || i.category_id === 'pubg_mobile_web' || (i.note && i.note.includes('PlayPin')));
  } else if (currentApiProviderFilter === 'fazercards') {
    items = items.filter(i => (i.provider === 'fazercards' || !i.provider) && i.category_id !== 'pubg_mobile_epin' && i.category_id !== 'pubg_mobile_web');
  }

  if (q) {
    items = items.filter(i => i.name.toLowerCase().includes(q) || i.category_id.toLowerCase().includes(q) || (i.note && i.note.toLowerCase().includes(q)));
  }

  if (items.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 40px;">
        🔍 "${query}" sorğusuna və seçilmiş filtrlərə uyğun heç bir API kateqoriyası tapılmadı.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = items.map(item => {
    const isTopup = item.type === 'topup';
    const isPlaypin = item.provider === 'playpin' || item.category_id === 'pubg_mobile_epin' || item.category_id === 'pubg_mobile_web' || (item.note && item.note.includes('PlayPin'));
    
    const typeBadge = isTopup 
      ? '<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px;">🕹️ Avtomatik Top-Up</span>'
      : '<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #d8b4fe; font-size: 10px;">🎟️ Avtomatik E-Pin</span>';
    
    const providerBadge = isPlaypin
      ? '<span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.35); font-weight: 700; font-size: 10px;">🎮 PlayPin API</span>'
      : '<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-weight: 700; font-size: 10px;">⚡ FazerCards API</span>';

    const addedBadge = item.is_added 
      ? '<span class="badge badge-completed" style="font-size: 10px;">🟢 Əlavə Edilib</span>' 
      : '<span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-secondary); font-size: 10px;">⚪ Əlavə olunmayıb</span>';

    // Ada əsaslanaraq standart emojini təxmin et
    let defaultEmoji = '🎮';
    const n = item.name.toLowerCase();
    if (n.includes('pubg')) defaultEmoji = '🔫';
    else if (n.includes('free fire')) defaultEmoji = '🔥';
    else if (n.includes('valorant')) defaultEmoji = '🎯';
    else if (n.includes('roblox')) defaultEmoji = '🧱';
    else if (n.includes('mobile legends')) defaultEmoji = '⚔️';
    else if (n.includes('brawl')) defaultEmoji = '⭐';
    else if (n.includes('steam')) defaultEmoji = '🎮';
    else if (n.includes('netflix')) defaultEmoji = '🎬';
    else if (n.includes('spotify')) defaultEmoji = '🎵';
    else if (n.includes('stars') || n.includes('telegram')) defaultEmoji = '⭐️';
    else if (n.includes('nitro') || n.includes('discord')) defaultEmoji = '💎';

    return `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px; transition: background 0.15s ease;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px;">${defaultEmoji}</div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <strong style="color: #fff; font-size: 14px;">${item.name}</strong>
              ${providerBadge}
              ${typeBadge}
              ${addedBadge}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              ID: <code>${item.category_id}</code> ${item.note ? `• <i>${item.note.replace(/\n/g, ' ')}</i>` : ''}
            </div>
          </div>
        </div>
        <div>
          <button class="btn-action" style="background: linear-gradient(135deg, #0284c7, #38bdf8); color: #0b0f19; font-weight: 800; padding: 6px 14px; font-size: 12px; white-space: nowrap;" 
            onclick="selectApiCategoryForPricing('${item.category_id}', '${item.type}')">
            Seç &amp; Qiymətlərə Bax ➡️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ADDIM 2: KATEQORİYANI SEÇ VƏ PAKET QİYMƏTLƏNDİRMƏSİNİ QURAŞDIR
async function selectApiCategoryForPricing(catId, type) {
  const modal = document.getElementById('apiCatalogSearchModal');
  if (modal) {
    modal.style.display = 'flex';
  }

  const allItems = [...(cachedFazerCatalog.topups || []), ...(cachedFazerCatalog.giftcards || [])];
  let item = allItems.find(c => c.category_id === catId);

  if (!item && typeof currentAdminData !== 'undefined' && currentAdminData.products) {
    item = currentAdminData.products.find(p => p.category_id === catId);
  }
  if (!item && typeof cachedApiCategories !== 'undefined') {
    item = cachedApiCategories.find(c => c.category_id === catId);
  }

  const name = item ? item.name : catId;
  const note = item ? item.note : '';

  let defaultEmoji = '🎮';
  const n = (name || '').toLowerCase();
  if (n.includes('king') || n.includes('crown') || n.includes('lord')) defaultEmoji = '👑';
  else if (n.includes('pubg')) defaultEmoji = '🔫';
  else if (n.includes('free fire')) defaultEmoji = '🔥';
  else if (n.includes('valorant')) defaultEmoji = '🎯';
  else if (n.includes('roblox')) defaultEmoji = '🧱';
  else if (n.includes('mobile legends') || n.includes('mlbb')) defaultEmoji = '⚔️';
  else if (n.includes('brawl')) defaultEmoji = '⭐';
  else if (n.includes('clash') || n.includes('royale')) defaultEmoji = '🏰';
  else if (n.includes('arena') || n.includes('shield')) defaultEmoji = '🛡️';
  else if (n.includes('football') || n.includes('fifa') || n.includes('pes')) defaultEmoji = '⚽';
  else if (n.includes('asphalt') || n.includes('car') || n.includes('racing')) defaultEmoji = '🏎️';
  else if (n.includes('steam') || n.includes('playstation') || n.includes('xbox')) defaultEmoji = '🎮';
  else if (n.includes('netflix')) defaultEmoji = '🎬';
  else if (n.includes('spotify')) defaultEmoji = '🎵';
  else if (n.includes('stars') || n.includes('telegram')) defaultEmoji = '⭐️';
  else if (n.includes('premium') || n.includes('nitro') || n.includes('diamond')) defaultEmoji = '💎';
  else if (n.includes('gift') || n.includes('card') || n.includes('epin')) defaultEmoji = '🎟️';

  const existing = (cachedApiCategories || []).find(c => c.category_id === catId);
  const initialIcon = existing && existing.icon ? existing.icon : defaultEmoji;
  const initialCustomEmojiId = existing && existing.custom_emoji_id ? existing.custom_emoji_id : '';

  currentSelectedApiCat = { catId, type, name, note };
  
  const step1 = document.getElementById('apiCatSearchStep1');
  const step2 = document.getElementById('apiCatSearchStep2');
  if (step1) step1.style.display = 'none';
  if (step2) step2.style.display = 'flex';

  const nameEl = document.getElementById('selectedCatName');
  if (nameEl) nameEl.innerText = name;
  const iconInp = document.getElementById('selectedCatIcon');
  if (iconInp) iconInp.value = initialIcon;
  const emojiIdInp = document.getElementById('selectedCatCustomEmojiId');
  if (emojiIdInp) emojiIdInp.value = initialCustomEmojiId;
  const badgeEl = document.getElementById('selectedCatTypeBadge');
  if (badgeEl) {
    badgeEl.innerHTML = type === 'topup'
      ? '<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px;">🕹️ Avtomatik Top-Up (Player ID tələb olunur)</span>'
      : '<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #d8b4fe; font-size: 10px;">🎟️ Avtomatik E-Pin (Rəqəmsal Kod birbaşa çata ötürülür)</span>';
  }

  const container = document.getElementById('selectedCatOffersContainer');
  if (container) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 30px;">Paketlər və canlı maya dəyərləri hesablanır...</div>';
  }

  try {
    const res = await authFetch(`/api/admin/fazer/category-offers/${catId}?type=${type}`);
    let data = {};
    try {
      data = await res.json();
    } catch (e) {}

    if (res.ok && data.ok && data.offers && data.offers.length > 0) {
      currentSelectedCatOffers = data.offers;
      renderSelectedCatOffersTable(data.offers);
    } else {
      if (container) {
        const errorMsg = data.error || 'Bu kateqoriya təchizatçı (FazerCards) sistemində hazırda deaktivdir və ya stokda paket yoxdur.';
        container.innerHTML = `
          <div style="text-align: center; color: #f87171; padding: 26px; background: rgba(239, 68, 68, 0.05); border-radius: 12px; border: 1px dashed rgba(239, 68, 68, 0.25); margin: 16px 0;">
            <div style="font-size: 26px; margin-bottom: 6px;">⚠️</div>
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px; color: #fca5a5;">Canlı Paket Tapılmadı</div>
            <div style="font-size: 12px; color: #cbd5e1; max-width: 480px; margin: 0 auto 14px auto; line-height: 1.5;">${errorMsg}</div>
            <button class="btn-action" style="background: rgba(255,255,255,0.08); color: #fff; padding: 6px 16px; font-size: 12px; border-radius: 6px;" onclick="backToApiCatalogList()">
              🔙 Digər Kateqoriyalara Bax
            </button>
          </div>
        `;
      }
    }
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; color: #f87171; padding: 26px; background: rgba(239, 68, 68, 0.05); border-radius: 12px; border: 1px dashed rgba(239, 68, 68, 0.25); margin: 16px 0;">
          <div style="font-size: 26px; margin-bottom: 6px;">⚠️</div>
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px; color: #fca5a5;">Paketləri Yükləmək Mümkün Olmadı</div>
          <div style="font-size: 12px; color: #cbd5e1; max-width: 480px; margin: 0 auto 14px auto; line-height: 1.5;">Təchizatçı (FazerCards) API serverindən bu kateqoriya üçün canlı paketlər cavab vermədi (Müvəqqəti deaktivdir).</div>
          <button class="btn-action" style="background: rgba(255,255,255,0.08); color: #fff; padding: 6px 16px; font-size: 12px; border-radius: 6px;" onclick="backToApiCatalogList()">
            🔙 Digər Kateqoriyalara Bax
          </button>
        </div>
      `;
    }
  }
}

function renderSelectedCatOffersTable(offers) {
  const container = document.getElementById('selectedCatOffersContainer');
  if (!container) return;

  container.innerHTML = `
    <!-- Masaüstü Cədvəl Görünüşü -->
    <div class="desktop-offers-table table-responsive">
      <table class="admin-table" style="font-size: 13px;">
        <thead>
          <tr>
            <th>Paket Adı</th>
            <th>Maya (USD)</th>
            <th>Maya (AZN)</th>
            <th style="color: #34d399;">Satış Qiyməti (AZN ₼)</th>
            <th style="color: #38bdf8;">Qazancınız</th>
          </tr>
        </thead>
        <tbody>
          ${offers.map((o, idx) => {
            const profitPct = o.base_azn > 0 ? ((o.profit_azn / o.base_azn) * 100).toFixed(1) : '0';
            return `
              <tr>
                <td><strong>${o.name}</strong></td>
                <td style="color: var(--text-secondary); font-family: var(--font-mono);">$${o.price_usd_num.toFixed(2)}</td>
                <td style="color: var(--text-secondary); font-family: var(--font-mono); font-weight: 600;">${o.base_azn.toFixed(2)} ₼</td>
                <td>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <input type="number" step="0.01" class="form-control selected-pkg-input" 
                      id="modal_pkg_price_${idx}" 
                      data-offer-id="${o.offer_id}" 
                      data-offer-name="${escapeQuotes(o.name)}" 
                      data-base-usd="${o.price_usd_num}" 
                      data-base-azn="${o.base_azn}" 
                      value="${o.selling_price_azn.toFixed(2)}" 
                      oninput="recalcModalPkgProfit(${idx}, ${o.base_azn}, false)" 
                      style="width: 90px; padding: 4px 8px; font-weight: 800; font-size: 13px; text-align: right; color: #34d399;">
                    <span style="font-weight: 700; color: #34d399; font-size: 12px;">₼</span>
                  </div>
                </td>
                <td>
                  <span id="modal_pkg_profit_${idx}" style="color: #38bdf8; font-weight: 700; font-size: 12px; font-family: var(--font-mono);">
                    +${o.profit_azn.toFixed(2)} ₼ <small style="opacity: 0.85;">(${profitPct}%)</small>
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Mobil Kart Siyahısı Görünüşü -->
    <div class="mobile-offers-list">
      ${offers.map((o, idx) => {
        const profitPct = o.base_azn > 0 ? ((o.profit_azn / o.base_azn) * 100).toFixed(1) : '0';
        return `
          <div class="mobile-offer-card">
            <div class="mobile-offer-top">
              <div class="mobile-offer-title">${o.name}</div>
            </div>

            <div class="mobile-offer-meta-grid">
              <div class="mobile-meta-item">
                <span>Maya (USD / AZN)</span>
                <strong style="color: var(--text-secondary);">$${o.price_usd_num.toFixed(2)} (${o.base_azn.toFixed(2)} ₼)</strong>
              </div>
              <div class="mobile-meta-item">
                <span>Xalis Qazanc</span>
                <strong id="mob_modal_pkg_profit_${idx}" style="color: var(--brand-cyan);">
                  +${o.profit_azn.toFixed(2)} ₼ <small style="opacity: 0.85;">(${profitPct}%)</small>
                </strong>
              </div>
            </div>

            <div class="mobile-offer-edit-row">
              <div class="mobile-price-input-wrap">
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Satış:</span>
                <input type="number" step="0.01" class="selected-pkg-input"
                  id="mob_modal_pkg_price_${idx}"
                  data-offer-id="${o.offer_id}" 
                  data-offer-name="${escapeQuotes(o.name)}" 
                  data-base-usd="${o.price_usd_num}" 
                  data-base-azn="${o.base_azn}"
                  value="${o.selling_price_azn.toFixed(2)}" 
                  oninput="recalcModalPkgProfit(${idx}, ${o.base_azn}, true)">
                <span style="font-weight: 800; color: var(--brand-emerald); font-size: 13px;">₼</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function recalcModalPkgProfit(idx, baseAzn, isMob = false) {
  const deskInput = document.getElementById(`modal_pkg_price_${idx}`);
  const mobInput = document.getElementById(`mob_modal_pkg_price_${idx}`);
  const deskProfit = document.getElementById(`modal_pkg_profit_${idx}`);
  const mobProfit = document.getElementById(`mob_modal_pkg_profit_${idx}`);

  const activeInput = isMob ? mobInput : (deskInput || mobInput);
  if (!activeInput) return;

  const newPrice = parseFloat(activeInput.value) || 0;
  const profit = newPrice - baseAzn;
  const profitPct = baseAzn > 0 ? ((profit / baseAzn) * 100).toFixed(1) : '0';
  const htmlContent = `+${profit.toFixed(2)} ₼ <small style="opacity: 0.85;">(${profitPct}%)</small>`;
  const textColor = profit >= 0 ? '#38bdf8' : '#f87171';

  if (deskInput && isMob) deskInput.value = activeInput.value;
  if (mobInput && !isMob) mobInput.value = activeInput.value;

  if (deskProfit) {
    deskProfit.innerHTML = htmlContent;
    deskProfit.style.color = textColor;
  }
  if (mobProfit) {
    mobProfit.innerHTML = htmlContent;
    mobProfit.style.color = textColor;
  }
}

function backToApiSearchStep1() {
  const step2 = document.getElementById('apiCatSearchStep2');
  const step1 = document.getElementById('apiCatSearchStep1');
  if (step2) step2.style.display = 'none';
  if (step1) step1.style.display = 'flex';
}

function selectSelectedCatEmoji(emoji) {
  const inp = document.getElementById('selectedCatIcon');
  if (inp) inp.value = emoji;
}

async function saveSelectedApiCategoryWithPricing() {
  if (!currentSelectedApiCat) return;

  const icon = document.getElementById('selectedCatIcon').value.trim() || '🎮';
  const customEmojiId = (document.getElementById('selectedCatCustomEmojiId').value || '').trim();
  const inputs = document.querySelectorAll('.selected-pkg-input');
  const seenOffers = new Set();
  const packages = [];

  inputs.forEach(inp => {
    const offerId = inp.getAttribute('data-offer-id');
    if (!offerId || seenOffers.has(offerId)) return;
    seenOffers.add(offerId);

    const offerName = inp.getAttribute('data-offer-name');
    const baseUsd = parseFloat(inp.getAttribute('data-base-usd')) || 0;
    const customPriceAzn = parseFloat(inp.value) || 0;

    packages.push({
      offer_id: offerId,
      offer_name: offerName,
      base_usd: baseUsd,
      custom_price_azn: customPriceAzn
    });
  });

  try {
    const res = await authFetch('/api/admin/api-categories', {
      method: 'POST',
      body: JSON.stringify({
        category_id: currentSelectedApiCat.catId,
        name: currentSelectedApiCat.name,
        icon: icon,
        custom_emoji_id: customEmojiId,
        type: currentSelectedApiCat.type,
        note: currentSelectedApiCat.note,
        packages: packages
      })
    });
    const data = await res.json();

    if (data.ok) {
      alert(`🎉 "${currentSelectedApiCat.name}" kateqoriyası və ${packages.length} ədəd paketin satış qiymətləri uğurla yadda saxlanıldı və Telegram botuna əlavə olundu!`);
      closeApiCatalogSearchModal();
      loadApiCatalogDashboard();
    } else {
      alert(`Xəta: ${data.error}`);
    }
  } catch (err) {
    alert('Yadda saxlanılarkən xəta baş verdi.');
  }
}

// =========================================================================
// API PARTNYORLARI VƏ AÇARLARIN İDARƏ EDİLMƏSİ
// =========================================================================

async function fetchAdminApiKeys() {
  const tbody = document.getElementById('adminApiKeysTableBody');
  if (!tbody) return;

  try {
    const res = await authFetch('/api/admin/api-keys');
    const data = await res.json();

    if (!data.ok || !data.keys || data.keys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">Hələlik heç bir partnyor API açarı yaradılmayıb.</td></tr>';
      return;
    }

    tbody.innerHTML = data.keys.map(k => {
      const nameLetter = (k.first_name || k.username || 'P').charAt(0).toUpperCase();
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(99, 102, 241, 0.2)); border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #38bdf8; font-size: 13px;">
                ${nameLetter}
              </div>
              <div>
                <strong style="color: #fff; font-size: 13px;">${escapeHtml(k.first_name || k.username || 'Müştəri')}</strong><br>
                <small style="color: var(--text-secondary); font-family: 'JetBrains Mono', monospace; font-size: 11px;">ID: ${escapeHtml(k.telegram_id)}</small>
              </div>
            </div>
          </td>
          <td><strong style="color: #e2e8f0; font-size: 13px;">${escapeHtml(k.name)}</strong></td>
          <td>
            <span class="code-pill" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 7px;" onclick="copyToClipboard('${escapeHtml(k.api_key)}', 'API Key')">
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #38bdf8;">${escapeHtml(k.api_key.slice(0, 14))}...${escapeHtml(k.api_key.slice(-6))}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.7;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </span>
          </td>
          <td><strong style="color: #38bdf8; font-family: 'JetBrains Mono', monospace; font-size: 13px;">${parseFloat(k.balance || 0).toFixed(2)} ₼</strong></td>
          <td><span class="badge-stock" style="font-family: 'JetBrains Mono', monospace;">${k.total_orders || 0}</span></td>
          <td><strong style="color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 13px;">${parseFloat(k.total_spent_azn || 0).toFixed(2)} ₼</strong></td>
          <td>
            <span class="status-pill ${k.is_active ? 'status-completed' : 'status-failed'}" style="display: inline-flex; align-items: center; gap: 5px; font-weight: 700; font-size: 11px;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: ${k.is_active ? '#34d399' : '#f87171'}; box-shadow: 0 0 6px ${k.is_active ? '#34d399' : '#f87171'};"></span>
              ${k.is_active ? 'AKTİV' : 'DEAKTİV'}
            </span>
          </td>
          <td>
            <button class="btn-action" style="display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; font-size: 12px; font-weight: 600; border-radius: 7px; ${k.is_active ? 'color: #f87171; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25);' : 'color: #4ade80; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.25);'}" onclick="toggleAdminApiKey(${k.id}, ${k.is_active ? 0 : 1})">
              ${k.is_active ? 
                `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Deaktiv et` : 
                `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Aktivləşdir`}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #f87171; padding: 24px;">API Açarları yüklənərkən xəta baş verdi.</td></tr>';
  }
}

async function toggleAdminApiKey(keyId, newStatus) {
  try {
    const res = await authFetch('/api/admin/api-keys/toggle', {
      method: 'POST',
      body: JSON.stringify({ key_id: keyId, is_active: newStatus })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('success', newStatus ? 'API Açarı aktivləşdirildi!' : 'API Açarı deaktiv edildi!');
      fetchAdminApiKeys();
    } else {
      showToast('error', 'Status dəyişdirilə bilmədi.');
    }
  } catch (e) {
    showToast('error', 'Xəta baş verdi.');
  }
}

async function openAdminCreateApiKeyModal() {
  const tgId = prompt('Partnyorun Telegram ID-sini daxil edin (Məsələn: 1108583389):');
  if (!tgId) return;

  const keyName = prompt('API Açar üçün ad (Məs: WebShop Bot API):', 'B2B Client API');
  if (!keyName) return;

  try {
    const res = await authFetch('/api/user/api-keys/generate', {
      method: 'POST',
      body: JSON.stringify({ telegram_id: tgId.trim(), name: keyName.trim() })
    });
    const data = await res.json();
    if (data.ok) {
      alert(`🎉 Yeni B2B API Açarı Uğurla Yaradıldı!\n\nAPI KEY: ${data.apiKey.key}\n\nBu açarı partnyora göndərə bilərsiniz.`);
      fetchAdminApiKeys();
    } else {
      alert('Xəta: ' + (data.error || 'Yaradılmadı.'));
    }
  } catch (e) {
    alert('Sorğu xətası.');
  }
}

// =========================================================================
// TELEGRAM XÜSUSİ EMOJİLƏR (PREMİUM) İDARƏEDİCİSİ
// =========================================================================
let cachedCustomEmojis = {};
let cachedApiCategoriesList = [];
let currentEmojiFilterTab = 'all';

async function loadCustomEmojisAdmin() {
  const container = document.getElementById('customEmojisGrid');
  if (!container) return;
  container.innerHTML = '<div style="text-align: center; color: var(--text-muted); grid-column: 1 / -1; padding: 40px;">Telegram emojiləri yüklənir...</div>';

  try {
    const [emojiRes, catsRes] = await Promise.all([
      authFetch('/api/admin/custom-emojis'),
      authFetch('/api/admin/api-categories')
    ]);

    const emojiData = await emojiRes.json();
    const catsData = await catsRes.json();

    cachedCustomEmojis = (emojiData.ok && emojiData.emojis) ? emojiData.emojis : {};
    cachedApiCategoriesList = (catsData.ok && catsData.categories) ? catsData.categories : [];

    renderCustomEmojisGrid();
  } catch (err) {
    container.innerHTML = '<div style="text-align: center; color: #f87171; grid-column: 1 / -1; padding: 40px;">Emojiləri yükləmək mümkün olmadı.</div>';
  }
}

function renderCustomEmojisGrid() {
  const container = document.getElementById('customEmojisGrid');
  if (!container) return;

  const searchQuery = (document.getElementById('customEmojiSearchInput')?.value || '').toLowerCase().trim();

  // Elementlərin birləşdirilmiş siyahısını qur
  // 1. Sistem və JSON elementləri
  const items = [];

  for (const [key, item] of Object.entries(cachedCustomEmojis)) {
    let group = 'system';
    const k = key.toUpperCase();
    if (k.includes('STOCK') || k.includes('EPIN') || k.includes('TIER') || k.includes('PACKAGE') || k.includes('OFFER') || k.includes('MONEY') || k.includes('BALANCE')) {
      group = 'stock';
    } else if (k.includes('PUBG') || k.includes('FREE_FIRE') || k.includes('STARS') || k.includes('ROBLOX') || k.includes('STEAM') || k.includes('VALORANT') || k.includes('BRAWL') || k.includes('NETFLIX') || k.includes('GENSHIN') || k.includes('MOBILE_LEGENDS') || k.includes('CODM') || k.includes('ARENA') || k.includes('POOL') || k.includes('BLOOD') || k.includes('DELTA') || k.includes('DISCORD') || k.includes('EA_') || k.includes('SPOTIFY') || k.includes('AFK') || k.includes('APP_STORE') || k.includes('ITUNES') || k.includes('BE_THE_KING')) {
      group = 'games';
    }

    items.push({
      type: 'json',
      key: key,
      name: item.name || key,
      defaultIcon: item.default || '🔹',
      customEmojiId: item.custom_emoji_id || '',
      group: group,
      isCategory: false
    });
  }

  // 2. JSON-da olmayan və ya birbaşa kateqoriya custom_emoji_id-si olan API Kateqoriyalarını bazadan əlavə et
  for (const cat of cachedApiCategoriesList) {
    const existingInJson = items.find(it => it.key.toUpperCase() === cat.category_id.toUpperCase());
    if (existingInJson) {
      if (cat.custom_emoji_id) {
        existingInJson.customEmojiId = cat.custom_emoji_id;
      }
      existingInJson.isCategory = true;
      existingInJson.categoryId = cat.category_id;
    } else {
      items.push({
        type: 'category',
        key: cat.category_id.toUpperCase(),
        name: cat.name,
        defaultIcon: cat.icon || '🎮',
        customEmojiId: cat.custom_emoji_id || '',
        group: 'games',
        isCategory: true,
        categoryId: cat.category_id
      });
    }
  }

  // Tab və axtarışa görə elementləri filtrlə
  const filtered = items.filter(it => {
    // Tab filtri
    if (currentEmojiFilterTab === 'games' && it.group !== 'games') return false;
    if (currentEmojiFilterTab === 'system' && it.group !== 'system') return false;
    if (currentEmojiFilterTab === 'stock' && it.group !== 'stock') return false;

    // Axtarış filtri
    if (searchQuery) {
      const matchName = (it.name || '').toLowerCase().includes(searchQuery);
      const matchKey = (it.key || '').toLowerCase().includes(searchQuery);
      const matchId = (it.customEmojiId || '').toLowerCase().includes(searchQuery);
      if (!matchName && !matchKey && !matchId) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); grid-column: 1 / -1; padding: 40px;">Heç bir emoji tapılmadı.</div>';
    return;
  }

  container.innerHTML = filtered.map(it => {
    const hasCustomId = Boolean(it.customEmojiId && it.customEmojiId.trim());
    const badgeColor = it.group === 'games' ? 'rgba(56, 189, 248, 0.15); color: #38bdf8;' : (it.group === 'stock' ? 'rgba(52, 211, 153, 0.15); color: #34d399;' : 'rgba(168, 85, 247, 0.15); color: #c084fc;');
    const groupLabel = it.group === 'games' ? '🎮 Oyun / Kataloq' : (it.group === 'stock' ? '📦 Stok / Paket' : '🏛 Sistem / Menyu');

    return `
      <div class="stat-card" style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid ${hasCustomId ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.08)'}; background: ${hasCustomId ? 'rgba(168, 85, 247, 0.04)' : 'rgba(15, 23, 42, 0.65)'}; border-radius: 14px; position: relative;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="font-size: 24px; width: 42px; height: 42px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.1);">
                ${it.defaultIcon}
              </div>
              <div>
                <div style="font-weight: 700; color: #fff; font-size: 14px; line-height: 1.2;">${it.name}</div>
                <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${it.key}</div>
              </div>
            </div>
            <span class="badge" style="background: ${badgeColor}; font-size: 10px; padding: 2px 6px; border-radius: 6px;">
              ${groupLabel}
            </span>
          </div>

          <div style="margin-top: 12px; margin-bottom: 12px;">
            <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px;">
              Telegram Premium Custom Emoji ID:
            </label>
            <div style="position: relative;">
              <input type="text" 
                id="emoji_inp_${it.key}" 
                value="${it.customEmojiId || ''}" 
                placeholder="Məs: 5852871561983299073" 
                data-key="${it.key}" 
                data-is-cat="${it.isCategory ? '1' : '0'}" 
                data-cat-id="${it.categoryId || ''}"
                style="width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.45); border: 1px solid ${hasCustomId ? '#a855f7' : 'rgba(255, 255, 255, 0.12)'}; color: ${hasCustomId ? '#e9d5ff' : '#fff'}; border-radius: 8px; padding: 8px 12px; font-size: 12.5px; font-family: monospace;"
              >
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 6px;">
          ${hasCustomId ? `
            <button class="btn-secondary-sm" onclick="clearSingleCustomEmoji('${it.key}', ${it.isCategory ? 'true' : 'false'}, '${it.categoryId || ''}')" style="font-size: 11px; padding: 6px 10px; border-radius: 8px; color: #f87171;" title="Standart Unicode İkonuna Qaytar">
              Təmizlə
            </button>
          ` : ''}
          <button class="btn-primary-sm" onclick="saveSingleCustomEmoji('${it.key}', ${it.isCategory ? 'true' : 'false'}, '${it.categoryId || ''}')" style="font-size: 11px; padding: 6px 14px; border-radius: 8px; background: linear-gradient(135deg, #8b5cf6, #38bdf8); border: none; font-weight: 700; cursor: pointer;">
            Yadda Saxla
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterCustomEmojisList() {
  renderCustomEmojisGrid();
}

function filterEmojiTab(tab, btn) {
  currentEmojiFilterTab = tab;
  document.querySelectorAll('.search-filter-bar .btn-filter').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCustomEmojisGrid();
}

async function saveSingleCustomEmoji(key, isCategory = false, categoryId = '') {
  const inp = document.getElementById(`emoji_inp_${key}`);
  if (!inp) return;
  const emojiId = (inp.value || '').trim();

  try {
    if (isCategory && categoryId) {
      // DB kateqoriyasını yenilə
      await authFetch(`/api/admin/api-categories/${categoryId}/custom-emoji`, {
        method: 'POST',
        body: JSON.stringify({ custom_emoji_id: emojiId })
      });
    }

    // Həmçinin custom-emojis.json-u yenilə
    await authFetch('/api/admin/custom-emojis', {
      method: 'POST',
      body: JSON.stringify({ key, custom_emoji_id: emojiId })
    });

    if (cachedCustomEmojis[key]) {
      cachedCustomEmojis[key].custom_emoji_id = emojiId;
    }
    const cat = cachedApiCategoriesList.find(c => c.category_id === categoryId);
    if (cat) cat.custom_emoji_id = emojiId;

    showToast('success', `${key} üçün Telegram Premium Emoji ID uğurla yeniləndi!`);
    renderCustomEmojisGrid();
  } catch (e) {
    showToast('error', 'Yadda saxlanılarkən xəta baş verdi.');
  }
}

async function clearSingleCustomEmoji(key, isCategory = false, categoryId = '') {
  const inp = document.getElementById(`emoji_inp_${key}`);
  if (inp) inp.value = '';
  await saveSingleCustomEmoji(key, isCategory, categoryId);
}

async function saveAllCustomEmojis() {
  const inputs = document.querySelectorAll('#customEmojisGrid input[data-key]');
  if (inputs.length === 0) return;

  const updates = {};
  const catUpdates = [];

  inputs.forEach(inp => {
    const key = inp.getAttribute('data-key');
    const val = (inp.value || '').trim();
    const isCat = inp.getAttribute('data-is-cat') === '1';
    const catId = inp.getAttribute('data-cat-id');

    updates[key] = { custom_emoji_id: val };
    if (isCat && catId) {
      catUpdates.push({ categoryId: catId, custom_emoji_id: val });
    }
  });

  try {
    await authFetch('/api/admin/custom-emojis', {
      method: 'POST',
      body: JSON.stringify({ emojis: updates })
    });

    for (const cu of catUpdates) {
      await authFetch(`/api/admin/api-categories/${cu.categoryId}/custom-emoji`, {
        method: 'POST',
        body: JSON.stringify({ custom_emoji_id: cu.custom_emoji_id })
      });
    }

    showToast('success', 'Bütün Telegram Premium Emojiləri uğurla yadda saxlanıldı!');
    loadCustomEmojisAdmin();
  } catch (e) {
    showToast('error', 'Yadda saxlanılarkən xəta baş verdi.');
  }
}

// Təhlükəsizlik Qapısı Yoxlanışı ilə Admin Panelini Başlat
async function initAdminApp() {
  const isAuth = await checkAdminAuth();
  if (isAuth) {
    await loadAllAdminData();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initAdminApp();
  });
} else {
  initAdminApp();
}

// Statistikaları hər 30 saniyədən bir avtomatik fonda yenilə
setInterval(() => {
  const token = getActiveAdminToken();
  if (token) {
    loadAllAdminData();
  }
}, 30000);

