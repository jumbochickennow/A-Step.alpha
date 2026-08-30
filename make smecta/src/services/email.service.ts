import { apiJson } from './api-client';

const CONTACT_RELAY_URL = 'https://formsubmit.co/ajax/belabbesbadiastep@gmail.com';

export interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  serviceInterest: string;
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
  const intake = await apiJson<{ success: true; delivery: 'browser'; confirmationToken: string }>(
    '/api/v1/contact',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  const response = await fetch(CONTACT_RELAY_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      _subject: 'New A-Step Contact Us message',
      _template: 'table',
      _captcha: 'false',
      _url: `${window.location.origin}/contact`,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      serviceInterest: payload.serviceInterest,
      message: payload.message,
      locale: payload.locale,
    }),
    cache: 'no-store',
  });
  const relay = await response.json().catch(() => null) as { success?: boolean | string } | null;
  if (!response.ok || (relay?.success !== true && relay?.success !== 'true')) throw new Error('contact_relay_failed');
  await apiJson('/api/v1/contact/delivery-confirmation', {
    method: 'POST',
    body: JSON.stringify({ confirmationToken: intake.confirmationToken }),
  });
}

export async function subscribeNewsletter(payload: NewsletterPayload): Promise<void> {
  await apiJson('/api/v1/newsletter', { method: 'POST', body: JSON.stringify(payload) });
}

export async function unsubscribeNewsletter(token: string): Promise<void> {
  await apiJson('/api/v1/newsletter/unsubscribe', { method: 'POST', body: JSON.stringify({ token }) });
}
