import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import so from './locales/so.json';

const savedSettings = localStorage.getItem('app_user_settings');
let defaultLang = 'en';
try {
  if (savedSettings) {
    const parsed = JSON.parse(savedSettings);
    if (parsed.language) defaultLang = parsed.language;
  }
} catch {}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    fr: { translation: fr },
    es: { translation: es },
    so: { translation: so },
  },
  lng: defaultLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Update document direction for RTL languages
const updateDirection = (lng: string) => {
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
};
updateDirection(defaultLang);
i18n.on('languageChanged', updateDirection);

export default i18n;
