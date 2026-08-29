import { apiBlob, apiJson } from './api-client';

export interface GuideLeadPayload {
  name: string;
  email: string;
  phone: string;
  targetGuideId: string;
  guideSlug: string;
  locale: string;
  turnstileToken: string;
}

/** Captures a lead through the BFF and returns a short-lived gated URL. */
export async function submitGuideLead(payload: GuideLeadPayload): Promise<string> {
  const lead = await apiJson<{ success: true; grantToken: string }>('/api/v1/leads', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      targetGuideId: payload.targetGuideId,
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
