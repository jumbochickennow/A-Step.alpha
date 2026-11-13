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
function allGuides(): Guide[] {
  return catalog();
}

export async function listGuides(locale: Locale): Promise<LocalizedGuide[]> {
  let guides = allGuides();
  try {
    const response = await apiJson<{ items?: Guide[] }>('/api/v1/guides');
    if (Array.isArray(response.items)) guides = response.items;
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
