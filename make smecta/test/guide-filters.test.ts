import { describe, expect, it } from 'vitest';
import { filterGuides, normalizeGuideFilter } from '../src/lib/guide-filters';
import type { LocalizedGuide } from '../src/types/content';

function guide(slug: string, category: string, country: string | null = null): LocalizedGuide {
  return {
    id: slug,
    slug,
    category,
    country,
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

const slugs = (guides: LocalizedGuide[]) => guides.map((item) => item.slug);

describe('guide country and topic filters', () => {
  const guides = [
    guide('china-student-visa', 'visas', 'china'),
    guide('china-list-of-universities', 'universities', 'china'),
    guide('germany-student-visa', 'visas', 'germany'),
    guide('list-of-german-institutions', 'universities'), // legacy row: no country, slug fallback
    guide('campus-france-guide', 'applications', 'france'),
    guide('italy-scholarship-process', 'scholarships', 'italy'),
    guide('list-of-european-universities', 'universities', 'europe'),
    guide('cabin-crew-application-guide', 'careers'),
  ];

  it('returns all China guides regardless of their topic category', () => {
    expect(slugs(filterGuides(guides, 'China'))).toEqual(['china-student-visa', 'china-list-of-universities']);
  });

  it('matches by explicit country first and falls back to slug only when country is null', () => {
    expect(slugs(filterGuides(guides, 'Germany'))).toEqual(['germany-student-visa', 'list-of-german-institutions']);
    expect(slugs(filterGuides(guides, 'France'))).toEqual(['campus-france-guide']); // category "applications" is irrelevant
  });

  it('never slug-matches a guide whose country is set to another destination', () => {
    const mislabeled = [guide('germany-student-visa', 'visas', 'poland')];
    expect(filterGuides(mislabeled, 'Germany')).toEqual([]);
    expect(slugs(filterGuides(mislabeled, 'Poland'))).toEqual(['germany-student-visa']);
  });

  it('shows only europe guides under the Europe chip', () => {
    expect(slugs(filterGuides(guides, 'Europe'))).toEqual(['list-of-european-universities']);
    expect(slugs(filterGuides(guides, 'Italy'))).toEqual(['italy-scholarship-process']);
  });

  it('keeps topic filters and cabin-crew matching intact', () => {
    expect(slugs(filterGuides(guides, 'Visas'))).toEqual(['china-student-visa', 'germany-student-visa']);
    expect(slugs(filterGuides(guides, 'Universities'))).toEqual(['china-list-of-universities', 'list-of-german-institutions', 'list-of-european-universities']);
    expect(slugs(filterGuides(guides, 'Cabin Crew'))).toEqual(['cabin-crew-application-guide']);
  });

  it('normalizes URL values and sends unknown or legacy values to "All"', () => {
    expect(normalizeGuideFilter(' france ')).toBe('France');
    expect(normalizeGuideFilter('cabin crew')).toBe('Cabin Crew');
    expect(normalizeGuideFilter('')).toBe('');
    expect(normalizeGuideFilter(null)).toBe('');
    for (const legacy of ['algeria', 'gulf', 'Algeria', 'mars']) {
      expect(normalizeGuideFilter(legacy)).toBe('');
      expect(filterGuides(guides, legacy)).toEqual(guides);
    }
  });

  it('switches rapidly between countries without stale or duplicate results', () => {
    const sequence = ['China', 'Germany', 'China', 'Europe', 'Germany'];
    const results = sequence.map((filter) => slugs(filterGuides(guides, filter)));
    expect(results[0]).toEqual(results[2]);
    expect(results[1]).toEqual(results[4]);
    expect(new Set(results.flat()).size).toBe(5);
  });
});
