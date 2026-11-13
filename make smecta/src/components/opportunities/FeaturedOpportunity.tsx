import { useTranslation } from 'react-i18next';
import { useLocale } from '../../hooks/useLocale';
import { formatDate, isClosingSoon } from '../../lib/format';
import type { LocalizedOpportunity } from '../../types/content';
import { OpportunityApplyControl } from './OpportunityApplyControl';
import { OpportunityVisual } from './OpportunityVisual';

export function FeaturedOpportunity({ opportunity }: { opportunity: LocalizedOpportunity }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const closingSoon = isClosingSoon(opportunity.deadline);
  return (
    <article>
      <div className="aspect-[16/9] min-w-0 overflow-hidden rounded-xl sm:aspect-[3/1] lg:aspect-[4.75/1]"><OpportunityVisual country={opportunity.country} imagePath={opportunity.imagePath} priority /></div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {closingSoon ? (
          <span className="pill-urgent inline-flex items-center rounded-full bg-[rgb(255_94_89/0.15)] px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-brand-coral">
            {t('opportunities.closingSoon')}
          </span>
        ) : null}
        <p className="text-[0.65rem] text-ink-subtle"><bdi>{opportunity.deadline ? formatDate(opportunity.deadline, locale) : t('common.comingSoon')}</bdi></p>
      </div>
      <h2 className="mt-3 text-2xl font-bold leading-tight">{opportunity.title}</h2>
      <p className="mt-3 max-w-4xl text-sm leading-relaxed text-ink-subtle">{opportunity.description}</p>
      <div className="mt-5">
        <OpportunityApplyControl
          opportunity={opportunity}
          linkClassName="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
        />
      </div>
    </article>
  );
}
