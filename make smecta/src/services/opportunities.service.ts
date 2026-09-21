import seedContent from '../data/content.json';
import { fallbackOpportunities } from '../data/fallback';
import { isPast } from '../lib/format';
import type { Locale, LocalizedOpportunity, Opportunity } from '../types/content';
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
function allOpportunities(): Opportunity[] {
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
