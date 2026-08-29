import { useQuery } from '@tanstack/react-query';
import { listGuides } from '../services/guides.service';
import { listOpportunities } from '../services/opportunities.service';
import type { Locale } from '../types/content';

const staleTime = 5 * 60_000;

export function useGuides(locale: Locale) {
  return useQuery({
    queryKey: ['guides', locale],
    queryFn: () => listGuides(locale),
    staleTime,
    retry: 1,
  });
}

export function useOpportunities(locale: Locale) {
  return useQuery({
    queryKey: ['opportunities', locale],
    queryFn: () => listOpportunities(locale),
    staleTime,
    retry: 1,
  });
}
