import { apiJson } from './api-client';

export interface AdminMetrics {
  downloads: number;
  emails: number;
  prospectRatio: number;
  reviewDue: number;
}

export interface ReviewDuePage {
  items: {
    id: string;
    recordType: 'contact' | 'lead' | 'newsletter';
    submittedAt: string;
    email: string;
    message: string | null;
    guideSlug: string | null;
    unsubscribedAt: string | null;
  }[];
  hasMore: boolean;
}

export interface ChartData {
  mostVisited: { label: string; value: number }[];
  visitShare: { label: string; value: number }[];
  history: { date: string; value: number }[];
}

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  return apiJson<AdminMetrics>('/api/v1/admin/metrics');
}

export async function fetchChartData(): Promise<ChartData> {
  return apiJson<ChartData>('/api/v1/admin/charts');
}

export async function fetchReviewDue(offset = 0): Promise<ReviewDuePage> {
  return apiJson<ReviewDuePage>(`/api/v1/admin/records/review-due?offset=${offset}`);
}
