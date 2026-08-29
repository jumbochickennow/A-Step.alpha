import { apiJson } from './api-client';

export interface AdminMetrics {
  downloads: number;
  emails: number;
  prospectRatio: number;
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
