import { apiBlob, apiJson } from './api-client';

export interface GuideLeadPayload {
  fullName: string;
  email: string;
  guideId: string;
  guideLanguage: 'en' | 'fr' | 'ar';
  targetCountry?: string;
  guideSlug: string;
  locale: string;
  turnstileToken: string;
}

/** Captures a lead through the BFF and returns a short-lived gated URL. */
export async function submitGuideLead(payload: GuideLeadPayload): Promise<string> {
  const lead = await apiJson<{ success: true; grantToken: string }>('/api/v1/leads', {
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
  const grant = await apiBlob('/api/v1/download-grant', {
    method: 'POST',
    body: JSON.stringify({ grantToken: lead.grantToken, guideSlug: payload.guideSlug }),
  });
  return URL.createObjectURL(grant);
}
