import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

export const initializeLocalization = async (resources: any, lng: string = 'en') => {
  await i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });
};

export const changeLanguage = (lng: string) => {
  i18next.changeLanguage(lng);
};

export const t = (key: string, options?: any) => {
  return i18next.t(key, options);
};
