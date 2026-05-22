import viRaw from '../locales/vi.txt?raw';
import enRaw from '../locales/en.txt?raw';

export type Lang = 'vi' | 'en';
type Dict = Record<string, string>;

const STORAGE_KEY = 'app_lang';

function parseLocale(raw: string): Dict {
  try {
    return JSON.parse(raw) as Dict;
  } catch {
    return {};
  }
}

const messages: Record<Lang, Dict> = {
  vi: parseLocale(viRaw),
  en: parseLocale(enRaw),
};

export function getCurrentLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'vi' || saved === 'en') return saved;

  localStorage.setItem(STORAGE_KEY, 'vi');
  return 'vi';
}

export function setCurrentLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

export function t(key: string, lang: Lang = getCurrentLang()): string {
  return messages[lang][key] ?? messages.vi[key] ?? key;
}