import seedContent from '../data/content.json';
import { fallbackOpportunities } from '../data/fallback';
import { isPast } from '../lib/format';
import type { Locale, LocalizedOpportunity, Opportunity, OpportunityCategory, OpportunityStatus } from '../types/content';
import { apiJson } from './api-client';

const seededOpportunities = seedContent.opportunities as Opportunity[];

function byDeadline(a: LocalizedOpportunity, b: LocalizedOpportunity) {
  if (!a.deadline) return 1;
  if (!b.deadline) return -1;
  return a.deadline.localeCompare(b.deadline);
}

/** Canonical catalog: bundled seed dataset plus fallback entries not already covered. */
function catalog(): Opportunity[] {
  return seededOpportunities.length > 0 ? seededOpportunities : fallbackOpportunities;
}

/** Canonical read-only catalog; administrative writes go through the BFF. */
export function allOpportunities(): Opportunity[] {
  return catalog();
}

export async function listOpportunities(locale: Locale): Promise<LocalizedOpportunity[]> {
  let opportunities = allOpportunities();
  try {
    opportunities = (await apiJson<{ items: Opportunity[] }>('/api/v1/opportunities')).items;
  } catch {
    // The bundled catalog remains usable while the edge API is unavailable.
  }
  return opportunities
    .filter((item) => item.published)
    .map(({ translations, ...item }) => ({ ...item, ...translations[locale] }))
    .sort((a, b) => Number(isPast(a.deadline)) - Number(isPast(b.deadline)) || byDeadline(a, b));
}

/** Strongly typed query filters for opportunity catalog lookups. */
export interface OpportunityFilterOptions {
  category?: OpportunityCategory | 'all';
  status?: OpportunityStatus | 'all';
  country?: string;
  searchQuery?: string;
  isFeatured?: boolean;
}

function deriveStatus(deadline: string | null): OpportunityStatus {
  if (!deadline) return 'open';
  if (isPast(deadline)) return 'closed';
  const daysLeft = (new Date(deadline).getTime() - Date.now()) / 86_400_000;
  return daysLeft <= 7 ? 'closing_soon' : 'open';
}

/**
 * Filters the localized opportunity catalog. `searchQuery` matches
 * case-insensitively against the active locale title and description; `status`
 * is derived from each item's deadline when not published as a field.
 */
export async function filterOpportunities(
  locale: Locale,
  options: OpportunityFilterOptions = {},
): Promise<LocalizedOpportunity[]> {
  const { category, status, country, searchQuery, isFeatured } = options;
  const needle = searchQuery?.trim().toLowerCase();
  const items = await listOpportunities(locale);
  return items.filter((item) => {
    if (category && category !== 'all' && !item.categories.includes(category)) return false;
    if (country && item.country !== country) return false;
    if (isFeatured !== undefined && item.featured !== isFeatured) return false;
    if (status && status !== 'all' && deriveStatus(item.deadline) !== status) return false;
    if (needle) {
      const haystack = `${item.title}\n${item.description}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
