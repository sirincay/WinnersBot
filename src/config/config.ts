import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  botUsername: process.env.BOT_USERNAME || 'WS_StoreBot',
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID || '',
  logChannelId: process.env.LOG_CHANNEL_ID || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminWhitelistIps: (process.env.ADMIN_WHITELIST_IPS || '').split(',').map(s => s.trim()).filter(Boolean),
  fazerCards: {
    baseUrl: process.env.FAZERCARDS_BASE_URL || 'https://api.fzr.cards/api/v2',
    apiKey: process.env.FAZERCARDS_API_KEY || process.env.FAZER_API_KEY || 'fc_eb9eea253d224b931a44d880',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    webAppUrl: process.env.WEB_APP_URL || 'https://wsstore.pro',
  },
  payment: {
    defaultUsdAznRate: parseFloat(process.env.DEFAULT_USD_AZN_RATE || '1.70'),
    defaultMarginPercent: parseFloat(process.env.DEFAULT_MARGIN_PERCENT || '10'),
    binancePayId: process.env.BINANCE_PAY_ID || '',
    m10Number: process.env.M10_NUMBER || '',
    bankCardNumber: process.env.BANK_CARD_NUMBER || '',
    bankCardHolder: process.env.BANK_CARD_HOLDER || '',
  },
  binance: {
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
  },
  paths: {
    dbPath: path.resolve(process.cwd(), 'database.sqlite'),
    uploadsDir: path.resolve(process.cwd(), 'uploads'),
  }
};
