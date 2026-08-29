import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../hooks/useLocale';
import { formatDate, isPast } from '../../lib/format';
import { whatsappHrefFor } from '../../lib/constants';
import type { LocalizedOpportunity } from '../../types/content';
import { OpportunityVisual } from './OpportunityVisual';

export function OpportunityCard({ opportunity }: { opportunity: LocalizedOpportunity }) {
  const { t, i18n } = useTranslation();
  const { locale } = useLocale();
  const past = isPast(opportunity.deadline);
  const inquiryHref = whatsappHrefFor({
    type: 'opportunity',
    title: opportunity.title,
    locale: (i18n.resolvedLanguage as typeof locale) ?? locale,
  });
  const inquireLabel = t('opportunities.askWhatsapp');
  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none">
      <div className="group aspect-[3/2] overflow-hidden rounded-xl border border-transparent transition-colors duration-300 group-hover:border-primary/40"><div className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-105"><OpportunityVisual country={opportunity.country} imagePath={opportunity.imagePath} slug={opportunity.slug} /></div></div>
      <p className="mt-4 text-[0.65rem] text-ink-subtle"><bdi>{opportunity.deadline ? formatDate(opportunity.deadline, locale) : t('common.comingSoon')}</bdi></p>
      <h2 className="mt-3 text-lg font-bold leading-tight">{opportunity.title}</h2>
      <p className="line-clamp-2 mt-3 text-xs leading-5 text-ink-subtle">{opportunity.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        {opportunity.applyUrl && !past ? (
          <a href={opportunity.applyUrl} target="_blank" rel="noopener noreferrer" className="group/apply inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-5 text-xs font-semibold text-slate-800 transition-colors duration-200 hover:bg-slate-100">{t('opportunities.apply')}<ArrowUpRight size={14} aria-hidden="true" className="transition-transform duration-200 rtl:-scale-x-100 ltr:group-hover/apply:translate-x-0.5 rtl:group-hover/apply:-translate-x-0.5" /></a>
        ) : (
          <button type="button" disabled className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-xs font-semibold text-slate-500">{t('opportunities.apply')}</button>
        )}
        {/* Contextual conversion funnel: pre-filled inquiry for this opportunity. */}
        <a
          href={inquiryHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${inquireLabel}: ${opportunity.title}`}
          className="group/wa inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong px-4 text-xs font-semibold text-ink-muted transition-colors duration-200 hover:border-[#25D366] hover:text-[#25D366]"
        >
          <MessageCircle size={14} aria-hidden="true" className="transition-transform duration-200 group-hover/wa:scale-110" />
          {inquireLabel}
        </a>
      </div>
    </article>
  );
}
