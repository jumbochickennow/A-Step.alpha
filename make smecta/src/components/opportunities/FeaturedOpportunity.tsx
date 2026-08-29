import { useTranslation } from 'react-i18next';
import { useLocale } from '../../hooks/useLocale';
import { formatDate } from '../../lib/format';
import type { LocalizedOpportunity } from '../../types/content';
import { OpportunityVisual } from './OpportunityVisual';

export function FeaturedOpportunity({ opportunity }: { opportunity: LocalizedOpportunity }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  return (
    <article>
      <div className="aspect-[16/9] min-w-0 overflow-hidden rounded-xl sm:aspect-[3/1] lg:aspect-[4.75/1]"><OpportunityVisual country={opportunity.country} imagePath={opportunity.imagePath} slug={opportunity.slug} priority /></div>
      <p className="mt-4 text-[0.65rem] text-ink-subtle"><bdi>{opportunity.deadline ? formatDate(opportunity.deadline, locale) : t('common.comingSoon')}</bdi></p>
      <h2 className="mt-3 text-2xl font-bold leading-tight">{opportunity.title}</h2>
      <p className="mt-3 max-w-4xl text-sm leading-relaxed text-ink-subtle">{opportunity.description}</p>
      {opportunity.applyUrl ? <a href={opportunity.applyUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-xs font-semibold text-slate-800 hover:bg-slate-100">{t('opportunities.apply')}</a> : <button disabled className="mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-xs font-semibold text-slate-500">{t('opportunities.apply')}</button>}
    </article>
  );
}
