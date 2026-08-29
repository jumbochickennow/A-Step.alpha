import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import i18n from '../i18n';
import { LOCALES } from '../lib/constants';
import type { Locale } from '../types/content';

export function localeFromPath(pathname: string): Locale {
  const first = pathname.split('/').filter(Boolean)[0];
  return first === 'fr' || first === 'ar' ? first : 'en';
}

export function localizedPath(path: string, locale: Locale) {
  const normalized = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return locale === 'en' ? normalized || '/' : `/${locale}${normalized || '/'}`;
}

export function useLocale() {
  const location = useLocation();
  const navigate = useNavigate();
  const locale = localeFromPath(location.pathname);

  useEffect(() => {
    const firstVisit = !localStorage.getItem('astep-locale');
    const isPublicUnprefixed = !location.pathname.startsWith('/admin') && locale === 'en';
    if (firstVisit && isPublicUnprefixed) {
      const detected = navigator.language.toLowerCase().split('-')[0] as Locale;
      if (detected === 'fr' || detected === 'ar') {
        localStorage.setItem('astep-locale', detected);
        navigate(localizedPath(`${location.pathname}${location.search}${location.hash}`, detected), { replace: true });
        return;
      }
    }
    localStorage.setItem('astep-locale', locale);
    void i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale, location.hash, location.pathname, location.search, navigate]);

  const changeLocale = (next: Locale) => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (LOCALES.includes(parts[0] as Locale) && parts[0] !== 'en') parts.shift();
    const cleanPath = `/${parts.join('/')}`;
    localStorage.setItem('astep-locale', next);
    navigate(`${localizedPath(cleanPath || '/', next)}${location.search}${location.hash}`);
  };

  return { locale, changeLocale };
}
