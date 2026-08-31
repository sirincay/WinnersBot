import fs from 'fs';
import path from 'path';

const files = [
  './src/bot/bot.ts',
  './src/bot/handlers.ts',
  './src/bot/menus.ts',
  './src/bot/emojis.ts'
];

const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

const foundEmojis = new Map();

for (const file of files) {
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      const matches = line.match(emojiRegex);
      if (matches) {
        matches.forEach(m => {
          if (!foundEmojis.has(m)) {
            foundEmojis.set(m, []);
          }
          foundEmojis.get(m).push({
            file: path.basename(file),
            line: idx + 1,
            text: line.trim()
          });
        });
      }
    });
  }
}

console.log('Total unique emoji characters found:', foundEmojis.size);
for (const [emoji, occurrences] of foundEmojis.entries()) {
  const sample = occurrences[0];
  console.log(`Emoji: "${emoji}" | Count: ${occurrences.length} | Sample: [${sample.file}:${sample.line}] ${sample.text}`);
}
