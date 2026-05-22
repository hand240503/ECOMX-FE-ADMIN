import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { t as translate, getCurrentLang, setCurrentLang, type Lang } from '../utils/i18n';

type I18nContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(getCurrentLang());

  const setLang = useCallback((nextLang: Lang) => {
    setCurrentLang(nextLang);
    setLangState(nextLang);
  }, []);

  const t = useCallback((key: string) => translate(key, lang), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
};