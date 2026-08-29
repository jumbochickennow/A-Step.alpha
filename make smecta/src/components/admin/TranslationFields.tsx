import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { SUPPORTED_LOCALES } from '../../lib/constants';
import type { Locale, LocalizedCopy } from '../../types/content';

interface TranslationFieldsProps<T extends LocalizedCopy = LocalizedCopy> {
  /** Localized values for every supported locale — strictly keyed, no loose records. */
  value: Record<Locale, T>;
  active: Locale;
  onActiveChange: (locale: Locale) => void;
  onChange: (value: Record<Locale, T>) => void;
}

export function TranslationFields<T extends LocalizedCopy = LocalizedCopy>({ value, active, onActiveChange, onChange }: TranslationFieldsProps<T>) {
  const { t } = useTranslation();
  const update = (field: keyof T, text: string) => onChange({
    ...value,
    [active]: { ...value[active], [field]: text },
  } as Record<Locale, T>);
  return (
    <fieldset className="rounded-lg border border-border p-4">
      <legend className="px-2 text-sm font-semibold">EN · FR · AR</legend>
      <div className="flex gap-2" role="tablist">
        {SUPPORTED_LOCALES.map((locale) => <button key={locale} type="button" role="tab" aria-selected={active === locale} onClick={() => onActiveChange(locale)} className={cn('min-h-11 rounded-md border px-4 text-sm font-semibold', active === locale ? 'border-brand-blue bg-brand-blue text-white' : 'border-border-strong text-ink-muted')}>{locale.toUpperCase()}</button>)}
      </div>
      <div className="mt-5" dir={active === 'ar' ? 'rtl' : 'ltr'}>
        <label className="mb-2 block text-sm font-semibold" htmlFor={`translation-title-${active}`}>{t('admin.titleLabel')}</label>
        <input id={`translation-title-${active}`} className="field" value={value[active].title} onChange={(event) => update('title', event.target.value)} required />
        <label className="mb-2 mt-4 block text-sm font-semibold" htmlFor={`translation-description-${active}`}>{t('admin.descriptionLabel')}</label>
        <textarea id={`translation-description-${active}`} className="field min-h-28" value={value[active].description} onChange={(event) => update('description', event.target.value)} required />
      </div>
    </fieldset>
  );
}
