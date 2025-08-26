import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// importa JSON (Vite permite import de JSON)
import ptCommon from '../locales/pt/common.json';
import esCommon from '../locales/es/common.json';
import enCommon from '../locales/en/common.json';
import deCommon from '../locales/de/common.json';
import frCommon from '../locales/fr/common.json';
import itCommon from '../locales/it/common.json';
import zhHansCommon from '../locales/zh-Hans/common.json'; // 简体中文
import zhHantCommon from '../locales/zh-Hant/common.json'; // 繁體中文
import jaCommon from '../locales/ja/common.json';
import koCommon from '../locales/ko/common.json';

function normalizeZh(lng = '') {
  const L = lng.toLowerCase();
  if (L === 'zh' || L.startsWith('zh-cn') || L.startsWith('zh-sg') || L.startsWith('zh-hans'))
    return 'zh-Hans'; // Simplificado
  if (L.startsWith('zh-tw') || L.startsWith('zh-hk') || L.startsWith('zh-mo') || L.startsWith('zh-hant'))
    return 'zh-Hant'; // Tradicional
  return lng;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { common: ptCommon },
      es: { common: esCommon },
      en: { common: enCommon },
      de: { common: deCommon },
      fr: { common: frCommon },
      it: { common: itCommon },
      'zh-Hans': { common: zhHansCommon },
      'zh-Hant': { common: zhHantCommon },
      ja: { common: jaCommon },
      ko: { common: koCommon }      
    },
    supportedLngs: ['pt','es','en','de','fr','it','zh-Hans','zh-Hant','ja','ko'],
    fallbackLng: 'pt',
    ns: ['common'],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      cleanCode: true
    },
    // aceita 'en-US' / 'es-AR' etc. quando 'en'/'es' estão em supportedLngs
    nonExplicitSupportedLngs: true,
    // usa somente o código de idioma (ignora região) ao carregar
    load: 'currentOnly',
    nonExplicitSupportedLngs: false,
    interpolation: { escapeValue: false }
  });

// Normaliza detecções do navegador (ex.: zh-CN -> zh-Hans) só uma vez
const detected = i18n.language;
const normalized = normalizeZh(detected);
if (normalized !== detected) {
  i18n.changeLanguage(normalized);
}

// Sincroniza <html lang="...">
i18n.on('languageChanged', (lng) => {
  const norm = normalizeZh(lng);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = norm;
  }
});

export default i18n;
