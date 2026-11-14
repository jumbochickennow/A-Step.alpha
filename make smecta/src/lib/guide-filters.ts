import { CATEGORIES, COUNTRIES, TOPICS } from './constants';
import type { LocalizedGuide } from '../types/content';

const canonicalFilters = new Map(CATEGORIES.map((filter) => [filter.toLowerCase(), filter]));
const countryFilters = new Set<string>(COUNTRIES.map((country) => country.toLowerCase()));
const topicFilters = new Set<string>(TOPICS.map((topic) => topic.toLowerCase()));

/** Slug fallback for legacy guides that have no explicit `country` yet. */
const COUNTRY_SLUG_TERMS: Record<string, readonly string[]> = {
  france: ['france', 'french', 'campus-france'],
  italy: ['italy', 'italian'],
  canada: ['canada', 'canadian'],
  china: ['china', 'chinese'],
  germany: ['germany', 'german'],
  poland: ['poland', 'polish'],
  europe: ['europe', 'european'],
};

const TOPIC_CATEGORIES: Record<string, readonly string[]> = {
  scholarships: ['scholarship', 'scholarships'],
  universities: ['university', 'universities'],
  visas: ['visa', 'visas'],
  'cabin crew': ['career', 'careers'],
};

/** Canonical chip value for a URL param; unknown or legacy values (algeria, gulf, …) fall back to "All" (''). */
export function normalizeGuideFilter(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? '';
  return canonicalFilters.get(normalized) ?? '';
}

function matchesCountry(guide: LocalizedGuide, filter: string): boolean {
  const country = guide.country?.trim().toLowerCase();
  if (country) return country === filter;
  const slug = guide.slug.trim().toLowerCase();
  return (COUNTRY_SLUG_TERMS[filter] ?? []).some((term) => slug.includes(term));
}

function matchesTopic(guide: LocalizedGuide, filter: string): boolean {
  const category = guide.category.trim().toLowerCase();
  if ((TOPIC_CATEGORIES[filter] ?? []).includes(category)) return true;
  return filter === 'cabin crew' && guide.slug.trim().toLowerCase().includes('cabin-crew');
}

export function filterGuides(guides: readonly LocalizedGuide[], selectedFilter: string): LocalizedGuide[] {
  const normalized = normalizeGuideFilter(selectedFilter).toLowerCase();
  if (countryFilters.has(normalized)) return guides.filter((guide) => matchesCountry(guide, normalized));
  if (topicFilters.has(normalized)) return guides.filter((guide) => matchesTopic(guide, normalized));
  return [...guides];
}
