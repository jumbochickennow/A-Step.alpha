import seedContent from '../data/content.json';
import { fallbackGuides } from '../data/fallback';
import type { Guide, Locale, LocalizedGuide } from '../types/content';
import { apiJson } from './api-client';

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
  let availability = new Map<string, Record<Locale, boolean>>();
  try {
    const response = await apiJson<{ items: Array<{ id: string; availableLanguages: Record<Locale, boolean> }> }>('/api/v1/guides');
    availability = new Map(response.items.map((item) => [item.id, item.availableLanguages]));
  } catch {
    // The bundled catalog remains usable while the edge API is unavailable.
  }
  return allGuides()
    .filter((guide) => guide.published)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ translations, ...guide }) => ({
      ...guide,
      availableLanguages: availability.get(guide.id) ?? { en: true, fr: false, ar: false },
      ...translations[locale],
    }));
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
