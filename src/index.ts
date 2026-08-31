import { initDatabase } from './database/db.js';
import { createServer } from './server/server.js';
import { createBot } from './bot/bot.js';
import { config } from './config/config.js';
import { fazerCardsService } from './services/fazercards.service.js';
import { orderService } from './services/order.service.js';
import { upstreamSyncService } from './services/upstream-sync.service.js';
import { loggerService } from './services/logger.service.js';
import { run } from '@grammyjs/runner';

async function bootstrap() {
  console.log('----------------------------------------------------');
  console.log('🚀 WINNERS SHOP — GAME TOP-UP & BOT ECOSYSTEM');
  console.log('----------------------------------------------------');

  // 1. SQLite Verilənlər Bazasını Başlat
  initDatabase();

  // 2. Telegram Botunu Başlat
  let bot: any = null;
  if (config.botToken && config.botToken !== 'YOUR_BOT_TOKEN_HERE') {
    bot = createBot();
    loggerService.setBot(bot);

    bot.api.getMe().then((botInfo: any) => {
      console.log(`🤖 Telegram Botu aktivdir: @${botInfo.username} (ID: ${botInfo.id})`);
      console.log('----------------------------------------------------');
    }).catch((e: any) => {
      console.warn('Bot getMe xətası:', e.message);
    });

    const startBotRunner = async () => {
      try {
        // Bot oflayn olarkən toplanmış bütün növbəli Telegram server yeniləmələrini ləğv et
        await bot.api.deleteWebhook({ drop_pending_updates: true }).catch(() => {});

        const runner = run(bot, {
          runner: {
            fetch: {
              allowed_updates: ['message', 'callback_query', 'inline_query', 'chosen_inline_result'],
              timeout: 25,
            },
          },
        });

        runner.task()?.catch((err: any) => {
          console.error('Runner polling dayandı, 2 saniyə sonra yenidən başlayır:', err?.message || err);
          loggerService.sendErrorAlert('Grammy Bot Runner Polling', err);
          setTimeout(startBotRunner, 2000);
        });
      } catch (err: any) {
        console.error('Runner başlama xətası, 2 saniyə sonra təkrar cəhd edilir:', err?.message || err);
        loggerService.sendErrorAlert('Grammy Bot Runner Start Error', err);
        setTimeout(startBotRunner, 2000);
      }
    };

    startBotRunner();
  } else {
    console.log('ℹ️ BOT_TOKEN .env faylında təyin edilməyib.');
  }

  // 3. Veb Serveri Başlat
  const app = createServer();
  app.listen(config.server.port, '0.0.0.0', () => {
    console.log(`🌐 Veb Server aktivdir: http://localhost:${config.server.port} (http://127.0.0.1:${config.server.port})`);
    console.log(`👑 Veb Admin Paneli: http://localhost:${config.server.port}/admin.html`);
  });

  // 4. FazerCards API Bağlantısını Test Et
  try {
    const fazerBal = await fazerCardsService.getBalance();
    if (fazerBal.ok) {
      console.log(`✅ FazerCards API v2 Əlaqəsi Uğurludur: Balans: ${fazerBal.balance} ${fazerBal.currency}`);
    } else {
      console.warn(`⚠️ FazerCards API cavab vermədi:`, fazerBal);
    }
  } catch (err: any) {
    console.error('FazerCards API xətası:', err.message);
  }

  // Aktiv Keepalive və Arxa Plan Web Purchase İzləyicisi (Hər 15s yoxlayır)
  setInterval(() => {
    orderService.checkProcessingWebOrders().catch((e) => {
      console.error('Web Purchase poller xətası:', e.message);
      loggerService.sendErrorAlert('Web Purchase Poller', e);
    });
  }, 15000);

  // 5. Arxa planda kateqoriyaları əvvəlcədən yüklə
  fazerCardsService.fetchAllCategories().then(() => {
    console.log('📦 Bütün FazerCards məhsul və kateqoriyaları keşləndi.');
  }).catch((e) => {
    console.warn('Kateqoriyalar keşlənərkən xəta:', e.message);
  });

  // 6. Avtomatik Təchizatçı Sifarişlərini Sinxronlaşdır (FazerCards və PlayPin)
  upstreamSyncService.startAutoSync(2);
}

// Gözlənilməz çıxışların qarşısını almaq və log kanalına bildirmək üçün qlobal proses xəta idarəediciləri
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err.message || err);
  loggerService.sendErrorAlert('Node.js Uncaught Exception', err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('⚠️ Unhandled Rejection:', reason?.message || reason);
  loggerService.sendErrorAlert('Node.js Unhandled Rejection', reason);
});

bootstrap().catch((err) => {
  console.error('Fatal Başlanğıc Xətası:', err);
  loggerService.sendErrorAlert('Fatal Bootstrap Exception', err);
});
