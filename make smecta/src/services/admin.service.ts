import type { Guide, GuideLanguage, Opportunity } from '../types/content';
import { apiJson, apiUpload } from './api-client';

export async function signInAdmin(passkey: string): Promise<void> {
  await apiJson('/api/v1/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({ passkey }),
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
  onProgress?: (percent: number) => void,
): Promise<string> {
  const result = await apiUpload<{ success: true; objectKey: string }>(
    `/api/v1/admin/guides/${encodeURIComponent(guideId)}/pdf/${language}`,
    pdf,
    'application/pdf',
    onProgress,
  );
  return result.objectKey;
}

export async function uploadAdminOpportunityImage(
  opportunityId: string,
  image: File,
  onProgress?: (percent: number) => void,
  collection: 'opportunities' | 'resources' = 'opportunities',
): Promise<string> {
  return (await apiUpload<{ success: true; imagePath: string }>(
    `/api/v1/admin/${collection}/${encodeURIComponent(opportunityId)}/image`,
    image,
    image.type,
    onProgress,
  )).imagePath;
}

export async function deleteAdminGuide(id: string): Promise<void> {
  await apiJson(`/api/v1/admin/guides/${encodeURIComponent(id)}`, { method: 'DELETE', body: '{}' });
}

export async function listAdminOpportunities(collection: 'opportunities' | 'resources' = 'opportunities'): Promise<Opportunity[]> {
  return (await apiJson<{ items: Opportunity[] }>(`/api/v1/admin/${collection}`)).items;
}

type AdminOpportunityInput = Omit<Opportunity, 'id'> & { id?: string };

function opportunityPayload(opportunity: AdminOpportunityInput, published = opportunity.published) {
  return {
    id: opportunity.id,
    slug: opportunity.slug,
    country: opportunity.country,
    categories: opportunity.categories,
    applyUrl: opportunity.applyUrl || null,
    opensAt: opportunity.opensAt || null,
    deadline: opportunity.deadline || null,
    featured: opportunity.featured,
    published,
    translations: opportunity.translations,
  };
}

export async function createAdminOpportunityDraft(opportunity: AdminOpportunityInput, collection: 'opportunities' | 'resources' = 'opportunities'): Promise<string> {
  if (opportunity.id) return opportunity.id;
  return (await apiJson<{ success: true; resourceId: string }>(`/api/v1/admin/${collection}`, {
    method: 'POST',
    body: JSON.stringify(opportunityPayload(opportunity, false)),
  })).resourceId;
}

export async function saveAdminOpportunity(
  opportunity: AdminOpportunityInput,
  collection: 'opportunities' | 'resources' = 'opportunities',
): Promise<string> {
  const normalized = opportunityPayload(opportunity);
  if (opportunity.id) {
    await apiJson(`/api/v1/admin/${collection}/${encodeURIComponent(opportunity.id)}`, {
      method: 'PUT',
      body: JSON.stringify(normalized),
    });
    return opportunity.id;
  }
  return (await apiJson<{ success: true; resourceId: string }>(`/api/v1/admin/${collection}`, {
    method: 'POST',
    body: JSON.stringify(normalized),
  })).resourceId;
}

export async function deleteAdminOpportunity(id: string, collection: 'opportunities' | 'resources' = 'opportunities'): Promise<void> {
  await apiJson(`/api/v1/admin/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE', body: '{}' });
}
