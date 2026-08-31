import { SupportedLanguage, TranslationStrings } from './types.js';
import { az } from './az.js';
import { ru } from './ru.js';
import { en } from './en.js';
import { tr } from './tr.js';
import { db } from '../database/db.js';

export * from './types.js';

export const translations: Record<SupportedLanguage, TranslationStrings> = {
  az,
  ru,
  en,
  tr,
};

export function getUserLanguage(telegramId: string | number): SupportedLanguage {
  const tgIdStr = telegramId.toString();
  try {
    const row = db.prepare(`SELECT language FROM users WHERE telegram_id = ?`).get(tgIdStr) as { language?: string } | undefined;
    if (row && row.language && ['az', 'ru', 'en', 'tr'].includes(row.language)) {
      return row.language as SupportedLanguage;
    }
  } catch (e) {}
  return 'az';
}

export function setUserLanguage(telegramId: string | number, lang: SupportedLanguage): boolean {
  const tgIdStr = telegramId.toString();
  try {
    const stmt = db.prepare(`UPDATE users SET language = ?, language_chosen = 1 WHERE telegram_id = ?`);
    const res = stmt.run(lang, tgIdStr);
    return res.changes > 0;
  } catch (e) {
    try {
      const stmt = db.prepare(`UPDATE users SET language = ? WHERE telegram_id = ?`);
      const res = stmt.run(lang, tgIdStr);
      return res.changes > 0;
    } catch (e2) {
      console.error('setUserLanguage error:', e2);
      return false;
    }
  }
}

export function getT(telegramId: string | number): TranslationStrings {
  const lang = getUserLanguage(telegramId);
  return translations[lang] || translations.az;
}
