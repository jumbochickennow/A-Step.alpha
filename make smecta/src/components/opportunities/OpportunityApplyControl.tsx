import { ArrowUpRight, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../hooks/useLocale';
import { formatDate, isFuture, isPast } from '../../lib/format';
import type { LocalizedOpportunity } from '../../types/content';

/**
 * Truthful Apply control shared by OpportunityCard and FeaturedOpportunity.
 *
 * `applyUrl` is null for every opportunity today (no source URL has been
 * entered in the admin dashboard yet) — rendering a disabled button still
 * labelled "Apply now" claims an action exists when it does not, and the
 * previous disabled styling (solid white pill, same shape as the live CTA)
 * was easy to mistake for a working button. When there is no real link this
 * renders a plain, visually distinct, non-interactive status line instead:
 * never a fake link, never button semantics implying something clickable.
 */
export function OpportunityApplyControl({
  opportunity,
  linkClassName,
  withIcon = false,
}: {
  opportunity: LocalizedOpportunity;
  /** Exact classes for the real <a> link, to match each card's existing look. */
  linkClassName: string;
  /** OpportunityCard's compact link carries a trailing arrow icon; Featured's does not. */
  withIcon?: boolean;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const past = isPast(opportunity.deadline);

  if (opportunity.applyUrl && !past) {
    return (
      <a
        href={opportunity.applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t('opportunities.apply')} — ${opportunity.title}`}
        className={linkClassName}
      >
        {t('opportunities.apply')}
        {withIcon ? (
          <ArrowUpRight size={14} aria-hidden="true" className="transition-transform duration-200 rtl:-scale-x-100 ltr:group-hover/apply:translate-x-0.5 rtl:group-hover/apply:-translate-x-0.5" />
        ) : null}
      </a>
    );
  }

  const label = past
    ? t('opportunities.deadlinePassed')
    : isFuture(opportunity.opensAt)
      ? t('opportunities.openingSoon', { date: formatDate(opportunity.opensAt as string, locale) })
      : t('opportunities.applyUnavailable');

  return (
    <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-white/25 bg-transparent px-5 text-xs font-medium text-ink-subtle">
      <Clock3 size={13} aria-hidden="true" />
      <bdi>{label}</bdi>
    </span>
  );
}
