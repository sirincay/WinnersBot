const https = require('https');
const fs = require('fs');

https.get('https://www.freepnglogos.com/pics/logo-mobile-legend', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const pngs = (d.match(/https:\/\/www\.freepnglogos\.com\/uploads\/logo-mobile-legend-png\/[^\"]+\.png/g) || []);
    console.log('PNGs found:', pngs);
    if (pngs.length > 0) {
      https.get(pngs[0], { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
        r.pipe(fs.createWriteStream('public/images/mlbb_link.png'));
        r.on('finish', () => console.log('MLBB PNG DOWNLOADED SUCCESSFULLY'));
      });
    }
  });
});
