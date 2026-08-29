import { apiJson } from './api-client';

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
  locale: string;
  turnstileToken: string;
}

export interface NewsletterPayload {
  email: string;
  locale: string;
  turnstileToken: string;
}

export async function sendContactMessage(payload: ContactPayload): Promise<void> {
  await apiJson('/api/v1/contact', { method: 'POST', body: JSON.stringify(payload) });
}

export async function subscribeNewsletter(payload: NewsletterPayload): Promise<void> {
  await apiJson('/api/v1/newsletter', { method: 'POST', body: JSON.stringify(payload) });
}

export async function unsubscribeNewsletter(token: string): Promise<void> {
  await apiJson('/api/v1/newsletter/unsubscribe', { method: 'POST', body: JSON.stringify({ token }) });
}
