const https = require('https');
const http = require('http');
const fs = require('fs');

const targets = {
  'freefire_link.png': 'https://www.vecteezy.com/png/67565504-free-fire-logo-rounded-square-icon',
  'roblox_link.png': 'https://crystalpng.com/product/roblox-logo/',
  'mlbb_link.png': 'https://www.freepnglogos.com/pics/logo-mobile-legend',
  'brawlstars_link.png': 'https://www.vecteezy.com/png/27127558-brawl-stars-logo-png-brawl-stars-icon-transparent-png',
  'steam_link.png': 'https://www.lootbar.com/gift-card/steam-gift-card-my',
  'telegram_stars_link.png': 'https://stock.adobe.com/images/telegram-premium-messenger-account-icon-guaranteed-and-approved-profile-sign-flying-star-badge-top-rated-page-logo-profile-with-subscription-trusted-person-in-internet-vector-illustration/533753588',
  'telegram_premium_link.png': 'https://livecards.net/en/telegram-premium-12-months-subscription'
};

function fetchPage(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) {
          const u = new URL(url);
          loc = u.origin + loc;
        }
        return fetchPage(loc).then(resolve);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function downloadBinary(url, dest) {
  return new Promise(resolve => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': url
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBinary(res.headers.location, dest).then(resolve);
      }
      if (res.statusCode === 200) {
        const stream = fs.createWriteStream(dest);
        res.pipe(stream);
        stream.on('finish', () => { stream.close(); resolve(true); });
      } else {
        resolve(false);
      }
    }).on('error', () => resolve(false));
  });
}

(async () => {
  for (const [dest, pageUrl] of Object.entries(targets)) {
    const html = await fetchPage(pageUrl);
    const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) ||
                    html.match(/content="([^"]+)"\s+property="og:image"/i) ||
                    html.match(/name="twitter:image"\s+content="([^"]+)"/i);
    
    if (ogMatch && ogMatch[1]) {
      let imgUrl = ogMatch[1];
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      console.log(dest, 'FOUND:', imgUrl);
      const ok = await downloadBinary(imgUrl, 'public/images/' + dest);
      console.log(dest, ok ? 'SUCCESS' : 'FAILED');
    } else {
      console.log(dest, 'NO META IMAGE in page, length:', html.length);
    }
  }
})();
