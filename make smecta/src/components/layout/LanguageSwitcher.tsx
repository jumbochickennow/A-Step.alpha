import { useTranslation } from 'react-i18next';
import { useLocale } from '../../hooks/useLocale';
import { localeNames, LOCALES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { track } from '../../services/analytics';
import type { Locale } from '../../types/content';

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, changeLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label={t('nav.language')}
      className="navbar-languages inline-flex h-11 items-center rounded-full bg-brand-coral p-1 text-xs font-bold text-white shadow-sm"
    >
      {LOCALES.map((item) => {
        const active = locale === item;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={active}
            aria-label={`${t('nav.language')}: ${localeNames[item]}`}
            onClick={() => {
              if (item === locale) return;
              track('language_switch', { from: locale, to: item });
              changeLocale(item as Locale);
            }}
            className={cn(
              'grid size-9 place-items-center rounded-full transition-colors',
              active && 'bg-white text-brand-blue',
            )}
          >
            {localeNames[item]}
          </button>
        );
      })}
    </div>
  );
}
