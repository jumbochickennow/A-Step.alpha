import type { Guide, GuideLanguage, Opportunity } from '../types/content';
import { apiJson } from './api-client';

export async function signInAdmin(): Promise<void> {
  await apiJson('/api/v1/auth/sign-in', {
    method: 'POST',
    body: '{}',
  });
}

export async function getAdminSession(): Promise<boolean> {
  try {
    await apiJson('/api/v1/auth/session');
    return true;
  } catch {
    return false;
  }
}

export async function signOutAdmin(): Promise<string> {
  return (await apiJson<{ success: true; logoutUrl: string }>(
    '/api/v1/auth/sign-out',
    { method: 'POST', body: '{}' },
  )).logoutUrl;
}

export async function listAdminGuides(): Promise<Guide[]> {
  return (await apiJson<{ items: Guide[] }>('/api/v1/admin/guides')).items;
}

export async function saveAdminGuide(guide: Omit<Guide, 'id'> & { id?: string }): Promise<string> {
  if (guide.id) {
    await apiJson(`/api/v1/admin/guides/${encodeURIComponent(guide.id)}`, {
      method: 'PUT',
      body: JSON.stringify(guide),
    });
    return guide.id;
  }
  return (await apiJson<{ success: true; resourceId: string }>('/api/v1/admin/guides', {
    method: 'POST',
    body: JSON.stringify(guide),
  })).resourceId;
}

export async function uploadAdminGuidePdf(
  guideId: string,
  language: GuideLanguage,
  pdf: File,
): Promise<string> {
  const result = await apiJson<{ success: true; objectKey: string }>(
    `/api/v1/admin/guides/${encodeURIComponent(guideId)}/pdf/${language}`,
    { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdf },
  );
  return result.objectKey;
}

export async function deleteAdminGuide(id: string): Promise<void> {
  await apiJson(`/api/v1/admin/guides/${encodeURIComponent(id)}`, { method: 'DELETE', body: '{}' });
}

export async function listAdminOpportunities(): Promise<Opportunity[]> {
  return (await apiJson<{ items: Opportunity[] }>('/api/v1/admin/opportunities')).items;
}

export async function saveAdminOpportunity(
  opportunity: Omit<Opportunity, 'id'> & { id?: string },
  image?: File | null,
): Promise<string> {
  if (image) throw new Error('runtime_uploads_disabled');
  const normalized = {
    ...opportunity,
    applyUrl: opportunity.applyUrl || null,
    opensAt: opportunity.opensAt || null,
    deadline: opportunity.deadline || null,
  };
  if (opportunity.id) {
    await apiJson(`/api/v1/admin/opportunities/${encodeURIComponent(opportunity.id)}`, {
      method: 'PUT',
      body: JSON.stringify(normalized),
    });
    return opportunity.id;
  }
  return (await apiJson<{ success: true; resourceId: string }>('/api/v1/admin/opportunities', {
    method: 'POST',
    body: JSON.stringify(normalized),
  })).resourceId;
}

export async function deleteAdminOpportunity(id: string): Promise<void> {
  await apiJson(`/api/v1/admin/opportunities/${encodeURIComponent(id)}`, { method: 'DELETE', body: '{}' });
}

export type AdminRecord = {
  id: string;
} & Record<string, string | number | boolean | null>;

export type AdminRecordTable = 'guide_download_leads' | 'newsletter_subscribers' | 'contact_messages';

export async function listAdminRecords(table: AdminRecordTable): Promise<AdminRecord[]> {
  return (await apiJson<{ items: AdminRecord[] }>(`/api/v1/admin/records/${table}`)).items;
}
