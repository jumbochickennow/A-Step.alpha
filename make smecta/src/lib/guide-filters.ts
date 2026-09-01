import { CATEGORIES, COUNTRIES, TOPICS } from './constants';
import type { LocalizedGuide } from '../types/content';

const canonicalFilters = new Map(CATEGORIES.map((filter) => [filter.toLowerCase(), filter]));
const countryFilters = new Set<string>(COUNTRIES.map((country) => country.toLowerCase()));
const topicFilters = new Set<string>(TOPICS.map((topic) => topic.toLowerCase()));

const COUNTRY_SLUG_TERMS: Record<string, readonly string[]> = {
  algeria: ['algeria', 'algerian', 'campus-france-guide'],
  france: ['france', 'french', 'campus-france'],
  italy: ['italy', 'italian'],
  canada: ['canada', 'canadian'],
  china: ['china', 'chinese'],
  germany: ['germany', 'german'],
  poland: ['poland', 'polish'],
  gulf: ['gulf', 'saudi', 'uae', 'emirates', 'qatar', 'oman', 'kuwait', 'bahrain'],
};

const TOPIC_CATEGORIES: Record<string, readonly string[]> = {
  scholarships: ['scholarship', 'scholarships'],
  universities: ['university', 'universities'],
  visas: ['visa', 'visas'],
  'cabin crew': ['career', 'careers'],
};

export function normalizeGuideFilter(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? '';
  return canonicalFilters.get(normalized) ?? normalized;
}

function matchesCountry(guide: LocalizedGuide, filter: string): boolean {
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
  if (!normalized) return [...guides];
  if (countryFilters.has(normalized)) return guides.filter((guide) => matchesCountry(guide, normalized));
  if (topicFilters.has(normalized)) return guides.filter((guide) => matchesTopic(guide, normalized));
  return [];
}
