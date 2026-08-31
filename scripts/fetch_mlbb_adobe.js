const https = require('https');
const fs = require('fs');

async function get(url) {
  return new Promise(res => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(d));
    });
  });
}

function downloadBinary(url, dest) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
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
  const html = await get('https://www.freepnglogos.com/pics/logo-mobile-legend');
  const regex = /https:\/\/[^"]+mobile-legend[^"]+\.png/gi;
  const matches = html.match(regex) || [];
  console.log('MLBB Matches:', matches);
  
  if (matches.length > 0) {
    const ok = await downloadBinary(matches[0], 'public/images/mlbb_link.png');
    console.log('MLBB DOWNLOAD:', ok ? 'SUCCESS' : 'FAILED');
  }

  // Telegram Ulduzları: Adobe Stock 533753588-ə uyğun dəqiq vektor əsəri axtarışı (Qızıl Ulduz Nişanlı Telegram Mavi Dairəsi)
  const tgStarsUrls = [
    'https://telegram.org/file/464001479/1/tO3Fm_2V2eA.227446.png/275338ecb2f293cfeb',
    'https://img.freepik.com/premium-vector/telegram-stars-coin-golden-star-blue-gradient-background_56104-2099.jpg',
    'https://cdn.iconscout.com/icon/free/png-512/free-telegram-logo-icon-download-in-svg-png-gif-file-formats--messaging-app-social-media-pack-logos-icons-3215367.png'
  ];

  for (const u of tgStarsUrls) {
    const ok = await downloadBinary(u, 'public/images/telegram_stars_link.png');
    if (ok) { console.log('TG STARS DOWNLOAD SUCCESS from', u); break; }
  }
})();
