import { apiJson } from './api-client';

export interface GuideLeadPayload {
  fullName: string;
  email: string;
  guideId: string;
  guideLanguage: 'en' | 'fr' | 'ar';
  targetCountry?: string;
  locale: string;
  turnstileToken: string;
}

/** Captures a lead through the BFF and returns a short-lived gated URL. */
export async function submitGuideLead(payload: GuideLeadPayload): Promise<string> {
  const lead = await apiJson<{ success: true; downloadUrl: string }>('/api/v1/leads', {
    method: 'POST',
    body: JSON.stringify({
      fullName: payload.fullName,
      email: payload.email,
      guideId: payload.guideId,
      guideLanguage: payload.guideLanguage,
      targetCountry: payload.targetCountry,
      locale: payload.locale,
      turnstileToken: payload.turnstileToken,
    }),
  });
  if (!lead.downloadUrl.startsWith('/api/v1/download/')) throw new Error('invalid_download_url');
  return lead.downloadUrl;
}
