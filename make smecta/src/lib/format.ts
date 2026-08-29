import type { Locale } from '../types/content';

const intlLocale: Record<Locale, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  ar: 'ar-DZ',
};

export function formatMonthYear(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

export function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

export function isClosingSoon(deadline: string | null) {
  if (!deadline) return false;
  const days = (new Date(`${deadline}T23:59:59`).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 7;
}

export function isPast(deadline: string | null) {
  return Boolean(deadline && new Date(`${deadline}T23:59:59`).getTime() < Date.now());
}
