import seedContent from '../data/content.json';
import { fallbackGuides } from '../data/fallback';
import type { Guide, Locale, LocalizedGuide } from '../types/content';
import { apiJson } from './api-client';

const seededGuides = seedContent.guides as Guide[];

/** Bundled emergency fallback used only when the edge catalog is unavailable. */
function catalog(): Guide[] {
  return seededGuides.length > 0 ? seededGuides : fallbackGuides;
}

/** Canonical read-only catalog; administrative writes go through the BFF. */
export function allGuides(): Guide[] {
  return catalog();
}

export async function listGuides(locale: Locale): Promise<LocalizedGuide[]> {
  let guides = allGuides();
  try {
    guides = (await apiJson<{ items: Guide[] }>('/api/v1/guides')).items;
  } catch {
    // The bundled catalog remains usable while the edge API is unavailable.
  }
  return guides
    .filter((guide) => guide.published)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ translations, ...guide }) => ({
      ...guide,
      availableLanguages: guide.availableLanguages ?? { en: true, fr: false, ar: false },
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
