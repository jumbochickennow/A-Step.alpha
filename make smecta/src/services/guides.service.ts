import seedContent from '../data/content.json';
import { fallbackGuides } from '../data/fallback';
import type { Guide, Locale, LocalizedGuide } from '../types/content';

const seededGuides = seedContent.guides as Guide[];

/** Canonical catalog: bundled seed dataset plus fallback entries not already covered. */
function catalog(): Guide[] {
  const slugs = new Set(seededGuides.map((guide) => guide.slug));
  return [...seededGuides, ...fallbackGuides.filter((guide) => !slugs.has(guide.slug))];
}

/** Canonical read-only catalog; administrative writes go through the BFF. */
export function allGuides(): Guide[] {
  return catalog();
}

export async function listGuides(locale: Locale): Promise<LocalizedGuide[]> {
  return allGuides()
    .filter((guide) => guide.published)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ translations, ...guide }) => ({ ...guide, ...translations[locale] }));
}

/** Strongly typed query filters for guide catalog lookups. */
export interface GuideFilterOptions {
  category?: string;
  searchQuery?: string;
}

/**
 * Filters the localized guide catalog. `searchQuery` matches case-insensitively
 * against the active locale title and description.
 */
export async function filterGuides(locale: Locale, options: GuideFilterOptions = {}): Promise<LocalizedGuide[]> {
  const { category, searchQuery } = options;
  const needle = searchQuery?.trim().toLowerCase();
  return (await listGuides(locale)).filter((guide) => {
    if (category && guide.category !== category) return false;
    if (needle) {
      const haystack = `${guide.title}\n${guide.description}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
