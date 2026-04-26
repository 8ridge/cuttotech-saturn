import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';
import urTranslation from './locales/ur/translation.json';
import ptTranslation from './locales/pt/translation.json';
import huTranslation from './locales/hu/translation.json';
import bgTranslation from './locales/bg/translation.json';
import esTranslation from './locales/es/translation.json';
import frTranslation from './locales/fr/translation.json';

// Get saved language from localStorage or default to 'en'
const getSavedLanguage = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cuttech_language');
    if (saved) {
      return saved;
    }
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
      ur: {
        translation: urTranslation,
      },
      pt: {
        translation: ptTranslation,
      },
      hu: {
        translation: huTranslation,
      },
      bg: {
        translation: bgTranslation,
      },
      es: {
        translation: esTranslation,
      },
      fr: {
        translation: frTranslation,
      },
    },
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });

// Save language to localStorage when it changes
i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cuttech_language', lng);
  }
});

export default i18n;



