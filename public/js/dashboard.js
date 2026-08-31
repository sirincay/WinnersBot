// =========================================================================
// WINNERS MÜƏSSİSƏ MÜŞTƏRİ VƏ TƏRTİBATÇI PORTAL İDARƏEDİCİSİ
// (c) Engineered by @HUSNUTECH (https://t.me/HusnuTech)
// =========================================================================

try {
  const cinemaLines = [
    "%c   |\\  |\\                                                              /|  /|   ",
    "%c   | \\ | \\  +-------------------------------------------------------+  / | / |   ",
    "%c   |  \\|  \\ |   *                                               *   | /  |/  |   ",
    "%c   |   |   \\|       _   _ _   _ ____  _   _ _   _               |/   |   |   ",
    "%c   |   |   ||      | | | | | | / ___|| \\ | | | | |              ||   |   |   ",
    "%c   |   |   ||      | |_| | | | \\___ \\|  \\| | | | |              ||   |   |   ",
    "%c   |   |   ||      |  _  | |_| |___) | |\\  | |_| |              ||   |   |   ",
    "%c   |   |   ||      |_| |_|\\___/|____/|_| \\_|\\___/               ||   |   |   ",
    "%c   |   |   ||                                                       ||   |   |   ",
    "%c   |   |   ||                    @ H U S N U T E C H                ||   |   |   ",
    "%c   |   |   ||                                                       ||   |   |   ",
    "%c   |   |   ||     SENIOR FULL-STACK & TELEGRAM BOT DEVELOPER        ||   |   |   ",
    "%c   |   |   ||                                                       ||   |   |   ",
    "%c   |   |   ||       Telegram: @HusnuTech  •  WhatsApp: +994 77 211 70 11  ||   |   |   ",
    "%c   |   |   ||   *                                               *   ||   |   |   ",
    "%c   |   |   |+-------------------------------------------------------+|   |   |   ",
    "%c   |  /|  /                                                           \\  |\\  |   ",
    "%c   | / | /  =========================================================  \\ | \\ |   ",
    "%c   |/  |/                                                               \\|  \\|   ",
    "%c          ( )   ( )   ( )      ( )   ( )   ( )      ( )   ( )   ( )            ",
    "%c         [===] [===] [===]    [===] [===] [===]    [===] [===] [===]           ",
    "%c         /| |\\ /| |\\ /| |\\    /| |\\ /| |\\ /| |\\    /| |\\ /| |\\ /| |\\           "
  ];

  console.log(
    cinemaLines.join('\n'),
    'color: #e11d48; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #f43f5e; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #ec4899; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #d946ef; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #c084fc; font-weight: 800; font-family: monospace; font-size: 11px;',
    'color: #a855f7; font-weight: 800; font-family: monospace; font-size: 11px;',
    'color: #9333ea; font-weight: 800; font-family: monospace; font-size: 11px;',
    'color: #7c3aed; font-weight: 800; font-family: monospace; font-size: 11px;',
    'color: #6366f1; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #38bdf8; font-weight: 900; font-family: monospace; font-size: 13px; text-shadow: 0 0 10px #38bdf8;',
    'color: #6366f1; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #a78bfa; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #818cf8; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #34d399; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #ec4899; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #f43f5e; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #e11d48; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #be123c; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #9f1239; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #64748b; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #475569; font-weight: bold; font-family: monospace; font-size: 11px;',
    'color: #334155; font-weight: bold; font-family: monospace; font-size: 11px;'
  );
} catch (_) {}

let currentUser = null;
let currentApiKey = '';
let ordersCache = [];

document.addEventListener('DOMContentLoaded', () => {
  initPortalSession();
});

// 1. Sessiya və Giriş Başlatma
function initPortalSession() {
  try {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
      currentUser = {
        telegram_id: tgUser.id.toString(),
        username: tgUser.username || '',
        first_name: tgUser.first_name || '',
        balance: 0
      };
      localStorage.setItem('winners_user_session', JSON.stringify(currentUser));
    } else {
      const saved = localStorage.getItem('winners_user_session');
      if (saved) {
        currentUser = JSON.parse(saved);
      }
    }
  } catch (e) {}

  if (!currentUser?.telegram_id) {
    document.getElementById('authGate').style.display = 'flex';
    document.getElementById('portalContainer').style.display = 'none';
  } else {
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('portalContainer').style.display = 'flex';
    renderUserData();
    loadDashboardData();
  }
}

async function handlePortalLogin(e) {
  e.preventDefault();
  const input = document.getElementById('loginIdentifier').value.trim();
  if (!input) return;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: input })
    });
    const data = await res.json();
    if (data.ok && data.user) {
      currentUser = data.user;
      localStorage.setItem('winners_user_session', JSON.stringify(currentUser));
      showToast('Signed in successfully!', 'success');
      initPortalSession();
    } else {
      showToast(data.error || 'User not found. Please check your Telegram ID.', 'error');
    }
  } catch (err) {
    showToast('Sign in error. Please try again.', 'error');
  }
}

function portalLogout() {
  currentUser = null;
  localStorage.removeItem('winners_user_session');
  window.location.href = '/';
}

function renderUserData() {
  if (!currentUser) return;
  const name = currentUser.first_name || currentUser.username || 'Customer';
  const initial = name.charAt(0).toUpperCase();

  document.getElementById('topbarUserName').innerText = name;
  document.getElementById('userAvatarChar').innerText = initial;
  document.getElementById('settingsTgId').innerText = currentUser.telegram_id;
  updateBalanceUI(currentUser.balance || 0);

  const isAdmin = currentUser.is_admin === 1 || currentUser.isAdmin === true;
  const adminNav = document.getElementById('adminNavSection');
  if (adminNav) {
    adminNav.style.display = isAdmin ? 'block' : 'none';
  }
}

function updateBalanceUI(balance) {
  const azn = parseFloat(balance || 0);
  const usd = (azn / 1.70).toFixed(2);
  const formatted = `$${usd} USD (${azn.toFixed(2)} ₼)`;
  document.getElementById('topbarBalance').innerText = `$${usd} USD`;
  document.getElementById('metricBalance').innerText = formatted;
}

function getDashboardAuthHeaders() {
  const token = currentUser?.token || '';
  return {
    'Authorization': 'Bearer ' + token,
    'x-user-token': token
  };
}

// 2. Panel İcmalını, Sifarişləri və API-ni Yüklə
async function loadDashboardData() {
  if (!currentUser?.telegram_id) return;

  // Profili serverdən yenilə
  fetch('/api/auth/me', {
    headers: getDashboardAuthHeaders()
  }).then(r => r.json()).then(data => {
    if (data.ok && data.user) {
      currentUser = { ...currentUser, ...data.user };
      localStorage.setItem('winners_user_session', JSON.stringify(currentUser));
      renderUserData();
    }
  }).catch(() => {});

  await Promise.all([
    loadUserOrders(),
    loadUserApiKey()
  ]);
}

// 3. Tab Keçidi
function switchPortalTab(tabKey) {
  // Yan panel naviqasiya düymələrini yenilə
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.classList.remove('active');
  });

  // Tabları yenilə
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const headings = {
    overview: 'Overview & Dashboard',
    orders: 'My Orders & E-Pin Codes',
    api: 'REST API & Key Management',
    deposit: 'Deposit Balance',
    settings: 'Account Settings & Security'
  };

  const targetPane = document.getElementById(`tab${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`);
  if (targetPane) {
    targetPane.classList.add('active');
  }

  const headingEl = document.getElementById('pageHeading');
  if (headingEl && headings[tabKey]) {
    headingEl.innerText = headings[tabKey];
  }

  // Açıqdırsa mobil yan paneli bağla
  document.getElementById('portalSidebar')?.classList.remove('open');
  document.getElementById('sidebarBackdrop')?.classList.remove('open');

  if (tabKey === 'orders') {
    loadUserOrders();
  } else if (tabKey === 'api') {
    loadUserApiKey();
  }
}

function toggleMobileSidebar() {
  document.getElementById('portalSidebar')?.classList.toggle('open');
  document.getElementById('sidebarBackdrop')?.classList.toggle('open');
}

// 4. Sifarişlər və E-Pin Gətirmə
async function loadUserOrders() {
  if (!currentUser?.telegram_id) return;
  const tbody = document.getElementById('ordersTableBody');
  const recentTbody = document.getElementById('overviewRecentOrdersBody');

  try {
    const res = await fetch('/api/orders/history', {
      headers: getDashboardAuthHeaders()
    });
    const data = await res.json();

    if (data.ok && data.orders) {
      ordersCache = data.orders;

      // Metrikləri yenilə
      document.getElementById('metricTotalOrders').innerText = ordersCache.length;
      const totalSpentAzn = ordersCache.reduce((sum, o) => sum + (parseFloat(o.price_azn) || 0), 0);
      const totalSpentUsd = (totalSpentAzn / 1.70).toFixed(2);
      document.getElementById('metricTotalSpent').innerText = `$${totalSpentUsd} USD`;

      const recentCards = document.getElementById('overviewRecentOrdersCards');
      const allCards = document.getElementById('ordersCardsList');

      // 1. İcmalda Son Sifarişləri Göstər (Desktop & Mobil)
      if (recentTbody) {
        if (ordersCache.length === 0) {
          recentTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No purchase history yet.</td></tr>';
          if (recentCards) recentCards.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 24px;">No purchase history yet.</div>';
        } else {
          recentTbody.innerHTML = ordersCache.slice(0, 5).map(o => `
            <tr>
              <td><strong>${escapeHtml(o.category_name || 'Product')} — ${escapeHtml(o.offer_name || '')}</strong></td>
              <td><code style="font-family: var(--font-mono); color: #94a3b8;">${escapeHtml(o.player_id || o.order_id || 'Automated')}</code></td>
              <td><strong style="color: #4ade80; font-family: var(--font-mono);">$${((parseFloat(o.price_azn || 0))/1.70).toFixed(2)} USD</strong></td>
              <td style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(o.created_at || '')}</td>
              <td>
                <span class="status-pill ${o.status === 'completed' ? 'status-completed' : (o.status === 'failed' ? 'status-failed' : 'status-pending')}">
                  ${o.status === 'completed' ? 'Completed' : (o.status === 'failed' ? 'Failed' : 'Pending')}
                </span>
              </td>
            </tr>
          `).join('');

          if (recentCards) {
            recentCards.innerHTML = ordersCache.slice(0, 5).map(renderOrderMobileCard).join('');
          }
        }
      }

      // 2. Tam Sifarişlər Cədvəlini Göstər (Desktop & Mobil)
      if (tbody) {
        if (ordersCache.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 36px;">No orders found yet. Browse our store to purchase games and digital vouchers.</td></tr>';
          if (allCards) allCards.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 32px;">No orders found yet. Browse our store to purchase games and digital vouchers.</div>';
        } else {
          tbody.innerHTML = ordersCache.map(o => {
            const hasCode = o.pin_code || o.delivered_code;
            const codeVal = o.pin_code || o.delivered_code || '';
            const statusClass = o.status === 'completed' ? 'status-completed' : (o.status === 'failed' ? 'status-failed' : 'status-pending');
            const statusText = o.status === 'completed' ? 'Completed' : (o.status === 'failed' ? 'Failed' : 'Pending');
            const priceUsd = ((parseFloat(o.price_azn || 0)) / 1.70).toFixed(2);

            return `
              <tr>
                <td><code style="font-family: var(--font-mono); font-size: 12px; color: #94a3b8;">#${escapeHtml(o.order_id || String(o.id))}</code></td>
                <td>
                  <strong style="color: #fff;">${escapeHtml(o.category_name || 'Game')}</strong><br>
                  <small style="color: var(--brand-cyan);">${escapeHtml(o.offer_name || '')}</small>
                </td>
                <td><code style="font-family: var(--font-mono); color: #cbd5e1;">${escapeHtml(o.player_id || 'Digital Voucher')}</code></td>
                <td>
                  ${hasCode ? `
                    <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(10, 15, 29, 0.9); border: 1px solid rgba(56, 189, 248, 0.3); padding: 4px 8px; border-radius: 6px;">
                      <code style="font-family: var(--font-mono); color: #38bdf8; font-weight: 700; font-size: 12px;">${escapeHtml(codeVal)}</code>
                      <button class="btn-micro" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 6px;" onclick="copyToClipboard('${escapeHtml(codeVal)}', 'Voucher Code')">Copy</button>
                    </div>
                  ` : `<span style="color: var(--text-muted); font-size: 12px;">Direct In-Game ID Delivery</span>`}
                </td>
                <td><strong style="color: #4ade80; font-family: var(--font-mono);">$${priceUsd} USD</strong></td>
                <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                <td style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(o.created_at || '')}</td>
              </tr>
            `;
          }).join('');

          if (allCards) {
            allCards.innerHTML = ordersCache.map(renderOrderMobileCard).join('');
          }
        }
      }

    }
  } catch (e) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #f87171; padding: 24px;">Failed to load orders.</td></tr>';
  }
}

// Mobil Kart Generatoru (Sürüşdürməsiz Rahat Görünüş)
function renderOrderMobileCard(o) {
  const hasCode = o.pin_code || o.delivered_code;
  const codeVal = o.pin_code || o.delivered_code || '';
  const statusClass = o.status === 'completed' ? 'status-completed' : (o.status === 'failed' ? 'status-failed' : 'status-pending');
  const statusText = o.status === 'completed' ? 'Completed' : (o.status === 'failed' ? 'Failed' : 'Pending');
  const priceUsd = ((parseFloat(o.price_azn || 0)) / 1.70).toFixed(2);
  const orderIdDisplay = escapeHtml(o.order_id || String(o.id));

  return `
    <div class="dash-order-card">
      <div class="dash-order-card-header">
        <div class="dash-order-game-info">
          <div class="dash-order-game-title">${escapeHtml(o.category_name || 'Game')}</div>
          <div class="dash-order-package-sub">${escapeHtml(o.offer_name || '')}</div>
        </div>
        <span class="status-pill ${statusClass}">${statusText}</span>
      </div>

      <div class="dash-order-card-body">
        <div class="dash-order-meta-grid">
          <div class="dash-order-meta-item">
            <span class="dash-meta-label">Player ID</span>
            <span class="dash-meta-val">${escapeHtml(o.player_id || 'Digital Delivery')}</span>
          </div>
          <div class="dash-order-meta-item">
            <span class="dash-meta-label">Order ID</span>
            <span class="dash-meta-val">#${orderIdDisplay}</span>
          </div>
          <div class="dash-order-meta-item">
            <span class="dash-meta-label">Amount</span>
            <span class="dash-meta-val" style="color: #4ade80; font-weight: 800;">$${priceUsd} USD</span>
          </div>
          <div class="dash-order-meta-item">
            <span class="dash-meta-label">Date</span>
            <span class="dash-meta-val" style="color: var(--text-muted); font-size: 11px;">${escapeHtml(o.created_at || '')}</span>
          </div>
        </div>

        ${hasCode ? `
          <div class="dash-order-code-box">
            <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
              <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Delivered E-Pin Code</span>
              <code class="dash-order-code-text">${escapeHtml(codeVal)}</code>
            </div>
            <button class="btn-micro" style="background: #38bdf8; color: #0b0f19; font-weight: 700; padding: 5px 10px;" onclick="copyToClipboard('${escapeHtml(codeVal)}', 'Voucher Code')">
              Copy
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// 5. REST API Açar İdarəetməsi (Telegram Bot ilə 100% Sinxron)
async function loadUserApiKey() {
  if (!currentUser?.telegram_id) return;
  const inputEl = document.getElementById('apiKeyValue');
  const snippetEl = document.getElementById('apiSnippetKey');

  try {
    const res = await fetch('/api/user/api-key', {
      headers: getDashboardAuthHeaders()
    });
    const data = await res.json();

    if (data.ok && data.apiKey) {
      currentApiKey = data.apiKey;
      if (inputEl) inputEl.value = data.apiKey;
      if (snippetEl) snippetEl.innerText = data.apiKey;
      document.getElementById('apiStatsOrders').innerText = data.total_orders || 0;
      const spentUsd = ((parseFloat(data.total_spent_azn || 0)) / 1.70).toFixed(2);
      document.getElementById('apiStatsSpent').innerText = `$${spentUsd} USD (${parseFloat(data.total_spent_azn || 0).toFixed(2)} ₼)`;
    }
  } catch (e) {
    if (inputEl) inputEl.value = 'Failed to load key';
  }
}

function toggleApiKeyMask() {
  const inputEl = document.getElementById('apiKeyValue');
  if (!inputEl) return;
  if (inputEl.classList.contains('masked')) {
    inputEl.classList.remove('masked');
    inputEl.classList.add('unmasked');
  } else {
    inputEl.classList.remove('unmasked');
    inputEl.classList.add('masked');
  }
}

function copyApiKey() {
  if (!currentApiKey) return;
  copyToClipboard(currentApiKey, 'API Key');
}

async function regenerateUserApiKey() {
  if (!currentUser?.telegram_id) return;
  
  showToast('Generating and syncing new API Key...', 'info');

  try {
    const res = await fetch('/api/user/api-key/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getDashboardAuthHeaders() },
    });
    const data = await res.json();
    if (data.ok && data.apiKey) {
      currentApiKey = data.apiKey;
      showToast('🎉 New API Key generated and synced with your Telegram bot!', 'success');
      loadUserApiKey();
    } else {
      showToast(data.error || 'Error generating API key.', 'error');
    }
  } catch (e) {
    showToast('Server connection error. Please try again.', 'error');
  }
}

// 6. Binance Pay Ani Depozit İdarəedicisi (Brauzer xəbərdarlığı olmadan)
async function handleBinanceDeposit(e) {
  e.preventDefault();
  if (!currentUser?.telegram_id) return;
  const orderId = document.getElementById('binanceOrderId').value.trim();
  if (!orderId) {
    showToast('Please enter your Binance Order ID.', 'error');
    return;
  }

  showToast('⏳ Verifying Binance Pay deposit in real-time...', 'info');

  try {
    const res = await fetch('/api/payments/binance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: currentUser.telegram_id,
        order_id: orderId
      })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('🎉 Deposit verified successfully! Your balance has been updated.', 'success', 5000);
      document.getElementById('binanceOrderId').value = '';
      loadDashboardData();
    } else {
      // Təmiz, peşəkar xəta formatlaması
      let rawErr = data.error || '';
      let formattedErr = '⚠️ Payment verification failed. Please verify your Binance Order ID.';
      if (rawErr.includes('tapılmadı') || rawErr.includes('hələ sistemə düşməyib') || rawErr.includes('not found')) {
        formattedErr = '⚠️ This Order ID was not found in your Binance Pay history. Please check the ID or retry in 1 minute.';
      } else if (rawErr.includes('artıq sistemdə istifadə edilib') || rawErr.includes('already used')) {
        formattedErr = '⚠️ This Order ID has already been credited to an account.';
      } else if (rawErr.includes('Yanlış') || rawErr.includes('format')) {
        formattedErr = '⚠️ Invalid Order ID format. Please enter a valid Binance Order ID (numeric).';
      } else if (rawErr) {
        formattedErr = `⚠️ ${rawErr}`;
      }
      showToast(formattedErr, 'error', 6000);
    }
  } catch (err) {
    showToast('⚠️ Network or verification error. Please try again.', 'error');
  }
}

// 7. Köməkçi Funksiyalar
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function copyToClipboard(text, label = 'Data') {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} copied to clipboard!`, 'success');
    }).catch(() => {
      fallbackCopy(text, label);
    });
  } else {
    fallbackCopy(text, label);
  }
}

function fallbackCopy(text, label) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(`${label} copied to clipboard!`, 'success');
}

// Ekran Üzrə Bildiriş Sistemi (Sıfır Brauzer Xəbərdarlığı)
function showToast(message, type = 'info', duration = 4500) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-box toast-${type}`;

  let iconSvg = '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  if (type === 'success') {
    iconSvg = '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">${escapeHtml(message)}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
