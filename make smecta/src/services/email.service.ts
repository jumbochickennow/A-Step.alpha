import { apiJson } from './api-client';

export interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  serviceInterest: string;
  message: string;
  locale: string;
  turnstileToken: string;
}

export async function sendContactMessage(payload: ContactPayload): Promise<void> {
  await apiJson<{ success: true; submissionId: string; deliveryStatus: 'pending' }>(
    '/api/v1/contact',
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export async function unsubscribeNewsletter(token: string): Promise<void> {
  await apiJson('/api/v1/newsletter/unsubscribe', { method: 'POST', body: JSON.stringify({ token }) });
}
