import { describe, expect, it } from 'vitest';
import { filterGuides, normalizeGuideFilter } from '../src/lib/guide-filters';
import type { LocalizedGuide } from '../src/types/content';

function guide(slug: string, category: string): LocalizedGuide {
  return {
    id: slug,
    slug,
    category,
    filePath: null,
    fileType: 'PDF',
    pageCount: 1,
    coverPath: null,
    published: true,
    sortOrder: 1,
    contentUpdatedAt: '2026-08-31',
    title: slug,
    description: slug,
  };
}

describe('guide country and topic filters', () => {
  const guides = [
    guide('china-student-visa', 'visas'),
    guide('china-list-of-universities', 'universities'),
    guide('germany-student-visa', 'visas'),
    guide('list-of-german-institutions', 'universities'),
    guide('campus-france-guide', 'applications'),
    guide('italy-scholarship-process', 'scholarships'),
    guide('cabin-crew-application-guide', 'careers'),
  ];

  it('returns all China resources regardless of their topic category', () => {
    expect(filterGuides(guides, 'China').map(({ slug }) => slug)).toEqual([
      'china-student-visa',
      'china-list-of-universities',
    ]);
  });

  it('switches rapidly between countries without stale or duplicate results', () => {
    expect(filterGuides(guides, 'Germany').map(({ slug }) => slug)).toEqual([
      'germany-student-visa',
      'list-of-german-institutions',
    ]);
    expect(filterGuides(guides, 'France').map(({ slug }) => slug)).toEqual(['campus-france-guide']);
    expect(filterGuides(guides, 'Italy').map(({ slug }) => slug)).toEqual(['italy-scholarship-process']);
    expect(new Set(filterGuides(guides, 'Germany').map(({ id }) => id)).size).toBe(2);
  });

  it('keeps topic filters and cabin-crew matching intact', () => {
    expect(filterGuides(guides, 'Visas').map(({ slug }) => slug)).toEqual([
      'china-student-visa',
      'germany-student-visa',
    ]);
    expect(filterGuides(guides, 'Cabin Crew').map(({ slug }) => slug)).toEqual([
      'cabin-crew-application-guide',
    ]);
  });

  it('normalizes links, clears to the full catalog, and rejects unknown filters', () => {
    expect(normalizeGuideFilter(' china ')).toBe('China');
    expect(filterGuides(guides, '')).toEqual(guides);
    expect(filterGuides(guides, 'unknown')).toEqual([]);
  });
});
