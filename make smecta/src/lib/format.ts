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

export function isPast(deadline: string | null) {
  return Boolean(deadline && new Date(`${deadline}T23:59:59`).getTime() < Date.now());
}

/** True when the given ISO date has not started yet (used to gate opensAt-based copy). */
export function isFuture(date: string | null) {
  return Boolean(date && new Date(`${date}T00:00:00`).getTime() > Date.now());
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * True when the deadline is still upcoming but falls within the next 7
 * calendar days (README's documented closing-soon window). Compares
 * midnight-to-midnight rather than "now" against the deadline's end-of-day
 * cutoff — the latter makes the result depend on what time of day it is
 * checked (a deadline exactly 7 days out would read as 7.99 or 7.01 "days
 * left" depending on the clock, missing the boundary most of the day).
 */
export function isClosingSoon(deadline: string | null) {
  if (!deadline || isPast(deadline)) return false;
  const deadlineMidnight = new Date(`${deadline}T00:00:00`).getTime();
  const todayMidnight = new Date(new Date().toDateString()).getTime();
  const daysLeft = Math.round((deadlineMidnight - todayMidnight) / MS_PER_DAY);
  return daysLeft <= 7;
}
