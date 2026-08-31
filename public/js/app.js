// ==========================================================================
// WINNERS QLOBAL GEYMİNQ — MÜŞTƏRİ TƏTBİQ İDARƏEDİCİSİ (i18n və ÇOXVALYUTALı)
// USD Standartı və AZN Dəstəyi ilə Yüksək Səviyyəli İnteraktiv Oyun Ticarəti Platforması
// ==========================================================================

const tg = window.Telegram?.WebApp;
if (tg && typeof tg.expand === 'function') {
  try { tg.expand(); } catch (e) { }
}

// İstifadəçi vəziyyəti (null = qonaq, object = daxil olub)
let currentUser = null;
let systemSettings = { usd_azn_rate: 1.70, margin_percent: 10, bot_username: 'WS_StoreBot' };
let currentAuthCode = null;
let authPollInterval = null;
let currentLanguage = localStorage.getItem('winners_web_lang') || 'en';

// Məzənnə köməkçisi
function getExchangeRate() {
  return parseFloat(systemSettings.usd_azn_rate) || 1.70;
}

// Valyuta formatlaşdırıcıları
function formatPrice(priceUsd) {
  const usd = parseFloat(priceUsd) || 0;
  if (currentLanguage === 'az') {
    const rate = getExchangeRate();
    const azn = usd * rate;
    return `${azn.toFixed(2)} ₼`;
  }
  return `$${usd.toFixed(2)}`;
}

function formatBalance(balanceAzn) {
  const azn = parseFloat(balanceAzn) || 0;
  if (currentLanguage === 'az') {
    return `${azn.toFixed(2)} AZN`;
  }
  const rate = getExchangeRate();
  const usd = azn / rate;
  return `$${usd.toFixed(2)} USD`;
}

function updateBalanceDisplay() {
  const el = document.getElementById('userBalanceDisplay');
  if (el && currentUser) {
    el.innerText = formatBalance(currentUser.balance);
  }
}

// Tam Veb Tətbiq Çoxdilli Lüğətləri
const WEB_I18N = {
  en: {
    docTitle: 'Winners Shop — Official Digital Gaming & Currency Store',
    topBarNetwork: 'Official Gaming Network: Active (Ping: 24ms • Uptime: 99.99%)',
    topBarTag: 'Global Distributor • 100% Automated Delivery',
    navCatalog: 'Catalog',
    navLogin: 'Login',
    navRegister: 'Register',
    navDeposit: 'Deposit',
    navLogout: 'Sign Out',
    navProfile: 'My Profile',
    heroBadge: '<svg class="pro-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> OFFICIAL WINNERS SHOP • 3 SECONDS DELIVERY',
    heroTitle: 'Level Up Your Game Instantly',
    heroTitleBold: 'UC, Diamonds, Robux & Steam Cards – All In One Place.',
    heroDesc: 'Get PUBG Mobile UC, Free Fire Diamonds, Roblox Robux, Mobile Legends and Steam Wallet at the best global rates with 100% official guarantee.',
    heroBtnExplore: 'Explore Games ↗',
    heroBtnDeposit: 'Deposit Balance',
    specDelivery: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span> Delivery: <strong>3s Automated</strong>',
    specSecurity: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></span> Security: <strong>100% Guaranteed</strong>',
    specPayment: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg></span> Payment: <strong>Binance, Cards, Crypto</strong>',
    specRating: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span> Reviews: <strong>4.9/5 (12,500+)</strong>',
    tabAll: 'All Games',
    tabTelegram: 'Telegram Services',
    searchPlaceholder: 'Search game, product or gift card...',
    cardPriceLabel: 'Price',
    cardOrderBtn: 'Order Now ↗',
    cardTagGiftcard: 'GIFT CARD',
    cardTagTopup: 'TOP-UP',
    cardBadgeAuto: '⚡ Instant 3s',
    cardBadgeGift: '🎟️ Redeem Code',
    tableTitle: 'Recent Transactions & Orders Log',
    tableRefresh: 'Refresh',
    thOrderId: 'Order ID',
    thProduct: 'Product',
    thAccount: 'Player ID / Account',
    thAmount: 'Amount',
    thStatus: 'Status',
    thDate: 'Date',
    orderModalTitle: 'Order Checkout',
    lblSelectPackage: '1. Select Package:',
    lblPlayerId: '2. Player ID:',
    playerIdPlaceholder: 'E.g. 51382453664',
    playerIdHint: 'Make sure the Player ID is correct. The item will be loaded directly to this account.',
    lblSummaryOffer: 'Selected Package:',
    lblSummaryBalance: 'Current Account Balance:',
    lblSummaryTotal: 'Total Amount:',
    btnBuyBalance: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Buy with Balance (3s Instant)',
    btnBuyTelegram: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Order via Telegram Bot (<span class="dynamic-bot-tag">@Bot</span>) ↗',
    depositModalTitle: 'Deposit Account Balance',
    tabPayBinance: 'Binance Pay (Crypto 0% Fee)',
    tabPayM10: 'M10 Transfer',
    tabPayCard: 'Bank Card',
    lblBinanceId: 'Binance Pay ID (Click to copy):',
    lblBinanceOrder: 'Binance Order ID / TxID:',
    lblBinanceHint: 'After completing payment in the Binance App, enter your Order ID here (verified in 1 second).',
    btnVerifyBinance: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Verify Payment & Deposit',
    btnCopy: 'Copy',
    profileTitle: 'Personal Dashboard',
    lblProfBal: 'Current Account Balance',
    btnProfDeposit: 'Deposit Balance',
    tabFeatures: 'Features',
    tabOrders: 'My Orders',
    tabSettings: 'Settings',
    btnAdmin: 'Admin Dashboard ↗',
    btnLogout: 'Sign Out',
    toastLoginReq: '🔒 Please sign in to place an order or view your balance.',
    toastOrderSuccess: '🎉 Order completed successfully in 3 seconds!',
    toastOrderForwarding: '⏳ Your request is being accepted and forwarded to the Winners Store operator, please wait...',
    toastBalanceLow: '⚠️ Insufficient balance! Please deposit to continue.',
  },
  az: {
    docTitle: 'Winners Shop — Rəsmi Rəqəmsal Oyun və Valyuta Dağıtım Platforması',
    topBarNetwork: 'Rəsmi Oyun Şəbəkəsi: Aktiv (Ping: 24ms • Uptime: 99.99%)',
    topBarTag: 'Məzənnə: 1 USD = 1.70 AZN | Rəsmi Distribütorluq',
    navCatalog: 'Kataloq',
    navLogin: 'Daxil Ol',
    navRegister: 'Qeydiyyat',
    navDeposit: 'Balans Artır',
    navLogout: 'Çıxış',
    navProfile: 'Profilim',
    heroBadge: '<svg class="pro-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> RƏSMİ WINNERS SHOP • 3 SANİYƏYƏ TƏHVİL',
    heroTitle: 'Oyun balansını doldurmaq üçün uzağa getmə',
    heroTitleBold: 'UC, VP, Robux və Steam kartları – nə lazımdırsa, hamısı var.',
    heroDesc: 'PUBG Mobile UC, Free Fire Almazları, Roblox Robux, Mobile Legends və Steam Cüzdan kartlarını ən sərfəli qiymətlərlə, 100% rəsmi zəmanətlə əldə edin.',
    heroBtnExplore: 'Oyunları Kəşf Et ↗',
    heroBtnDeposit: 'Balans Artır',
    specDelivery: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span> Təhvil: <strong>3 Saniyə Avtomatik</strong>',
    specSecurity: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></span> Təhlükəsizlik: <strong>100% Zəmanətli</strong>',
    specPayment: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg></span> Ödəniş: <strong>Binance, M10, Kart</strong>',
    specRating: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span> Müştəri Rəyi: <strong>4.9/5 (12,500+)</strong>',
    tabAll: 'Bütün Oyunlar',
    tabTelegram: 'Telegram Xidmətləri',
    searchPlaceholder: 'Oyun və ya xidmət axtar...',
    cardPriceLabel: 'Qiymət',
    cardOrderBtn: 'Sifariş Et ↗',
    cardTagGiftcard: 'HƏDİYYƏ KARTI',
    cardTagTopup: 'TOP-UP',
    cardBadgeAuto: '⚡ Ani Yükləmə',
    cardBadgeGift: '🎟️ Kod / Pin',
    tableTitle: 'Son Əməliyyatlar və Sifariş Jurnalı',
    tableRefresh: 'Yenilə',
    thOrderId: 'Sifariş ID',
    thProduct: 'Məhsul',
    thAccount: 'Oyunçu / Hesab',
    thAmount: 'Məbləğ',
    thStatus: 'Status',
    thDate: 'Tarix',
    orderModalTitle: 'Sifarişin Rəsmiləşdirilməsi',
    lblSelectPackage: '1. Paketi Seçin:',
    lblPlayerId: '2. Oyunçu ID-si (Player ID):',
    playerIdPlaceholder: 'Məsələn: 51382453664',
    playerIdHint: 'ID məlumatının düzgünlüyünə əmin olun. Məhsul birbaşa bu oyunçu ID-sinə yüklənəcəkdir.',
    lblSummaryOffer: 'Seçilən Paket:',
    lblSummaryBalance: 'Cari Hesab Balansı:',
    lblSummaryTotal: 'Yekun Məbləğ:',
    btnBuyBalance: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Sayt Balansı ilə Al (3 Saniyə)',
    btnBuyTelegram: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Telegram Botumuz ilə Sifariş Et (<span class="dynamic-bot-tag">@Bot</span>) ↗',
    depositModalTitle: 'Hesab Balansının Artırılması',
    tabPayBinance: 'Binance Pay (Kripto 0% Komissiya)',
    tabPayM10: 'M10 Köçürmə',
    tabPayCard: 'Bank Kartı',
    lblBinanceId: 'Binance Pay ID (Klikləyib Kopyalayın):',
    lblBinanceOrder: 'Binance Sifariş ID-si (Order ID):',
    lblBinanceHint: 'Binance tətbiqində ödənişi bitirdikdən sonra Order ID nömrəsini daxil edin (1 saniyəyə avtomatik artır).',
    btnVerifyBinance: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Ödənişi Yoxla və Balansı Artır',
    btnCopy: 'Kopyala',
    profileTitle: 'Şəxsi İstifadəçi Kabineti',
    lblProfBal: 'Cari Hesab Balansı',
    btnProfDeposit: 'Balans Artır',
    tabFeatures: 'Gələcək Özəlliklər',
    tabOrders: 'Sifarişlərim',
    tabSettings: 'Tənzimləmələr',
    btnAdmin: 'İdarəetmə Paneli (Admin) ↗',
    btnLogout: 'Hesabdan Çıxış Et',
    toastLoginReq: '🔒 Sifariş vermək üçün əvvəlcə daxil olun və ya qeydiyyatdan keçin!',
    toastOrderSuccess: '🎉 Sifariş uğurla tamamlandı və təhvil verildi!',
    toastOrderForwarding: '⏳ Sorğunuz qəbul edilir və Winners Store operatoruna yönləndirilir, zəhmət olmasa gözləyin...',
    toastBalanceLow: '⚠️ Balansınız kifayət etmir! Zəhmət olmasa əvvəlcə balansınızı artırın.',
  },
  ru: {
    docTitle: 'Winners Shop — Официальный магазин игровых валют и доната',
    topBarNetwork: 'Официальная игровая сеть: Активна (Ping: 24ms • Uptime: 99.99%)',
    topBarTag: 'Глобальный дистрибьютор • Автодоставка за 3 секунды',
    navCatalog: 'Каталог',
    navLogin: 'Войти',
    navRegister: 'Регистрация',
    navDeposit: 'Пополнить',
    navLogout: 'Выйти',
    navProfile: 'Мой профиль',
    heroBadge: '<svg class="pro-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> ОФИЦИАЛЬНЫЙ WINNERS SHOP • ДОСТАВКА 3 СЕК',
    heroTitle: 'Мгновенное пополнение игрового баланса',
    heroTitleBold: 'UC, Алмазы, Робуксы и Карты Steam – Все в одном месте.',
    heroDesc: 'Покупайте PUBG Mobile UC, Free Fire, Roblox Robux, Mobile Legends и Steam Wallet по лучшим мировым ценам со 100% официальной гарантией.',
    heroBtnExplore: 'В каталог ↗',
    heroBtnDeposit: 'Пополнить баланс',
    specDelivery: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span> Доставка: <strong>3 сек Авто</strong>',
    specSecurity: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></span> Гарантия: <strong>100% Официально</strong>',
    specPayment: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg></span> Оплата: <strong>Binance, Карты, Крипта</strong>',
    specRating: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span> Отзывы: <strong>4.9/5 (12,500+)</strong>',
    tabAll: 'Все игры',
    tabTelegram: 'Telegram Сервисы',
    searchPlaceholder: 'Поиск игры или услуги...',
    cardPriceLabel: 'Цена',
    cardOrderBtn: 'Купить ↗',
    cardTagGiftcard: 'КАРТА ПОПОЛНЕНИЯ',
    cardTagTopup: 'ПРЯМОЙ ДОНАТ',
    cardBadgeAuto: '⚡ Авто 3 сек',
    cardBadgeGift: '🎟️ Цифровой код',
    tableTitle: 'История операций и заказов',
    tableRefresh: 'Обновить',
    thOrderId: 'ID Заказа',
    thProduct: 'Товар',
    thAccount: 'Игрок / ID',
    thAmount: 'Сумма',
    thStatus: 'Статус',
    thDate: 'Дата',
    orderModalTitle: 'Оформление заказа',
    lblSelectPackage: '1. Выберите пакет:',
    lblPlayerId: '2. ID Игрока (Player ID):',
    playerIdPlaceholder: 'Например: 51382453664',
    playerIdHint: 'Убедитесь в правильности ID игрока. Товар зачисляется напрямую на аккаунт.',
    lblSummaryOffer: 'Выбранный пакет:',
    lblSummaryBalance: 'Баланс счета:',
    lblSummaryTotal: 'Итого к оплате:',
    btnBuyBalance: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Купить с баланса (3 сек)',
    btnBuyTelegram: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Заказать через Telegram Бота (<span class="dynamic-bot-tag">@Bot</span>) ↗',
    depositModalTitle: 'Пополнение баланса аккаунта',
    tabPayBinance: 'Binance Pay (Криптовалюта 0% Комиссия)',
    tabPayM10: 'M10 Перевод',
    tabPayCard: 'Банковская карта',
    lblBinanceId: 'Binance Pay ID (Нажмите для копирования):',
    lblBinanceOrder: 'Binance Номер заказа / TxID:',
    lblBinanceHint: 'После оплаты в приложении Binance введите Order ID сюда (зачисление 1 сек).',
    btnVerifyBinance: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Проверить и пополнить',
    btnCopy: 'Копировать',
    profileTitle: 'Личный кабинет пользователя',
    lblProfBal: 'Текущий баланс счета',
    btnProfDeposit: 'Пополнить баланс',
    tabFeatures: 'Возможности',
    tabOrders: 'Мои заказы',
    tabSettings: 'Настройки',
    btnAdmin: 'Панель администратора ↗',
    btnLogout: 'Выйти из аккаунта',
    toastLoginReq: '🔒 Войдите в аккаунт для оформления заказа!',
    toastOrderSuccess: '🎉 Заказ успешно выполнен и доставлен за 3 секунды!',
    toastOrderForwarding: '⏳ Ваш запрос принимается и направляется оператору Winners Store, пожалуйста, подождите...',
    toastBalanceLow: '⚠️ Недостаточно средств на балансе. Пополните баланс.',
  },
  tr: {
    docTitle: 'Winners Shop — Resmi Dijital Oyun ve Bakiye Mağazası',
    topBarNetwork: 'Resmi Oyun Ağı: Aktif (Ping: 24ms • Uptime: 99.99%)',
    topBarTag: 'Global Distribütörlük • 3 Saniyede Otomatik Teslimat',
    navCatalog: 'Katalog',
    navLogin: 'Giriş Yap',
    navRegister: 'Kayıt Ol',
    navDeposit: 'Bakiye Yükle',
    navLogout: 'Çıkış Yap',
    navProfile: 'Profilim',
    heroBadge: '<svg class="pro-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> RESMİ WINNERS SHOP • 3 SANİYEDE TESLİMAT',
    heroTitle: 'Oyun Bakiyeni Anında Doldur',
    heroTitleBold: 'UC, Elmas, Robux ve Steam Kartları – Hepsi Tek Adreste.',
    heroDesc: 'PUBG Mobile UC, Free Fire Elmas, Roblox Robux, Mobile Legends ve Steam Cüzdan kodlarını en uygun fiyatlarla %100 resmi garantili satın alın.',
    heroBtnExplore: 'Oyunları Keşfet ↗',
    heroBtnDeposit: 'Bakiye Yükle',
    specDelivery: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span> Teslimat: <strong>3sn Otomatik</strong>',
    specSecurity: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></span> Güvenlik: <strong>%100 Garantili</strong>',
    specPayment: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg></span> Ödeme: <strong>Binance, Kart, Kripto</strong>',
    specRating: '<span class="spec-icon"><svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span> Puan: <strong>4.9/5 (12,500+)</strong>',
    tabAll: 'Tüm Oyunlar',
    tabTelegram: 'Telegram Servisleri',
    searchPlaceholder: 'Oyun veya ürün ara...',
    cardPriceLabel: 'Fiyat',
    cardOrderBtn: 'Satın Al ↗',
    cardTagGiftcard: 'HEDİYE KARTI',
    cardTagTopup: 'DİREKT YÜKLEME',
    cardBadgeAuto: '⚡ Anında 3sn',
    cardBadgeGift: '🎟️ Dijital Kod',
    tableTitle: 'Son İşlemler ve Sipariş Geçmişi',
    tableRefresh: 'Yenile',
    thOrderId: 'Sipariş No',
    thProduct: 'Ürün',
    thAccount: 'Oyuncu / Hesap',
    thAmount: 'Tutar',
    thStatus: 'Durum',
    thDate: 'Tarih',
    orderModalTitle: 'Sipariş Onayı',
    lblSelectPackage: '1. Paketi Seçin:',
    lblPlayerId: '2. Oyuncu ID\'si (Player ID):',
    playerIdPlaceholder: 'Örn: 51382453664',
    playerIdHint: 'Oyuncu ID numaranızın doğruluğundan emin olun. Ürün direkt hesabınıza yüklenecektir.',
    lblSummaryOffer: 'Seçilen Paket:',
    lblSummaryBalance: 'Mevcut Bakiye:',
    lblSummaryTotal: 'Toplam Tutar:',
    btnBuyBalance: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Bakiye ile Satın Al (3 Saniye)',
    btnBuyTelegram: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Telegram Botu ile Al (<span class="dynamic-bot-tag">@Bot</span>) ↗',
    depositModalTitle: 'Hesap Bakiyesi Yükleme',
    tabPayBinance: 'Binance Pay (Kripto %0 Komisyon)',
    tabPayM10: 'M10 Transferi',
    tabPayCard: 'Banka Kartı',
    lblBinanceId: 'Binance Pay ID (Kopyalamak için tıklayın):',
    lblBinanceOrder: 'Binance Sipariş ID / TxID:',
    lblBinanceHint: 'Binance uygulamasından ödemeyi tamamladıktan sonra Order ID numarasını buraya girin (1 saniyede yüklenir).',
    btnVerifyBinance: '<svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Ödemeyi Doğrula ve Yükle',
    btnCopy: 'Kopyala',
    profileTitle: 'Kullanıcı Kontrol Paneli',
    lblProfBal: 'Mevcut Hesap Bakiyesi',
    btnProfDeposit: 'Bakiye Yükle',
    tabFeatures: 'Özellikler',
    tabOrders: 'Siparişlerim',
    tabSettings: 'Ayarlar',
    btnAdmin: 'Yönetim Paneli ↗',
    btnLogout: 'Çıkış Yap',
    toastLoginReq: '🔒 Sipariş vermek için lütfen giriş yapın!',
    toastOrderSuccess: '🎉 Siparişiniz 3 saniye içinde başarıyla teslim edildi!',
    toastOrderForwarding: '⏳ Talebiniz alınıyor ve Winners Store operatörüne iletiliyor, lütfen bekleyin...',
    toastBalanceLow: '⚠️ Yetersiz bakiye! Lütfen bakiye yükleyin.',
  }
};

// Kataloq Meta konfiqurasiyası
const PRODUCT_CATALOG_META = {
  pubg_mobile_auto: {
    cover: '/images/pubg_real.jpg',
    tag: 'Tencent Games',
    subtitle: {
      en: 'Direct Player ID instant automated Top-Up',
      az: 'Birbaşa Oyunçu ID-sinə 3 saniyəyə avtomatik yükləmə',
      ru: 'Мгновенное пополнение по ID игрока',
      tr: 'Direkt Oyuncu ID otomatik anında yükleme'
    },
    baseUsd: 0.89
  },
  pubg_mobile_epin: {
    cover: '/images/pubg_real.jpg',
    tag: 'Midasbuy / Global E-Pin',
    subtitle: {
      en: 'Official 1-Year Stockable Redeem Voucher Codes',
      az: 'Rəsmi E-Pin / Vauçer aktivasiya kodları (1 İl Saxlanıla bilən)',
      ru: 'Официальные промокоды E-Pin для активации',
      tr: 'Resmi 1 Yıl Stoklanabilir E-Pin Kodları'
    },
    baseUsd: 0.89
  },
  pubg_mobile_web: {
    cover: '/images/pubg_real.jpg',
    tag: 'Web Direct Top-Up',
    subtitle: {
      en: 'Web Direct Top-Up with extra bonus UC',
      az: 'Əlavə bonus UC ilə Veb Direct ID Yükləməsi',
      ru: 'Веб-пополнение с бонусными UC',
      tr: 'Bonus UC hediyeli Web Direct ID Yükleme'
    },
    baseUsd: 0.89
  },
  free_fire_cis: {
    cover: '/images/freefire_real.jpg',
    tag: 'Garena',
    subtitle: {
      en: 'Instant Diamonds Top-Up via Player ID',
      az: 'Oyunçu ID ilə dərhal Almaz yüklənməsi',
      ru: 'Пополнение алмазов по ID игрока',
      tr: 'Oyuncu ID ile anında Elmas yükleme'
    },
    baseUsd: 0.99
  },
  mobile_legends_direct: {
    cover: '/images/mobilelegends_real.jpg',
    tag: 'Moonton',
    subtitle: {
      en: 'Diamonds & Weekly Diamond Pass Top-Up',
      az: 'Almazlar və Həftəlik Almaz Pass Yükləməsi',
      ru: 'Алмазы и Еженедельный Пропуск',
      tr: 'Elmas ve Haftalık Elmas Geçişi Yükleme'
    },
    baseUsd: 0.99
  },
  valorant_tr: {
    cover: '/images/winnerslogo.jpg',
    tag: 'Riot Games',
    subtitle: {
      en: 'Valorant Points (VP) Digital Voucher Codes',
      az: 'Valorant Points (VP) Rəqəmsal Kodları',
      ru: 'Цифровые коды Valorant Points (VP)',
      tr: 'Valorant Points (VP) Dijital Kodları'
    },
    baseUsd: 1.99
  },
  brawl_stars_turkey: {
    cover: '/images/brawlstars_real.jpg',
    tag: 'Supercell',
    subtitle: {
      en: 'Brawl Stars Gems & Brawl Pass',
      az: 'Brawl Stars Daşlar və Brawl Pass',
      ru: 'Гемы Brawl Stars и Brawl Pass',
      tr: 'Brawl Stars Taşlar ve Brawl Pass'
    },
    baseUsd: 1.99
  },
  roblox_global: {
    cover: '/images/roblox_real.jpg',
    tag: 'Roblox Corp',
    subtitle: {
      en: 'Robux Gift Card & Digital Voucher Codes',
      az: 'Robux Hədiyyə Kartı və Rəqəmsal Kodlar',
      ru: 'Подарочные карты Robux и коды',
      tr: 'Robux Hediye Kartı ve Dijital Kodlar'
    },
    baseUsd: 4.99
  },
  steam_usd: {
    cover: '/images/steam_real.jpg',
    tag: 'Valve',
    subtitle: {
      en: 'Steam Wallet Global USD Gift Cards',
      az: 'Steam Cüzdan Qlobal USD Hədiyyə Kartları',
      ru: 'Подарочные карты Steam Wallet Global USD',
      tr: 'Steam Cüzdan Global USD Hediye Kartları'
    },
    baseUsd: 5.00
  },
  telegram_stars: {
    cover: '/images/telegram_stars_real.jpg',
    tag: 'Telegram Official',
    subtitle: {
      en: 'Official Telegram Stars for Mini-Apps & Bots',
      az: 'Mini-App və Botlar üçün Rəsmi Telegram Ulduzları',
      ru: 'Официальные Telegram Звезды для мини-приложений',
      tr: 'Mini Uygulamalar ve Botlar için Resmi Telegram Yıldızları'
    },
    baseUsd: 0.99
  },
  telegram_premium_gift: {
    cover: '/images/telegram_premium_real.jpg',
    tag: 'Telegram Official',
    subtitle: {
      en: 'Telegram Premium 3, 6, 12 Months Gift Subscriptions',
      az: 'Telegram Premium 3, 6, 12 Aylıq Hədiyyə Abunəliyi',
      ru: 'Подписка Telegram Premium на 3, 6, 12 месяцев',
      tr: 'Telegram Premium 3, 6, 12 Aylık Hediye Abonelik'
    },
    baseUsd: 11.99
  },
  netflix_tr: {
    cover: '/images/winnerslogo.jpg',
    tag: 'Netflix',
    subtitle: {
      en: 'Netflix Digital Gift Card Voucher',
      az: 'Netflix Rəqəmsal Hədiyyə Kartı Vauçeri',
      ru: 'Цифровая подарочная карта Netflix',
      tr: 'Netflix Dijital Hediye Kartı Kuponu'
    },
    baseUsd: 4.99
  }
};

let featuredProducts = [];
let currentCategory = 'all';
let currentSelectedOffer = null;
let currentSelectedCategory = null;

// DOM daxilində dil tərcümələrini tətbiq et
function applyLanguage(lang) {
  currentLanguage = lang || 'en';
  localStorage.setItem('winners_web_lang', currentLanguage);

  const t = WEB_I18N[currentLanguage] || WEB_I18N.en;

  // Açılan menyu (dropdown) dəyərini yenilə
  const selectEl = document.getElementById('siteLanguageSelect');
  if (selectEl && selectEl.value !== currentLanguage) {
    selectEl.value = currentLanguage;
  }

  // Sənəd Başlığı
  const docTitleEl = document.getElementById('pageDocTitle');
  if (docTitleEl) docTitleEl.innerText = t.docTitle;

  // Üst Panel
  const topBarNet = document.getElementById('topBarNetwork');
  if (topBarNet) topBarNet.innerText = t.topBarNetwork;
  const topBarTag = document.getElementById('topBarTag');
  if (topBarTag) topBarTag.innerText = t.topBarTag;

  // Naviqasiya
  const navLinkAll = document.getElementById('navLinkAll');
  if (navLinkAll) navLinkAll.innerText = t.navCatalog;

  // Qəhrəman bölməsi (Hero)
  const heroBadge = document.getElementById('heroBadge');
  if (heroBadge) heroBadge.innerHTML = t.heroBadge;
  const heroTitle = document.getElementById('heroTitle');
  if (heroTitle) heroTitle.innerText = t.heroTitle;
  const heroTitleBold = document.getElementById('heroTitleBold');
  if (heroTitleBold) heroTitleBold.innerText = t.heroTitleBold;
  const heroDesc = document.getElementById('heroDesc');
  if (heroDesc) heroDesc.innerText = t.heroDesc;
  const btnHeroExplore = document.getElementById('btnHeroExplore');
  if (btnHeroExplore) btnHeroExplore.innerHTML = `<svg class="pro-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="2"></rect></svg> ${t.heroBtnExplore}`;
  const btnHeroDeposit = document.getElementById('btnHeroDeposit');
  if (btnHeroDeposit) btnHeroDeposit.innerHTML = `<svg class="pro-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> ${t.heroBtnDeposit}`;

  // Xüsusiyyətlər
  const specDelivery = document.getElementById('specDelivery');
  if (specDelivery) specDelivery.innerHTML = t.specDelivery;
  const specSecurity = document.getElementById('specSecurity');
  if (specSecurity) specSecurity.innerHTML = t.specSecurity;
  const specPayment = document.getElementById('specPayment');
  if (specPayment) specPayment.innerHTML = t.specPayment;
  const specRating = document.getElementById('specRating');
  if (specRating) specRating.innerHTML = t.specRating;

  // Kataloq Tabları və Axtarış
  const tabCatAll = document.getElementById('tabCatAll');
  if (tabCatAll) tabCatAll.innerText = t.tabAll;
  const tabCatTelegram = document.getElementById('tabCatTelegram');
  if (tabCatTelegram) tabCatTelegram.innerText = t.tabTelegram;
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = t.searchPlaceholder;

  // Cədvəl
  const tableHeadTitle = document.getElementById('tableHeadTitle');
  if (tableHeadTitle) tableHeadTitle.innerText = t.tableTitle;
  const tableRefreshBtn = document.getElementById('tableRefreshBtn');
  if (tableRefreshBtn) tableRefreshBtn.innerText = t.tableRefresh;
  const thOrderId = document.getElementById('thOrderId');
  if (thOrderId) thOrderId.innerText = t.thOrderId;
  const thProduct = document.getElementById('thProduct');
  if (thProduct) thProduct.innerText = t.thProduct;
  const thAccount = document.getElementById('thAccount');
  if (thAccount) thAccount.innerText = t.thAccount;
  const thAmount = document.getElementById('thAmount');
  if (thAmount) thAmount.innerText = t.thAmount;
  const thStatus = document.getElementById('thStatus');
  if (thStatus) thStatus.innerText = t.thStatus;
  const thDate = document.getElementById('thDate');
  if (thDate) thDate.innerText = t.thDate;

  // Sifariş Modalı
  const modalProductTitle = document.getElementById('modalProductTitle');
  if (modalProductTitle && !currentSelectedCategory) modalProductTitle.innerText = t.orderModalTitle;
  const lblSelectPackage = document.getElementById('lblSelectPackage');
  if (lblSelectPackage) lblSelectPackage.innerText = t.lblSelectPackage;
  const lblPlayerId = document.getElementById('lblPlayerId');
  if (lblPlayerId) lblPlayerId.innerText = t.lblPlayerId;
  const modalPlayerId = document.getElementById('modalPlayerId');
  if (modalPlayerId) modalPlayerId.placeholder = t.playerIdPlaceholder;
  const playerIdHint = document.getElementById('playerIdHint');
  if (playerIdHint) playerIdHint.innerText = t.playerIdHint;
  const lblSummaryOffer = document.getElementById('lblSummaryOffer');
  if (lblSummaryOffer) lblSummaryOffer.innerText = t.lblSummaryOffer;
  const lblSummaryBalance = document.getElementById('lblSummaryBalance');
  if (lblSummaryBalance) lblSummaryBalance.innerText = t.lblSummaryBalance;
  const lblSummaryTotal = document.getElementById('lblSummaryTotal');
  if (lblSummaryTotal) lblSummaryTotal.innerText = t.lblSummaryTotal;
  const btnSubmitOrder = document.getElementById('btnSubmitOrder');
  if (btnSubmitOrder) btnSubmitOrder.innerHTML = t.btnBuyBalance;

  // Depozit Modalı
  const depositModalTitle = document.getElementById('depositModalTitle');
  if (depositModalTitle) depositModalTitle.innerText = t.depositModalTitle;
  const tabPayBinanceBtn = document.getElementById('tabPayBinanceBtn');
  if (tabPayBinanceBtn) tabPayBinanceBtn.innerText = t.tabPayBinance;
  const tabPayM10Btn = document.getElementById('tabPayM10Btn');
  if (tabPayM10Btn) tabPayM10Btn.innerText = t.tabPayM10;
  const tabPayCardBtn = document.getElementById('tabPayCardBtn');
  if (tabPayCardBtn) tabPayCardBtn.innerText = t.tabPayCard;
  const lblBinanceId = document.getElementById('lblBinanceId');
  if (lblBinanceId) lblBinanceId.innerText = t.lblBinanceId;
  const lblBinanceOrder = document.getElementById('lblBinanceOrder');
  if (lblBinanceOrder) lblBinanceOrder.innerText = t.lblBinanceOrder;
  const lblBinanceHint = document.getElementById('lblBinanceHint');
  if (lblBinanceHint) lblBinanceHint.innerText = t.lblBinanceHint;
  const btnVerifyBinance = document.getElementById('btnVerifyBinance');
  if (btnVerifyBinance) btnVerifyBinance.innerHTML = t.btnVerifyBinance;
  document.querySelectorAll('.btn-copy-txt').forEach(el => el.innerText = t.btnCopy);

  // Profil Modalı
  const profileModalTitle = document.getElementById('profileModalTitle');
  if (profileModalTitle) profileModalTitle.innerText = t.profileTitle;
  const lblProfBal = document.getElementById('lblProfBal');
  if (lblProfBal) lblProfBal.innerText = t.lblProfBal;
  const btnProfDeposit = document.getElementById('btnProfDeposit');
  if (btnProfDeposit) btnProfDeposit.innerHTML = `<svg class="pro-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> ${t.btnProfDeposit}`;
  const tabProfFeaturesText = document.getElementById('tabProfFeaturesText');
  if (tabProfFeaturesText) tabProfFeaturesText.innerText = t.tabFeatures;
  const tabProfOrdersText = document.getElementById('tabProfOrdersText');
  if (tabProfOrdersText) tabProfOrdersText.innerText = t.tabOrders;
  const tabProfSettingsText = document.getElementById('tabProfSettingsText');
  if (tabProfSettingsText) tabProfSettingsText.innerText = t.tabSettings;
  const btnAdminPanel = document.getElementById('btnAdminPanel');
  if (btnAdminPanel) btnAdminPanel.innerText = t.btnAdmin;
  const btnProfLogout = document.getElementById('btnProfLogout');
  if (btnProfLogout) btnProfLogout.innerText = t.btnLogout;

  renderUserAuthNav();
  updateBalanceDisplay();
  if (featuredProducts.length > 0) {
    renderProducts(featuredProducts);
  }
}

function changeSiteLanguage(lang) {
  applyLanguage(lang);
  showToast(`🌐 ${lang === 'en' ? 'Language switched to English (USD $)' : (lang === 'az' ? 'Dil dəyişdirildi: Azərbaycan (AZN ₼)' : (lang === 'ru' ? 'Язык изменен на Русский (USD $)' : 'Dil Türkçe olarak güncellendi (USD $)'))}`);
}

// İstifadəçi Sessiyasının Başladılması
function initUserSession() {
  if (tg?.initDataUnsafe?.user?.id) {
    currentUser = {
      telegram_id: tg.initDataUnsafe.user.id.toString(),
      username: tg.initDataUnsafe.user.username || '',
      first_name: tg.initDataUnsafe.user.first_name || 'Player',
      balance: 0.00
    };
    localStorage.setItem('winners_user_session', JSON.stringify(currentUser));
  } else {
    try {
      const saved = localStorage.getItem('winners_user_session');
      if (saved) {
        currentUser = JSON.parse(saved);
      }
    } catch (e) { }
  }
  renderUserAuthNav();
}

function getUserAuthHeaders() {
  const token = currentUser?.token || '';
  return {
    'Authorization': 'Bearer ' + token,
    'x-user-token': token
  };
}

async function fetchUserProfile() {
  if (!currentUser?.telegram_id) {
    renderUserAuthNav();
    return;
  }
  try {
    const res = await fetch('/api/auth/me', {
      headers: getUserAuthHeaders()
    });
    const data = await res.json();
    if (data.ok && data.user) {
      currentUser = { ...currentUser, ...data.user };
      localStorage.setItem('winners_user_session', JSON.stringify(currentUser));
    } else if (res.status === 401) {
      // Sessiya bitibsə təmizlə
      currentUser = null;
      localStorage.removeItem('winners_user_session');
    }
  } catch (e) { }
  renderUserAuthNav();
}

// Toast bildiriş köməkçisi
function showToast(message, duration = 3500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Mübadilə buferinə (Clipboard) kopyala
function copyToClipboard(elementId) {
  const input = document.getElementById(elementId);
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => {
    showToast(`Copied: ${input.value}`);
  }).catch(() => {
    input.select();
    document.execCommand('copy');
    showToast(`Copied: ${input.value}`);
  });
}

function renderUserAuthNav() {
  const container = document.getElementById('userAuthNav');
  if (!container) return;
  const t = WEB_I18N[currentLanguage] || WEB_I18N.en;

  if (currentUser) {
    const rawName = currentUser.first_name || currentUser.username || 'Player';
    const cleanLetter = (rawName.replace(/[^\w\s\u00C0-\u024F\u0400-\u04FF]/gi, '').trim().charAt(0) || 'U').toUpperCase();
    const displayName = currentUser.first_name || (currentUser.username ? `@${currentUser.username}` : `ID: ${currentUser.telegram_id}`);
    const isAdmin = currentUser.is_admin === 1 || currentUser.isAdmin === true;

    container.innerHTML = `
      <div class="user-profile-pill" onclick="window.location.href='/dashboard.html'" title="${t.navProfile}">
        <div class="user-avatar-circle">${cleanLetter}</div>
        <div class="user-info-brief">
          <span class="user-name-tag">${displayName}</span>
          <span class="user-balance-tag" id="userBalanceDisplay">${formatBalance(currentUser.balance)}</span>
        </div>
      </div>
      ${isAdmin ? `
        <a href="/admin.html" class="btn-admin-nav-glow" style="display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(249, 115, 22, 0.2)); border: 1px solid rgba(234, 179, 8, 0.5); color: #facc15; text-decoration: none; padding: 7px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; box-shadow: 0 0 15px rgba(234, 179, 8, 0.25); transition: all 0.2s ease;">
          <span>👑 Admin Paneli</span>
        </a>
      ` : ''}
      <button class="btn-primary-action" onclick="openPaymentModal()">
        <svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        ${t.navDeposit}
      </button>
      <button class="btn-logout-icon" onclick="logout()" title="${t.navLogout}">
        <svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        ${t.navLogout}
      </button>
    `;
  } else {
    container.innerHTML = `
      <div class="guest-btn-group">
        <button class="btn-auth-login" onclick="openAuthModal('telegram')">
          <svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
          ${t.navLogin}
        </button>
        <button class="btn-auth-register" onclick="openAuthModal('register')">
          <svg class="pro-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
          ${t.navRegister}
        </button>
      </div>
    `;
  }
}

// =========================================================================
// MÜƏSSİSƏ İSTİFADƏÇİ PROFİLİ VƏ PROQRAMÇI API PORTALI
// =========================================================================
function openUserProfileModal() {
  window.location.href = '/dashboard.html';
}

function closeUserProfileModal() {
  document.getElementById('userProfileModal')?.classList.remove('active');
}

function switchProfTab(tab) {
  document.getElementById('tabProfOrdersBtn')?.classList.toggle('active', tab === 'orders');
  document.getElementById('tabProfApiKeyBtn')?.classList.toggle('active', tab === 'apikey');
  document.getElementById('tabProfSettingsBtn')?.classList.toggle('active', tab === 'settings');

  const paneOrders = document.getElementById('paneProfOrders');
  const paneApiKey = document.getElementById('paneProfApiKey');
  const paneSettings = document.getElementById('paneProfSettings');

  if (paneOrders) paneOrders.style.display = tab === 'orders' ? 'block' : 'none';
  if (paneApiKey) paneApiKey.style.display = tab === 'apikey' ? 'block' : 'none';
  if (paneSettings) paneSettings.style.display = tab === 'settings' ? 'block' : 'none';

  if (tab === 'orders') {
    renderUserOrdersInProfile();
  } else if (tab === 'apikey') {
    fetchUserApiKey();
  }
}

async function renderUserOrdersInProfile() {
  const container = document.getElementById('profOrdersList');
  if (!container || !currentUser?.telegram_id) return;

  container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 13px;">Sifarişlər yüklənir...</div>';

  try {
    const res = await fetch(`/api/orders/history?telegram_id=${currentUser.telegram_id}`);
    const data = await res.json();

    if (data.ok && data.orders && data.orders.length > 0) {
      container.innerHTML = data.orders.map(o => {
        const isDeliveredCode = o.pin_code || o.delivered_code;
        const codeValue = o.pin_code || o.delivered_code || '';
        const priceFormatted = o.price_azn ? `${parseFloat(o.price_azn).toFixed(2)} AZN` : formatPrice(o.price_usd);
        const statusClass = o.status === 'completed' ? 'badge-completed' : (o.status === 'failed' || o.status === 'cancelled' ? 'badge-failed' : 'badge-pending');
        const statusText = o.status === 'completed' ? 'Tamamlandı' : (o.status === 'failed' ? 'İmtina' : 'Gözləyir');

        return `
          <div class="user-order-item">
            <div class="user-order-header">
              <div class="user-order-title">${escapeHtml(o.category_name || 'Məhsul')} — ${escapeHtml(o.offer_name || '')}</div>
              <span class="badge ${statusClass}" style="font-size: 10.5px;">${statusText}</span>
            </div>
            
            <div class="user-order-details">
              <div>
                <span>ID: <code style="font-family: 'JetBrains Mono', monospace; color: #cbd5e1;">${escapeHtml(o.player_id || o.order_id || 'Avtomatik')}</code></span>
                <span style="margin: 0 6px; opacity: 0.4;">•</span>
                <span>${o.created_at || ''}</span>
              </div>
              <strong style="color: #34d399; font-family: 'JetBrains Mono', monospace; font-size: 13px;">${priceFormatted}</strong>
            </div>

            ${isDeliveredCode ? `
              <div class="user-order-code-box">
                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                  <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Kod:</span>
                  <span class="user-order-code-text">${escapeHtml(codeValue)}</span>
                </div>
                <button type="button" class="btn-code-copy" onclick="copyToClipboard('${escapeHtml(codeValue)}', 'E-Pin Kodu')">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Kopyala
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 36px 16px;">
          <div style="font-size: 32px; margin-bottom: 8px;">🎮</div>
          <div style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 4px;">Hələlik heç bir sifarişiniz yoxdur</div>
          <p style="font-size: 12px; margin: 0 0 16px 0; color: var(--text-secondary);">Mağazamızdan istədiyiniz oyunu və ya hədiyyə kartını seçib 3 saniyədə əldə edə bilərsiniz.</p>
          <button type="button" class="btn-hero-primary" onclick="closeUserProfileModal(); scrollToCatalog();" style="font-size: 12px; padding: 7px 16px; border-radius: 8px;">
            Məhsullara Bax ↗
          </button>
        </div>
      `;
    }
  } catch (e) {
    container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px;">Sifariş tarixçəsi yüklənərkən xəta baş verdi.</div>`;
  }
}

async function fetchUserApiKey() {
  if (!currentUser?.telegram_id) return;
  const inputEl = document.getElementById('clientApiKeyField');
  const snipEl = document.getElementById('clientApiKeySnippet');
  const ordersEl = document.getElementById('clientApiTotalOrders');
  const spentEl = document.getElementById('clientApiTotalSpent');

  try {
    const res = await fetch(`/api/user/api-key?telegram_id=${currentUser.telegram_id}`);
    const data = await res.json();

    if (data.ok && data.apiKey) {
      currentClientApiKey = data.apiKey;
      if (inputEl) inputEl.value = data.apiKey;
      if (snipEl) snipEl.innerText = data.apiKey;
      if (ordersEl) ordersEl.innerText = data.total_orders || 0;
      if (spentEl) spentEl.innerText = `${parseFloat(data.total_spent_azn || 0).toFixed(2)} ₼`;
    }
  } catch (e) {
    if (inputEl) inputEl.value = 'Açar yüklənmədi';
  }
}

function toggleClientApiKeyMask() {
  const inputEl = document.getElementById('clientApiKeyField');
  if (!inputEl) return;
  if (inputEl.classList.contains('api-key-masked')) {
    inputEl.classList.remove('api-key-masked');
    inputEl.classList.add('api-key-unmasked');
  } else {
    inputEl.classList.remove('api-key-unmasked');
    inputEl.classList.add('api-key-masked');
  }
}

function copyClientApiKey() {
  if (!currentClientApiKey) return;
  copyToClipboard(currentClientApiKey, 'API Key');
}

async function regenerateUserApiKey() {
  if (!currentUser?.telegram_id) return;
  showToast('Yeni API Açarı hazırlanır...');

  try {
    const res = await fetch('/api/user/api-key/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: currentUser.telegram_id })
    });
    const data = await res.json();
    if (data.ok && data.apiKey) {
      currentClientApiKey = data.apiKey;
      showToast('success', 'Yeni API Açarı uğurla yaradıldı!');
      fetchUserApiKey();
    } else {
      showToast('error', 'Açar yaradılarkən xəta baş verdi.');
    }
  } catch (e) {
    showToast('error', 'Server xətası.');
  }
}

// Dinamik Bot İstifadəçi Adının Sinxronlaşdırılması
function applyDynamicBotInfo(botUsername) {
  if (!botUsername) return;
  const cleanUsername = botUsername.replace(/^@/, '');

  document.querySelectorAll('.dynamic-bot-tag').forEach(el => {
    el.innerText = '@' + cleanUsername;
  });

  document.querySelectorAll('.dynamic-bot-link').forEach(el => {
    el.href = 'https://t.me/' + cleanUsername;
  });

  const linkEl = document.getElementById('btnTelegramAuthLink');
  if (linkEl && !currentAuthCode) {
    linkEl.href = 'https://t.me/' + cleanUsername;
  }
}

// Giriş (Auth) Modalı Nəzarətləri
function openAuthModal(tab = 'telegram') {
  document.getElementById('authModal').classList.add('active');
  switchAuthTab(tab);
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('active');
  if (authPollInterval) {
    clearInterval(authPollInterval);
    authPollInterval = null;
  }
}

async function switchAuthTab(tab) {
  document.getElementById('tabAuthLoginBtn')?.classList.toggle('active', tab === 'login');
  document.getElementById('tabAuthRegisterBtn')?.classList.toggle('active', tab === 'register');
  document.getElementById('tabAuthTgBtn')?.classList.toggle('active', tab === 'telegram');

  document.getElementById('authLoginPane').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('authRegisterPane').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('authTelegramPane').style.display = tab === 'telegram' ? 'block' : 'none';

  if (tab === 'telegram') {
    await initTelegramAuthSession();
  } else {
    if (authPollInterval) {
      clearInterval(authPollInterval);
      authPollInterval = null;
    }
  }
}

async function initTelegramAuthSession() {
  try {
    const res = await fetch('/api/auth/telegram/init', { method: 'POST' });
    const data = await res.json();

    if (data.ok) {
      currentAuthCode = data.code;
      const botUser = data.botUsername || systemSettings.bot_username || 'WS_StoreBot';
      applyDynamicBotInfo(botUser);

      const linkEl = document.getElementById('btnTelegramAuthLink');
      if (linkEl) {
        linkEl.href = data.botUrl;
      }
      const codeInput = document.getElementById('manualAuthCodeInput');
      if (codeInput) {
        codeInput.value = data.code;
      }
      startTelegramAuthPolling();
    }
  } catch (err) {
    console.error('Telegram auth init error:', err);
  }
}

function startTelegramAuthPolling() {
  const indicator = document.getElementById('authPollingIndicator');
  if (indicator) indicator.style.display = 'block';

  if (authPollInterval) clearInterval(authPollInterval);

  authPollInterval = setInterval(async () => {
    if (!currentAuthCode) return;

    try {
      const res = await fetch(`/api/auth/telegram/poll?code=${currentAuthCode}`);
      const data = await res.json();

      if (data.ok && data.confirmed && data.user) {
        clearInterval(authPollInterval);
        authPollInterval = null;
        handleAuthResponse(data, `🎉 Welcome, ${data.user.first_name || data.user.username || 'Player'}! Telegram synced.`);
      }
    } catch (e) { }
  }, 750);
}

function handleAuthResponse(data, successMsg) {
  if (data.ok && data.user) {
    currentUser = data.user;
    localStorage.setItem('winners_user_session', JSON.stringify(currentUser));
    if (data.token) {
      document.cookie = 'user_token=' + data.token + '; path=/; max-age=2592000; SameSite=Lax';
    }
    if (data.adminToken) {
      document.cookie = 'admin_token=' + data.adminToken + '; path=/; max-age=2592000; SameSite=Lax';
      localStorage.setItem('admin_token', data.adminToken);
    }
    renderUserAuthNav();
    closeAuthModal();
    showToast(successMsg || `🎉 Welcome, ${currentUser.first_name || currentUser.username || 'Player'}!`);
    fetchUserProfile();
  }
}

async function submitManualAuthCode() {
  const code = document.getElementById('manualAuthCodeInput')?.value?.trim();
  if (!code) {
    showToast('⚠️ Please enter code!');
    return;
  }

  showToast('⏳ Verifying code...');
  try {
    const res = await fetch('/api/auth/telegram/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();

    if (data.ok && data.user) {
      if (authPollInterval) clearInterval(authPollInterval);
      handleAuthResponse(data, `🎉 Welcome, ${data.user.first_name || 'Player'}!`);
    } else {
      showToast(`❌ ${data.error || 'Code verification pending in Telegram.'}`);
    }
  } catch (e) {
    showToast('An error occurred.');
  }
}

async function submitLogin() {
  const input = document.getElementById('loginIdentifierInput');
  const identifier = input?.value?.trim();
  if (!identifier) {
    showToast('⚠️ Please enter Telegram ID or @username!');
    return;
  }

  showToast('⏳ Signing in...');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });
    const data = await res.json();

    if (data.ok && data.user) {
      handleAuthResponse(data, `🎉 Welcome, ${data.user.first_name || data.user.username || data.user.telegram_id}!`);
    } else {
      showToast(`❌ ${data.error || 'User not found'}`);
    }
  } catch (err) {
    showToast('Network error.');
  }
}

async function submitRegister() {
  const telegramId = document.getElementById('regTelegramIdInput')?.value?.trim();
  const username = document.getElementById('regUsernameInput')?.value?.trim();
  const firstName = document.getElementById('regFirstNameInput')?.value?.trim();

  if (!telegramId) {
    showToast('⚠️ Telegram ID is required!');
    return;
  }

  if (!/^\d+$/.test(telegramId)) {
    showToast('⚠️ Telegram ID must contain digits only!');
    return;
  }

  showToast('⏳ Creating account...');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: telegramId, username, first_name: firstName })
    });
    const data = await res.json();

    if (data.ok && data.user) {
      handleAuthResponse(data, `🎉 Registration successful! Welcome, ${data.user.first_name}!`);
    } else {
      showToast(`❌ ${data.error || 'Registration failed'}`);
    }
  } catch (err) {
    showToast('Network error.');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('winners_user_session');
  localStorage.removeItem('admin_token');
  document.cookie = 'user_token=; path=/; max-age=0; SameSite=Lax';
  document.cookie = 'admin_token=; path=/; max-age=0; SameSite=Lax';
  renderUserAuthNav();
  fetchUserOrdersTable();
  showToast('👋 Signed out successfully.');
}

function validatePlayerIdInput() {
  const val = document.getElementById('modalPlayerId')?.value?.trim() || '';
  const hint = document.getElementById('playerIdHint');
  if (!hint) return;

  if (val.length >= 5 && /^\d+$/.test(val)) {
    hint.innerHTML = '<span style="color: #34d399; font-weight: 700;">✅ Player ID format is valid</span>';
  } else if (val.length > 0) {
    hint.innerHTML = '<span style="color: #f43f5e;">⚠️ Please enter digits only for Player ID.</span>';
  } else {
    const t = WEB_I18N[currentLanguage] || WEB_I18N.en;
    hint.innerText = t.playerIdHint;
    hint.style.color = 'var(--text-muted)';
  }
}

// Parametrləri Gətir
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.ok && data.settings) {
      systemSettings = { ...systemSettings, ...data.settings };
      if (document.getElementById('displayBinanceId')) {
        document.getElementById('displayBinanceId').value = systemSettings.binance_pay_id || '938747481';
      }
      if (document.getElementById('displayM10Number')) {
        document.getElementById('displayM10Number').value = systemSettings.m10_number || '+994501234567';
      }
      if (document.getElementById('displayCardNumber')) {
        document.getElementById('displayCardNumber').value = systemSettings.bank_card_number || '4169738812345678';
      }
      if (document.getElementById('displayCardHolder')) {
        document.getElementById('displayCardHolder').value = systemSettings.bank_card_holder || 'WINNERS SHOP';
      }
    }
  } catch (e) { }
}

// Məhsulları Gətir
async function fetchProducts() {
  try {
    const res = await fetch('/api/products/featured');
    const data = await res.json();
    if (data.ok) {
      featuredProducts = data.products;
      renderProducts(featuredProducts);
    }
  } catch (err) {
    document.getElementById('productsGrid').innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 30px;">Error loading products.</div>';
  }
}

// Valyuta Keçirici Dəstəyi ilə Məhsul Şəbəkəsini (Grid) Göstər
function renderProducts(list) {
  const container = document.getElementById('productsGrid');
  if (!container) return;
  const t = WEB_I18N[currentLanguage] || WEB_I18N.en;

  if (!list || list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">${t.empty || 'No products found.'}</div>`;
    return;
  }

  container.innerHTML = list.map((item, idx) => {
    const meta = PRODUCT_CATALOG_META[item.id] || {
      cover: '/images/pubg_real.jpg',
      tag: item.type === 'giftcard' ? t.cardTagGiftcard : t.cardTagTopup,
      subtitle: { en: 'Digital game currency delivery' },
      baseUsd: 0.99
    };

    const subtitleText = typeof meta.subtitle === 'object' ? (meta.subtitle[currentLanguage] || meta.subtitle.en) : meta.subtitle;

    // Real canlı təkliflərdən dinamik başlanğıc qiyməti
    let priceDisplay;
    if (currentLanguage === 'az') {
      const azn = item.min_price_azn ? parseFloat(item.min_price_azn) : (item.min_price_usd ? (parseFloat(item.min_price_usd) * getExchangeRate()) : 1.66);
      priceDisplay = `${azn.toFixed(2)} ₼`;
    } else {
      const usd = item.min_price_usd ? parseFloat(item.min_price_usd) : 0.89;
      priceDisplay = `$${usd.toFixed(2)}`;
    }

    const badgeText = item.type === 'giftcard' ? t.cardBadgeGift : t.cardBadgeAuto;

    return `
      <div class="game-store-card" style="animation-delay: ${idx * 0.08}s;" onclick="openProductModal('${item.id}', '${item.type || 'topup'}', '${encodeURIComponent(item.name)}')">
        <div class="card-poster-wrap">
          <img src="${meta.cover}" class="card-poster-img" alt="${item.name}" loading="lazy">
          <span class="publisher-chip">${meta.tag}</span>
          <span class="delivery-badge-chip">${badgeText}</span>
        </div>
        <div class="card-details-body">
          <h3 class="card-game-title">${item.name}</h3>
          <p class="card-game-desc">${subtitleText}</p>
          <div class="card-bottom-row">
            <div class="price-indicator">
              <span>${t.cardPriceLabel}</span>
              <strong>${priceDisplay}</strong>
            </div>
            <button class="btn-card-order">
              ${t.cardOrderBtn}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Kateqoriya Filtri və Qəhrəman bölməsi (Hero) Yenilənməsi
function filterCategory(cat, btn) {
  document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  currentCategory = cat;

  if (cat === 'all') {
    renderProducts(featuredProducts);
    updateHeroBanner('pubg_mobile_auto');
  } else if (cat === 'pubg') {
    renderProducts(featuredProducts.filter(p => p.id.includes('pubg')));
    updateHeroBanner('pubg_mobile_auto');
  } else if (cat === 'freefire') {
    renderProducts(featuredProducts.filter(p => p.id.includes('free_fire')));
    updateHeroBanner('free_fire_cis');
  } else if (cat === 'roblox') {
    renderProducts(featuredProducts.filter(p => p.id.includes('roblox')));
    updateHeroBanner('roblox_global');
  } else if (cat === 'mobilelegends') {
    renderProducts(featuredProducts.filter(p => p.id.includes('mobile_legends')));
    updateHeroBanner('mobile_legends_global');
  } else if (cat === 'brawlstars') {
    renderProducts(featuredProducts.filter(p => p.id.includes('brawl')));
    updateHeroBanner('brawl_stars');
  } else if (cat === 'steam') {
    renderProducts(featuredProducts.filter(p => p.id.includes('steam')));
    updateHeroBanner('steam_wallet_global');
  } else if (cat === 'telegram') {
    renderProducts(featuredProducts.filter(p => p.id.includes('telegram')));
    updateHeroBanner('telegram_premium');
  }
}

function updateHeroBanner(gameKey) {
  const meta = PRODUCT_CATALOG_META[gameKey];
  if (!meta) return;
  const banner = document.getElementById('heroBanner');
  if (banner && meta.cover) {
    banner.style.backgroundImage = `linear-gradient(90deg, rgba(14, 9, 28, 0.97) 0%, rgba(20, 13, 38, 0.9) 60%, rgba(24, 15, 48, 0.5) 100%), url('${meta.cover}')`;
  }
}

function handleSearch() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  if (!query) {
    filterCategory(currentCategory);
    return;
  }

  const filtered = featuredProducts.filter(p => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query));
  renderProducts(filtered);
}

// Məhsul Modalı və Təkliflər
async function openProductModal(categoryId, type, encodedName) {
  const t = WEB_I18N[currentLanguage] || WEB_I18N.en;
  if (!currentUser) {
    showToast(t.toastLoginReq);
    openAuthModal('login');
    return;
  }

  const name = decodeURIComponent(encodedName);
  currentSelectedCategory = { id: categoryId, type, name };
  currentSelectedOffer = null;

  document.getElementById('modalProductTitle').innerText = name;
  document.getElementById('modalOffersList').innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">Loading packages...</div>';
  document.getElementById('modalTotalPrice').innerText = formatPrice(0);
  document.getElementById('modalSummaryOffer').innerText = '—';
  updateBalanceDisplay();

  const isGiftcard = type === 'giftcard' || categoryId.includes('giftcard') || categoryId.includes('wallet') || categoryId.includes('stars') || categoryId.includes('premium') || categoryId.includes('roblox');
  const playerIdGroup = document.getElementById('playerIdGroup');

  if (isGiftcard) {
    playerIdGroup.style.display = 'none';
  } else {
    playerIdGroup.style.display = 'block';
    document.getElementById('modalPlayerId').value = '';
    validatePlayerIdInput();
  }

  document.getElementById('orderModal').classList.add('active');

  try {
    const res = await fetch(`/api/products/offers?category_id=${categoryId}&type=${type}`);
    const data = await res.json();

    if (!data.ok || !data.offers || data.offers.length === 0) {
      document.getElementById('modalOffersList').innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 20px;">No active offers found.</div>';
      return;
    }

    renderOffersList(data.offers);
  } catch (err) {
    document.getElementById('modalOffersList').innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 20px;">An error occurred.</div>';
  }
}

function renderOffersList(offers) {
  const container = document.getElementById('modalOffersList');
  container.innerHTML = offers.map((off, index) => {
    const priceDisplay = formatPrice(off.price_usd);
    return `
      <div class="package-card-option ${index === 0 ? 'selected' : ''}" onclick="selectOffer(this, ${JSON.stringify(off).replace(/"/g, '&quot;')})">
        <div class="opt-name">${off.name}</div>
        <div class="opt-price">${priceDisplay}</div>
      </div>
    `;
  }).join('');

  if (offers.length > 0) {
    selectOffer(container.querySelector('.package-card-option'), offers[0]);
  }
}

function selectOffer(el, offer) {
  document.querySelectorAll('.package-card-option').forEach(item => item.classList.remove('selected'));
  if (el) el.classList.add('selected');
  currentSelectedOffer = offer;
  const priceDisplay = formatPrice(offer.price_usd);
  document.getElementById('modalTotalPrice').innerText = priceDisplay;
  document.getElementById('modalSummaryOffer').innerText = `${offer.name} (${priceDisplay})`;
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.remove('active');
}

// Sifarişi Göndər
async function submitOrder() {
  const t = WEB_I18N[currentLanguage] || WEB_I18N.en;
  if (!currentUser) {
    showToast(t.toastLoginReq);
    openAuthModal('login');
    return;
  }

  if (!currentSelectedOffer || !currentSelectedCategory) {
    showToast('Please select a package.');
    return;
  }

  const isGiftcard = currentSelectedCategory.type === 'giftcard' || currentSelectedCategory.id.includes('giftcard') || currentSelectedCategory.id.includes('wallet') || currentSelectedCategory.id.includes('stars') || currentSelectedCategory.id.includes('premium') || currentSelectedCategory.id.includes('roblox');
  const playerId = document.getElementById('modalPlayerId').value.trim();

  if (!isGiftcard && !playerId) {
    showToast('Please enter your Player ID.');
    return;
  }

  const requiredAzn = currentSelectedOffer.price_azn || (currentSelectedOffer.price_usd * getExchangeRate());
  if (currentUser.balance < requiredAzn) {
    showToast(t.toastBalanceLow);
    setTimeout(() => {
      closeOrderModal();
      openPaymentModal();
    }, 1000);
    return;
  }

  const isWebPurchase = currentSelectedCategory.id === 'pubg_mobile_web';
  const btn = document.getElementById('btnSubmitOrder');
  btn.disabled = true;
  btn.innerText = isWebPurchase
    ? (currentLanguage === 'az' ? 'Operatora yönləndirilir...' : (currentLanguage === 'ru' ? 'Перенаправление оператору...' : (currentLanguage === 'tr' ? 'Operatöre iletiliyor...' : 'Forwarding to Operator...')))
    : (currentLanguage === 'az' ? 'Sifariş icra olunur (3s)...' : (currentLanguage === 'ru' ? 'Обработка заказа (3 сек)...' : (currentLanguage === 'tr' ? 'Sipariş işleniyor (3sn)...' : 'Processing Order (3s)...')));

  try {
    const endpoint = isGiftcard ? '/api/orders/giftcard' : '/api/orders/topup';
    const payload = isGiftcard ? {
      telegram_id: currentUser.telegram_id,
      category_id: currentSelectedCategory.id,
      category_name: currentSelectedCategory.name,
      offer_id: currentSelectedOffer.offer_id,
      offer_name: currentSelectedOffer.name,
      price_usd: currentSelectedOffer.price_usd,
      count: 1
    } : {
      telegram_id: currentUser.telegram_id,
      category_id: currentSelectedCategory.id,
      category_name: currentSelectedCategory.name,
      offer_id: currentSelectedOffer.offer_id,
      offer_name: currentSelectedOffer.name,
      price_usd: currentSelectedOffer.price_usd,
      player_id: playerId
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getUserAuthHeaders() },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.ok) {
      if (isWebPurchase) {
        showToast(t.toastOrderForwarding || '⏳ Your request is being accepted and forwarded to the Winners Store operator, please wait...');
      } else {
        showToast(t.toastOrderSuccess || '🎉 Order completed successfully!');
      }
      fetchUserProfile();
      closeOrderModal();
    } else {
      showToast(`Error: ${data.error || 'Order execution failed'}`);
    }
  } catch (err) {
    showToast('System connection error.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = t.btnBuyBalance;
  }
}

function redirectToTelegramBuy() {
  if (!currentSelectedCategory || !currentSelectedOffer) {
    showToast('Please select a package first.');
    return;
  }

  const botUser = systemSettings.bot_username || 'WS_StoreBot';
  const url = `https://t.me/${botUser}?start=buy_${currentSelectedCategory.id}_${currentSelectedOffer.offer_id}`;

  showToast('Redirecting to Telegram Bot...');
  setTimeout(() => {
    window.open(url, '_blank');
    closeOrderModal();
  }, 400);
}

// İstifadəçi Sifarişləri Cədvəlini Gətir
async function fetchUserOrdersTable() {
  const tbody = document.getElementById('userOrdersTableBody');
  if (!tbody) return;

  if (!currentUser) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">Please <a onclick="openAuthModal(\'login\')" style="color: var(--text-highlight); cursor: pointer; text-decoration: underline;">Sign In</a> to view your order history.</td></tr>';
    return;
  }

  try {
    const res = await fetch('/api/orders/history', {
      headers: getUserAuthHeaders()
    });
    const data = await res.json();

    if (!data.ok || !data.orders || data.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No orders found in your account.</td></tr>';
      return;
    }

    tbody.innerHTML = data.orders.map(o => {
      const badgeClass = o.status === 'completed' ? 'status-completed' : (o.status === 'failed' ? 'status-failed' : 'status-pending');
      const statusText = o.status === 'completed' ? 'Completed' : (o.status === 'failed' ? 'Refunded' : 'Processing');

      return `
        <tr>
          <td><code>${o.id}</code></td>
          <td><strong>${o.category_name}</strong> (${o.offer_name})</td>
          <td><code>${o.player_id || 'Digital Code'}</code></td>
          <td><strong>${formatPrice(o.price_usd)}</strong></td>
          <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
          <td><small style="color: var(--text-muted);">${o.created_at}</small></td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Failed to load order history.</td></tr>';
  }
}

// Ödəniş Modalı Nəzarətləri
function openPaymentModal() {
  const t = WEB_I18N[currentLanguage] || WEB_I18N.en;
  if (!currentUser) {
    showToast(t.toastLoginReq);
    openAuthModal('login');
    return;
  }
  document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
}

function switchPaymentTab(tabName, btn) {
  document.querySelectorAll('#paymentModal .tab-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  document.getElementById('tabBinance').style.display = tabName === 'binance' ? 'block' : 'none';
  document.getElementById('tabM10').style.display = tabName === 'm10' ? 'block' : 'none';
  document.getElementById('tabCard').style.display = tabName === 'card' ? 'block' : 'none';
}

async function submitBinancePayment() {
  if (!currentUser) {
    showToast('Please sign in first!');
    openAuthModal('login');
    return;
  }

  const orderId = document.getElementById('binanceOrderIdInput').value.trim();
  if (!orderId) {
    showToast('Please enter your Binance Order ID.');
    return;
  }

  showToast('⏳ Verifying Binance Pay transaction...');
  try {
    const res = await fetch('/api/payments/binance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: currentUser.telegram_id, order_id: orderId })
    });
    const data = await res.json();
    if (data.ok) {
      showToast(`🎉 +${formatPrice(data.amountUsd || (data.amountAzn / getExchangeRate()))} added to your balance!`);
      document.getElementById('binanceOrderIdInput').value = '';
      fetchUserProfile();
      closePaymentModal();
    } else {
      showToast(data.error || 'Binance verification error.');
    }
  } catch (e) {
    showToast('An error occurred.');
  }
}

async function submitManualPayment(method) {
  if (!currentUser) {
    showToast('Please sign in first!');
    openAuthModal('login');
    return;
  }

  const fileInput = document.getElementById(method === 'm10' ? 'm10ReceiptInput' : 'cardReceiptInput');
  const amountInput = document.getElementById(method === 'm10' ? 'm10AmountInput' : 'cardAmountInput');

  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('Please select receipt image.');
    return;
  }

  const formData = new FormData();
  formData.append('telegram_id', currentUser.telegram_id);
  formData.append('username', currentUser.username || '');
  formData.append('first_name', currentUser.first_name || '');
  formData.append('method', method);
  formData.append('amount_azn', amountInput.value || '0');
  formData.append('receipt', fileInput.files[0]);

  showToast('⏳ Uploading receipt...');

  try {
    const res = await fetch('/api/payments/receipt', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.ok) {
      showToast('🧾 Receipt submitted for review. Balance will be updated.');
      fileInput.value = '';
      amountInput.value = '';
      closePaymentModal();
    } else {
      showToast(data.error || 'Error submitting receipt.');
    }
  } catch (e) {
    showToast('Upload error.');
  }
}

// Hüquqi Sənədlər Modalı
const LEGAL_TEXTS = {
  terms: {
    title: 'Terms of Service & User Agreement',
    content: `
      <p><strong>1. General Provisions:</strong> Winners Global platform provides automated digital delivery of game currencies, gift cards and digital subscription products. By ordering on this platform, the user agrees to all terms.</p><br>
      <p><strong>2. Order Delivery:</strong> Orders are processed instantly via official direct API channels within 3 seconds. The user is solely responsible for entering the correct Player ID.</p><br>
      <p><strong>3. Payments:</strong> Accepted payment methods include Binance Pay, Credit/Debit Cards, and local transfers.</p>
    `
  },
  privacy: {
    title: 'Privacy Policy',
    content: `
      <p><strong>1. Data Collection:</strong> We only collect necessary identifiers (Telegram ID, username, order history) to fulfill digital purchases and maintain user balances.</p><br>
      <p><strong>2. Security:</strong> User data is stored in secured encrypted databases and never shared with third parties.</p>
    `
  },
  refund: {
    title: 'Refund Policy',
    content: `
      <p><strong>1. Instant Rollback:</strong> If a game server rejects an order due to invalid ID or maintenance, funds are automatically returned to your account balance within 1 second.</p><br>
      <p><strong>2. Digital Codes:</strong> Once generated, digital redemption codes cannot be refunded or exchanged.</p>
    `
  },
  api: {
    title: 'B2B Reseller & API Partner Terms',
    content: `
      <p><strong>1. REST API Integration:</strong> To activate automated wholesale top-up endpoints for your website, app or Telegram bot, please contact our support team.</p>
    `
  }
};

function openLegalModal(type) {
  const doc = LEGAL_TEXTS[type] || LEGAL_TEXTS.terms;
  document.getElementById('legalModalTitle').innerText = doc.title;
  document.getElementById('legalModalBody').innerHTML = doc.content;
  document.getElementById('legalModal').classList.add('active');
}

function closeLegalModal() {
  document.getElementById('legalModal').classList.remove('active');
}

// Müştəri Nəzarətçisini Başlat
window.addEventListener('DOMContentLoaded', () => {
  initUserSession();
  applyLanguage(currentLanguage);
  fetchUserProfile();
  fetchSettings();
  fetchProducts();
});

// ==========================================================================
// DEVELOPER SIGNATURE EASTER EGG (@HUSNUTECH)
// ==========================================================================
(function initDevSignature() {
  // 1. DevTools Giant Cinema Theater ASCII Art (Netflix Style)
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
  } catch (_) { }

  // 2. Secret Keystroke Listener ("husnu" or "dev")
  let secretBuffer = '';
  const SECRET_KEYS = ['husnu', 'dev'];

  // Futuristic Web Audio Synthesizer Chime (0 audio files needed, pure browser synthesis)
  function playCyberChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1: 523.25 Hz (C5) -> Note 2: 783.99 Hz (G5) -> Note 3: 1046.50 Hz (C6)
      const freqs = [523.25, 783.99, 1046.50];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.05, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.42);
      });
    } catch (_) {}
  }

  function triggerCyberBurst() {
    // 1. Ekran üzərində kibernetik dalğa və qığılcım effekti
    const burst = document.createElement('div');
    burst.className = 'dev-cyber-burst';
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 800);

    // 2. Kibernetik Hologram Səsi
    playCyberChime();

    // 3. Modalı Aç
    openDevModal();
  }

  window.addEventListener('keydown', (e) => {
    // Input və ya textarea içində yazarkən işə düşməsin
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) {
      return;
    }

    if (e.key === 'Escape') {
      closeDevModal();
      return;
    }

    if (e.key && e.key.length === 1) {
      secretBuffer = (secretBuffer + e.key.toLowerCase()).slice(-10);
      for (const secret of SECRET_KEYS) {
        if (secretBuffer.endsWith(secret)) {
          secretBuffer = '';
          triggerCyberBurst();
          break;
        }
      }
    }
  });

  // 3. Mobile / Desktop Triple-Tap Listener on Logo (Loqoya 3 dəfə cəld basanda açılır)
  let logoTapCount = 0;
  let logoTapTimer = null;

  function handleLogoTap(e) {
    const brandEl = e.target && e.target.closest ? e.target.closest('.brand-wrapper, #mainBrandLogo, .brand-logo-img, .brand-headings, .footer-brand, .nav-brand') : null;
    if (brandEl) {
      logoTapCount++;
      if (logoTapCount >= 3) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        logoTapCount = 0;
        if (logoTapTimer) clearTimeout(logoTapTimer);
        triggerCyberBurst();
        return false;
      }

      if (logoTapTimer) clearTimeout(logoTapTimer);
      logoTapTimer = setTimeout(() => {
        if (logoTapCount === 1) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        logoTapCount = 0;
      }, 500);
    }
  }

  document.addEventListener('click', handleLogoTap, true);
  document.addEventListener('touchend', handleLogoTap, { passive: false });

  window.openDevModal = openDevModal;

  function openDevModal() {
    let modal = document.getElementById('devSignatureModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'devSignatureModal';
      modal.innerHTML = `
        <div class="dev-modal-overlay" onclick="closeDevModal()"></div>
        <div class="dev-modal-box">
          <button class="dev-close-btn" onclick="closeDevModal()" aria-label="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          
          <div class="dev-avatar-wrapper">
            <div class="dev-avatar-glow"></div>
            <div class="dev-avatar-core">
              <img src="https://t.me/i/userpic/320/HusnuTech.jpg" alt="@HUSNUTECH" class="dev-avatar-img" onerror="this.onerror=null; this.src='https://t.me/i/userpic/160/HusnuTech.jpg';">
            </div>
          </div>

          <div class="dev-header-row">
            <h2 class="dev-title">@HUSNUTECH</h2>
            <span class="dev-verified-badge" title="Verified Architect">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M12 2l2.6 3.2 4.1-.2.8 4 3.7 1.8-1.5 3.8 2.2 3.5-3.6 2-1.1 4-4.1-.7L12 22l-2.6-1.4-4.1.7-1.1-4-3.6-2 2.2-3.5L1.3 8.8 5 7l.8-4 4.1.2L12 2z" fill="#6366f1"/>
                <path d="M8.5 12l2.5 2.5 5-5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>

          <p class="dev-subtitle">Senior Full-Stack & Telegram Bot Developer</p>

          <div class="dev-meta-tags">
            <span class="dev-tag">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              TypeScript & Node.js
            </span>
            <span class="dev-tag">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              Telegram Bot Ecosystems
            </span>
            <span class="dev-tag">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              High-Load Architecture
            </span>
          </div>

          <div class="dev-contacts">
            <a href="https://wa.me/994772117011" target="_blank" class="dev-btn dev-btn-wp" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.477-.15-.678.15-.2.301-.778.978-.954 1.179-.176.2-.352.226-.653.075-1.528-.767-2.529-1.365-3.535-3.097-.264-.454.264-.421.756-1.405.083-.166.042-.312-.021-.438-.063-.125-.678-1.633-.929-2.238-.244-.59-.493-.51-.678-.519-.176-.008-.377-.01-.578-.01-.2 0-.527.075-.803.376s-1.055 1.03-1.055 2.511 1.08 2.912 1.231 3.113c.15.2 2.126 3.246 5.151 4.553 2.517 1.088 3.031.871 3.583.821.552-.05 1.78-.728 2.031-1.431.251-.703.251-1.305.176-1.431-.075-.126-.276-.201-.577-.351zM12.042 21.908a9.83 9.83 0 0 1-5.019-1.378l-.36-.214-3.731.979.996-3.637-.235-.374a9.86 9.86 0 0 1-1.51-5.26C2.184 6.55 6.604 2.13 12.046 2.13a9.87 9.87 0 0 1 6.98 2.89 9.87 9.87 0 0 1 2.89 6.98c0 5.474-4.444 9.908-9.874 9.908z"/>
              </svg>
              <span>WhatsApp: +994 77 211 70 11</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="dev-arrow-icon"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
            </a>

            <a href="https://t.me/HusnuTech" target="_blank" class="dev-btn dev-btn-tg" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              <span>Telegram: @HusnuTech</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="dev-arrow-icon"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
            </a>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.classList.add('active');
  }

  window.closeDevModal = function () {
    const modal = document.getElementById('devSignatureModal');
    if (modal) modal.classList.remove('active');
  };
})();
