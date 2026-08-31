# 🚀 Ubuntu 22.04 Server Üçün Yükləmə Təlimatı (Deployment Guide)

WinnersBot layihəsini Windows-dan (Localhost) real **Ubuntu 22.04** serverinə (VPS) köçürmək və 7/24 problemsiz işlətmək üçün aşağıdakı addımları ardıcıllıqla icra edin.

> QEYD: Domen adınızı qeyd etməyi unutmusunuz. Ona görə konfiqurasiyalarda `wsstore.pro` yazmışam. Kodu icra edərkən bunu öz real domeninizlə əvəz edin.

---

## 1. Serverin Hazırlanması (Tələb olunan proqramların qurulması)
Ubuntu serverinizə SSH ilə daxil olun (məs: `ssh root@server_ip`) və bu komandaları işlədin:

```bash
# Sistemi yeniləyin
sudo apt update && sudo apt upgrade -y

# Node.js (v20), npm və Nginx yükləyin
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx

# PM2 (Proqramın 7/24 açıq qalması üçün) və Typescript yükləyin
sudo npm install -g pm2 typescript
```

## 2. Layihənin Serverə Köçürülməsi
Layihə qovluğunu (WinnersBot) serverdə `/var/www/` daxilinə köçürün (FileZilla və ya GitHub vasitəsilə).

```bash
# Layihə qovluğuna daxil olun
cd /var/www/WinnersBot

# Asılılıqları yükləyin
npm install

# TypeScript kodlarını build edin (JavaScript-ə çevirin)
npm run build
```

## 3. `.env` Faylının Düzəldilməsi
Serverdə `.env` faylını açın (`nano .env`) və `WEB_APP_URL` dəyərini domeninizlə dəyişin:
```env
PORT=3050
WEB_APP_URL=https://wsstore.pro
```

## 4. PM2 ilə Botun İşə Salınması
Botun arxa planda dayanmadan işləməsi üçün:

```bash
pm2 start dist/index.js --name "winnersbot"
pm2 save
pm2 startup
```

## 5. Nginx və Domen Bağlantısı (Reverse Proxy)
Sizin Node.js serveriniz `3050` portunda işləyir. İnsanların `https://domen.com` yazaraq daxil olması üçün Nginx konfiqurasiyası etməliyik.

```bash
sudo nano /etc/nginx/sites-available/winnersbot
```
Açılan pəncərəyə aşağıdakı kodu yapışdırın (Domeninizi dəyişin!):

```nginx
server {
    listen 80;
    server_name wsstore.pro;

    location / {
        proxy_pass http://localhost:3050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Nginx-i aktivləşdirin:
```bash
sudo ln -s /etc/nginx/sites-available/winnersbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. Pulsuz SSL Sertifikatı (HTTPS / Kilid İşarəsi)
Teleqram Webhook və Admin panelin etibarlı işləməsi üçün domeninizdə mütləq HTTPS olmalıdır.

```bash
# Certbot yükləyin
sudo apt install -y certbot python3-certbot-nginx

# SSL Sertifikatı alın (Komandanı işlədəndə emailinizi və domen adınızı yazacaqsınız)
sudo certbot --nginx -d wsstore.pro
```

Bütün bu addımları bitirdikdən sonra, botunuz HTTPS üzərindən etibarlı (SSL) şəkildə fasiləsiz işləyəcək. Telegram Webhook da birbaşa serverə yönləndirilmiş olacaq.
